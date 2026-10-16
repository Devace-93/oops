import { describe, expect, test } from "bun:test";
import {
  allowRate,
  buildPayload,
  clickCrumb,
  dedupKey,
  endpointFromScript,
  formatArgs,
  httpCrumb,
  isDuplicate,
  isLocalPage,
  normaliseError,
  parseJsonObject,
  pushCrumb,
  shouldSample,
  stripQuery,
  type Breadcrumb,
} from "../src/payload";
import { parseStack } from "../src/stack";

const NOW = Date.UTC(2026, 9, 16, 10, 0, 1);
const CTX = { url: "https://app.example/checkout?x=1", environment: "production", release: "1.4.2", now: NOW };

describe("buildPayload", () => {
  test("mirrors the ingest contract field for field", () => {
    const err = new TypeError("x is not a function");
    err.stack = "TypeError: x is not a function\n    at init (https://app.example/x.js:12:4)";
    const frames = parseStack(err.stack, "https://app.example");
    const crumbs: Breadcrumb[] = [{ ts: "2026-10-16T10:00:00.000Z", category: "click", message: "button#pay" }];
    const p = buildPayload(
      "oops_pub_x",
      normaliseError(err),
      frames,
      { user: { id: "u_42" }, tags: { page: "checkout" }, extra: { cart: 3 } },
      { tags: { step: "pay" }, extra: { attempt: 2 }, fingerprint: ["checkout", "pay-failed"] },
      crumbs,
      CTX,
    );
    expect(p).toEqual({
      k: "oops_pub_x",
      type: "TypeError",
      message: "x is not a function",
      level: "error",
      stack: err.stack,
      frames: [{ filename: "https://app.example/x.js", function: "init", lineno: 12, colno: 4, in_app: true }],
      url: "https://app.example/checkout?x=1",
      release: "1.4.2",
      environment: "production",
      platform: "javascript",
      sdk: "oops-js/0.1.0",
      user: { id: "u_42" },
      tags: { page: "checkout", step: "pay" },
      extra: { cart: 3, attempt: 2 },
      breadcrumbs: crumbs,
      fingerprint: ["checkout", "pay-failed"],
      ts: "2026-10-16T10:00:01.000Z",
    });
    // The breadcrumbs are a snapshot, not the live buffer.
    expect(p.breadcrumbs).not.toBe(crumbs);
    // Optional fields are absent (undefined → dropped by JSON.stringify).
    expect(JSON.parse(JSON.stringify(p))).toHaveProperty("fingerprint");
  });

  test("messages have no type, default level comes from the options, empty optionals are omitted", () => {
    const p = buildPayload("k", { message: "hello" }, [], { tags: {}, extra: {} }, { level: "info" }, [], { url: "https://a.example/", environment: "staging", now: NOW });
    const json = JSON.parse(JSON.stringify(p));
    expect(json.type).toBeUndefined();
    expect(json.level).toBe("info");
    expect(json.stack).toBeUndefined();
    expect(json.release).toBeUndefined();
    expect(json.user).toBeUndefined();
    expect(json.fingerprint).toBeUndefined();
    expect(json.frames).toEqual([]);
    expect(json.tags).toEqual({});
    expect(json.environment).toBe("staging");
  });

  test("caps message, type, stack and fingerprint client-side", () => {
    const p = buildPayload(
      "k",
      { type: "T".repeat(300), message: "m".repeat(5000), stack: "s".repeat(20000) },
      [],
      { tags: {}, extra: {} },
      { fingerprint: ["a", "b", "c", "d", "e", "f", "g".repeat(200)] },
      [],
      CTX,
    );
    expect(p.type).toHaveLength(200);
    expect(p.message).toHaveLength(4096);
    expect(p.stack).toHaveLength(16384);
    expect(p.fingerprint).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("normaliseError", () => {
  test("Error instances keep name, message and stack", () => {
    const e = new RangeError("too big");
    const n = normaliseError(e);
    expect(n.type).toBe("RangeError");
    expect(n.message).toBe("too big");
    expect(n.stack).toBe(e.stack);
  });
  test("error-like objects without a name fall back to the given type", () => {
    expect(normaliseError({ message: "custom", stack: "x" }, "UnhandledRejection")).toEqual({ type: "UnhandledRejection", message: "custom", stack: "x" });
  });
  test("strings, objects and primitives become a message", () => {
    expect(normaliseError("boom")).toEqual({ type: "Error", message: "boom" });
    expect(normaliseError({ code: 42 }, "UnhandledRejection")).toEqual({ type: "UnhandledRejection", message: '{"code":42}' });
    expect(normaliseError(undefined)).toEqual({ type: "Error", message: "undefined" });
    expect(normaliseError(7)).toEqual({ type: "Error", message: "7" });
  });
});

describe("dedup", () => {
  const frames = parseStack("Error: x\n    at a (https://a.example/a.js:1:2)", "https://a.example");
  test("key = type + message + top frame", () => {
    expect(dedupKey("TypeError", "x", frames)).toBe("TypeError\nx\nhttps://a.example/a.js:" + (frames[0]!.function || ""));
    expect(dedupKey(undefined, "x", [])).toBe("\nx\n");
    expect(dedupKey("TypeError", "x", frames)).not.toBe(dedupKey("TypeError", "y", frames));
  });
  test("identical events within 2 s are duplicates, later ones are not", () => {
    const seen: Record<string, number> = {};
    expect(isDuplicate(seen, "k", 1000)).toBe(false);
    expect(isDuplicate(seen, "k", 2999)).toBe(true);
    expect(isDuplicate(seen, "other", 2999)).toBe(false);
    expect(isDuplicate(seen, "k", 3000)).toBe(false);
    expect(isDuplicate(seen, "k", 3001)).toBe(true);
  });
});

describe("allowRate", () => {
  test("30 per minute per page, window resets", () => {
    const state = { t: 0, n: 0 };
    for (let i = 0; i < 30; i++) expect(allowRate(state, 1000 + i)).toBe(true);
    expect(allowRate(state, 2000)).toBe(false);
    expect(allowRate(state, 60_999)).toBe(false);
    expect(allowRate(state, 61_000)).toBe(true);
  });
});

describe("shouldSample", () => {
  test("missing or invalid rate keeps everything; a fraction samples; 0 drops all", () => {
    expect(shouldSample(null, 0.99)).toBe(true);
    expect(shouldSample("", 0.99)).toBe(true);
    expect(shouldSample("abc", 0.99)).toBe(true);
    expect(shouldSample("1", 0.99)).toBe(true);
    expect(shouldSample("2", 0.99)).toBe(true);
    expect(shouldSample("0.5", 0.49)).toBe(true);
    expect(shouldSample("0.5", 0.5)).toBe(false);
    expect(shouldSample("0", 0.0001)).toBe(false);
  });
});

describe("isLocalPage", () => {
  const page = (hostname: string, protocol = "https:") => ({ hostname, protocol });
  test("localhost, loopback, raw IPs, file: and .local are local", () => {
    for (const h of ["localhost", "127.0.0.1", "192.168.1.4", "10.0.0.2", "app.local", "site.test", ""]) expect(isLocalPage(page(h))).toBe(true);
    expect(isLocalPage(page("a.example", "file:"))).toBe(true);
  });
  test("real hosts are not", () => {
    for (const h of ["example.com", "app.example.com", "host.example", "oops.3m4.net"]) expect(isLocalPage(page(h))).toBe(false);
  });
});

describe("endpointFromScript", () => {
  test("derives /api/ingest on the script's origin", () => {
    expect(endpointFromScript("https://oops.3m4.net/o.js")).toBe("https://oops.3m4.net/api/ingest");
    expect(endpointFromScript("http://localhost:8084/o/v1.js")).toBe("http://localhost:8084/api/ingest");
    expect(endpointFromScript(null)).toBe("/api/ingest");
  });
});

describe("parseJsonObject", () => {
  test("accepts a JSON object, rejects everything else", () => {
    expect(parseJsonObject('{"id":"u_42","email":"a@b.c"}')).toEqual({ id: "u_42", email: "a@b.c" });
    expect(parseJsonObject("[1,2]")).toBeUndefined();
    expect(parseJsonObject("not json")).toBeUndefined();
    expect(parseJsonObject(null)).toBeUndefined();
  });
});

describe("breadcrumbs", () => {
  test("click: tag#id.classes + text ≤ 60", () => {
    const c = clickCrumb({ tagName: "BUTTON", id: "pay", className: "btn  primary big huge", textContent: "  Pay\n now " + "x".repeat(100) });
    expect(c.category).toBe("click");
    expect(c.message).toBe("button#pay.btn.primary.big");
    expect((c.data as { text: string }).text).toHaveLength(60);
    expect((c.data as { text: string }).text.startsWith("Pay now x")).toBe(true);
    expect(clickCrumb({ tagName: "DIV", className: "", textContent: "" })).toEqual({ category: "click", message: "div" });
  });

  test("failed http: method + URL without query, status in data", () => {
    expect(httpCrumb("fetch", "post", "https://api.example/pay?token=SECRET#x", 500)).toEqual({
      category: "fetch",
      level: "error",
      message: "POST https://api.example/pay",
      data: { status: 500 },
    });
    expect(httpCrumb("xhr", "GET", "/users?id=1", 0).message).toBe("GET /users");
    expect(stripQuery("https://a.example/p?q=1")).toBe("https://a.example/p");
  });

  test("console args join into one line ≤ 200", () => {
    expect(formatArgs(["failed", { id: 1 }, 42, undefined])).toBe('failed {"id":1} 42 undefined');
    expect(formatArgs(["x".repeat(500)])).toHaveLength(200);
  });

  test("ring buffer keeps the last 30 and stamps ts", () => {
    const buf: Breadcrumb[] = [];
    for (let i = 0; i < 35; i++) pushCrumb(buf, { category: "click", message: String(i) }, NOW + i);
    expect(buf).toHaveLength(30);
    expect(buf[0]!.message).toBe("5");
    expect(buf[29]!.message).toBe("34");
    expect(buf[0]!.ts).toBe(new Date(NOW + 5).toISOString());
    const own: Breadcrumb = { category: "manual", ts: "2026-01-01T00:00:00Z" };
    pushCrumb(buf, own, NOW);
    expect(buf[29]!.ts).toBe("2026-01-01T00:00:00Z");
  });
});
