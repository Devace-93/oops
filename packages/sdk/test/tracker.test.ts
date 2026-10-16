import { describe, expect, test } from "bun:test";
import { buildPayload, endpointFromScript, isLocalPage, pageUrl, parseProps } from "../src/payload";

describe("payload", () => {
  test("buildPayload uses the short keys of the collect contract", () => {
    const p = buildPayload("oops_pub_x", "pageview", "https://a.example/docs?q=1", "https://google.com/", "Docs", { width: 1440, height: 900 }, "es-MX");
    expect(p).toEqual({ k: "oops_pub_x", n: "pageview", u: "https://a.example/docs?q=1", r: "https://google.com/", t: "Docs", w: 1440, h: 900, l: "es-MX", s: "script" });
  });

  test("custom events carry props; empty props are omitted", () => {
    expect(buildPayload("k", "signup", "https://a.example/", "", "", null, "", { plan: "pro" }).p).toEqual({ plan: "pro" });
    expect(buildPayload("k", "signup", "https://a.example/", "", "", null, "", {}).p).toBeUndefined();
    expect(buildPayload("k", "", "https://a.example/", "", "", null, "").n).toBe("pageview");
  });

  test("title and language are capped", () => {
    const p = buildPayload("k", "pageview", "https://a.example/", "", "x".repeat(300), null, "y".repeat(40));
    expect(p.t).toHaveLength(200);
    expect(p.l).toHaveLength(16);
  });
});

describe("pageUrl", () => {
  test("drops the hash unless hash routing is on", () => {
    expect(pageUrl("https://a.example/p?x=1#sec", false)).toBe("https://a.example/p?x=1");
    expect(pageUrl("https://a.example/p#/route", true)).toBe("https://a.example/p#/route");
  });
});

describe("isLocalPage", () => {
  const page = (hostname: string, protocol = "https:") => ({ href: "", hostname, protocol });
  test("localhost, loopback, raw IPs, file: and .local are local", () => {
    for (const h of ["localhost", "127.0.0.1", "192.168.1.4", "10.0.0.2", "app.local", "site.test", ""]) expect(isLocalPage(page(h))).toBe(true);
    expect(isLocalPage(page("a.example", "file:"))).toBe(true);
  });
  test("real hosts are not", () => {
    for (const h of ["example.com", "app.example.com", "kinegram.3m4.net"]) expect(isLocalPage(page(h))).toBe(false);
  });
});

describe("endpointFromScript", () => {
  test("derives /api/collect on the script's origin", () => {
    expect(endpointFromScript("https://metrics.3m4.net/m.js")).toBe("https://oops.3m4.net/api/collect");
    expect(endpointFromScript("http://localhost:8084/m/v1.js")).toBe("http://localhost:8084/api/collect");
    expect(endpointFromScript(null)).toBe("/api/collect");
  });
});

describe("parseProps", () => {
  test("accepts a JSON object, rejects everything else", () => {
    expect(parseProps('{"plan":"pro"}')).toEqual({ plan: "pro" });
    expect(parseProps("[1,2]")).toBeUndefined();
    expect(parseProps("not json")).toBeUndefined();
    expect(parseProps(null)).toBeUndefined();
  });
});
