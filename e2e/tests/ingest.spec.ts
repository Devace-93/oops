import { test, expect } from "@playwright/test";
import {
  API_URL,
  DESKTOP_UA,
  GECKO_STACK,
  SDK_URL,
  V8_STACK,
  createProject,
  getIssue,
  ingest,
  ingestBatch,
  ingestOk,
  listEvents,
  listIssues,
  patchProject,
  registerAccount,
} from "../helpers";

/**
 * The public ingest API: grouping into issues by fingerprint, user counts,
 * scrubbing, URL hygiene, drop reasons (always 202), validation, batches,
 * server-side stack parsing and CORS.
 */
test.describe("ingest API", () => {
  test("@critical groups events into issues, counts users, scrubs secrets and drops the query string", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account, { timezone: "Europe/Madrid" });
    const base = {
      type: "TypeError",
      message: "Cannot read properties of undefined (reading checkout)",
      level: "error",
      stack: V8_STACK,
      url: "https://app.example/checkout?token=SECRET-QUERY#frag",
      release: "1.4.2",
      environment: "production",
      platform: "javascript",
      sdk: "oops-js/0.1.0",
      user: { id: "u_1", email: "ada@example.com", name: "Ada" },
      tags: { page: "checkout", api_key: "tag-secret-value" },
      extra: { cart: 3, password: "hunter2-extra" },
      breadcrumbs: [
        { ts: "2026-10-16T10:00:00Z", category: "click", message: "button#pay", level: "info", data: { text: "Pay", token: "crumb-secret" } },
        { category: "navigation", message: "/checkout" },
      ],
    };

    const a = await ingestOk(request, project.public_key, base);
    expect(a.issue_number).toBe(1);
    expect(a.event_id).toBeTruthy();

    // Same fingerprint, another user → same issue.
    const b = await ingestOk(request, project.public_key, { ...base, user: { id: "u_2" } });
    expect(b.issue_id).toBe(a.issue_id);
    expect(b.issue_number).toBe(1);

    // A different error → a second issue.
    const c = await ingestOk(request, project.public_key, { type: "ReferenceError", message: "widget is not defined", user: { id: "u_1" } });
    expect(c.issue_id).not.toBe(a.issue_id);
    expect(c.issue_number).toBe(2);

    // text/plain body with the key inside (what the SDK sends); u_1 again, so users stay at 2.
    const d = await ingestOk(request, project.public_key, base, { textPlain: true });
    expect(d.issue_id).toBe(a.issue_id);

    const issues = await listIssues(request, account, project.id);
    expect(issues.total).toBe(2);
    const typeIssue = issues.items.find((i) => i.id === a.issue_id)!;
    const refIssue = issues.items.find((i) => i.id === c.issue_id)!;
    expect(typeIssue.title).toBe("TypeError: Cannot read properties of undefined (reading checkout)");
    expect(typeIssue.type).toBe("TypeError");
    expect(typeIssue.level).toBe("error");
    expect(typeIssue.status).toBe("open");
    expect(typeIssue.number).toBe(1);
    expect(typeIssue.event_count).toBe(3);
    expect(typeIssue.user_count).toBe(2);
    expect(typeIssue.culprit).toContain("init");
    expect(typeIssue.environments).toEqual(["production"]);
    expect(typeIssue.releases).toEqual(["1.4.2"]);
    expect(typeIssue.first_seen).toBeTruthy();
    expect(typeIssue.last_seen >= typeIssue.first_seen).toBe(true);
    expect(refIssue.event_count).toBe(1);
    expect(refIssue.user_count).toBe(1);
    expect(refIssue.title).toBe("ReferenceError: widget is not defined");

    // The issue detail carries the latest event; by uuid and by number.
    const detail = await getIssue(request, account, project.id, a.issue_id);
    expect((await getIssue(request, account, project.id, 1)).id).toBe(a.issue_id);
    const ev = detail.latest_event!;
    expect(ev.id).toBe(d.event_id);
    expect(ev.issue_id).toBe(a.issue_id);
    expect(ev.issue_number).toBe(1);
    // The payload labels itself as the browser SDK ("oops-js/…"), so the server records source "sdk".
    expect(ev.source).toBe("sdk");
    expect(ev.platform).toBe("javascript");
    expect(ev.sdk).toBe("oops-js/0.1.0");
    expect(ev.release).toBe("1.4.2");
    expect(ev.environment).toBe("production");
    expect(ev.url).toBe("https://app.example/checkout");
    expect(ev.path).toBe("/checkout");
    expect(ev.hostname).toBe("app.example");
    expect(ev.frames[0]).toMatchObject({ filename: "https://app.example/js/x.js", function: "init", lineno: 12, colno: 4 });
    expect(ev.frames).toHaveLength(3);
    expect(ev.stack_raw).toContain("at init");
    expect(ev.user).toMatchObject({ id: "u_1", email: "ada@example.com", name: "Ada" });
    expect(ev.browser).toBe("Chrome");
    expect(ev.device).toBe("desktop");
    expect(ev.tags.page).toBe("checkout");
    expect(ev.tags.api_key).toBe("[Filtered]");
    expect(ev.extra.cart).toBe(3);
    expect(ev.extra.password).toBe("[Filtered]");
    expect(ev.breadcrumbs).toHaveLength(2);
    expect(ev.breadcrumbs[0]!.category).toBe("click");
    expect(ev.breadcrumbs[0]!.data!.token).toBe("[Filtered]");
    expect(ev.breadcrumbs[0]!.data!.text).toBe("Pay");
    const json = JSON.stringify(ev);
    for (const secret of ["SECRET-QUERY", "tag-secret-value", "hunter2-extra", "crumb-secret"]) expect(json).not.toContain(secret);
    expect(json).not.toContain("#frag");
  });

  test("a client fingerprint overrides grouping; digits in messages do not split issues", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    const fp = ["checkout", "pay-failed"];
    const a = await ingestOk(request, project.public_key, { type: "PaymentError", message: "card declined", fingerprint: fp });
    const b = await ingestOk(request, project.public_key, { type: "TimeoutError", message: "gateway timed out", fingerprint: fp });
    expect(b.issue_id).toBe(a.issue_id);
    // Without the override the same message is its own issue.
    const c = await ingestOk(request, project.public_key, { type: "PaymentError", message: "card declined" });
    expect(c.issue_id).not.toBe(a.issue_id);
    // Normalised messages: numbers are placeholders.
    const d = await ingestOk(request, project.public_key, { type: "LookupError", message: "User 42 not found" });
    const e = await ingestOk(request, project.public_key, { type: "LookupError", message: "User 43 not found" });
    expect(e.issue_id).toBe(d.issue_id);

    const issues = await listIssues(request, account, project.id);
    expect(issues.total).toBe(3);
    expect(issues.items.find((i) => i.id === a.issue_id)!.event_count).toBe(2);
    expect(issues.items.find((i) => i.id === d.issue_id)!.event_count).toBe(2);
  });

  test("tokens inside the message are scrubbed", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdef";
    const r = await ingestOk(request, project.public_key, { type: "AuthError", message: `Request failed with Authorization: Bearer ${token}` });
    const issue = await getIssue(request, account, project.id, r.issue_id);
    expect(issue.latest_event!.message).not.toContain(token);
    expect(issue.title).not.toContain(token);
  });

  test("paused projects and disallowed origins are dropped with 202, not rejected", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account, { allowed_origins: ["site.example"] });

    const elsewhere = await ingest(
      request,
      project.public_key,
      { type: "Error", message: "from a copycat", url: "https://copycat.example/x" },
      { headers: { Origin: "https://copycat.example" } },
    );
    expect(elsewhere.status).toBe(202);
    expect(elsewhere.body).toEqual({ ok: false, reason: "origin" });

    const allowed = await ingest(
      request,
      project.public_key,
      { type: "Error", message: "from the real site", url: "https://site.example/x" },
      { headers: { Origin: "https://site.example" } },
    );
    expect(allowed.status).toBe(202);
    expect((allowed.body as any).ok).toBe(true);

    await patchProject(request, account, project.id, { ingest_enabled: false });
    const paused = await ingest(
      request,
      project.public_key,
      { type: "Error", message: "while paused", url: "https://site.example/x" },
      { headers: { Origin: "https://site.example" } },
    );
    expect(paused.status).toBe(202);
    expect(paused.body).toEqual({ ok: false, reason: "paused" });

    expect((await listEvents(request, account, project.id)).total).toBe(1);
  });

  test("validation: bad key is 401, malformed payloads are 400, batches return one result per event", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);

    const badKey = await ingest(request, "oops_pub_doesnotexist", { type: "Error", message: "x" });
    expect(badKey.status).toBe(401);
    expect((badKey.body as any).error.code).toBe("invalid_project_key");

    const noKey = await request.post(`${API_URL}/ingest`, { data: { type: "Error", message: "x" } });
    expect(noKey.status()).toBe(401);

    const empty = await ingest(request, project.public_key, {});
    expect(empty.status).toBe(400);
    expect((empty.body as any).error.code).toBe("invalid_event");

    const badJson = await ingest(request, project.public_key, {}, { rawBody: "{not json", headers: { "X-Project-Key": project.public_key } });
    expect(badJson.status).toBe(400);
    expect((badJson.body as any).error.code).toBe("invalid_event");

    // Message-only and type-only events are both fine.
    expect((await ingestOk(request, project.public_key, { message: "just a message", level: "info" })).issue_number).toBe(1);
    expect((await ingestOk(request, project.public_key, { type: "OnlyAType" })).issue_number).toBe(2);

    // /ingest/event is an alias.
    const alias = await ingest(request, project.public_key, { type: "AliasError", message: "via /ingest/event" }, { path: "/ingest/event" });
    expect(alias.status).toBe(202);
    expect((alias.body as any).ok).toBe(true);

    const batch = await ingestBatch(request, project.public_key, [
      { type: "BatchError", message: "one" },
      { type: "BatchError", message: "two" },
      { message: "three", level: "warning" },
    ]);
    expect(batch.status, JSON.stringify(batch.body)).toBe(202);
    expect(batch.body.ok).toBe(true);
    expect(batch.body.results).toHaveLength(3);
    for (const r of batch.body.results) expect(r.ok).toBe(true);
    expect((await listEvents(request, account, project.id)).total).toBe(6);
  });

  test("a raw stack string is parsed server-side into frames (V8 and Firefox formats)", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);

    const v8 = await ingestOk(request, project.public_key, { type: "TypeError", message: "v8 stack", stack: V8_STACK, platform: "javascript" });
    const v8Event = (await getIssue(request, account, project.id, v8.issue_id)).latest_event!;
    expect(v8Event.frames).toHaveLength(3);
    expect(v8Event.frames[0]).toMatchObject({ filename: "https://app.example/js/x.js", function: "init", lineno: 12, colno: 4 });
    expect(v8Event.frames[2]).toMatchObject({ filename: "https://cdn.example/lib.min.js", lineno: 5, colno: 1234 });
    expect(v8Event.stack_raw).toBe(V8_STACK);

    const gecko = await ingestOk(request, project.public_key, { type: "TypeError", message: "gecko stack", stack: GECKO_STACK, platform: "javascript" });
    const geckoEvent = (await getIssue(request, account, project.id, gecko.issue_id)).latest_event!;
    expect(geckoEvent.frames).toHaveLength(3);
    expect(geckoEvent.frames[0]).toMatchObject({ filename: "https://app.example/js/x.js", function: "init", lineno: 12, colno: 4 });

    // Explicit frames win over the raw string.
    const explicit = await ingestOk(request, project.public_key, {
      type: "TypeError",
      message: "explicit frames",
      stack: V8_STACK,
      frames: [{ filename: "https://app.example/js/y.js", function: "render", lineno: 7, colno: 2, in_app: true }],
    });
    const explicitEvent = (await getIssue(request, account, project.id, explicit.issue_id)).latest_event!;
    expect(explicitEvent.frames).toEqual([{ filename: "https://app.example/js/y.js", function: "render", lineno: 7, colno: 2, in_app: true }]);
  });

  test("ingest is CORS-open for any origin; /o.js is served cacheable and CORS-open", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);

    const preflight = await request.fetch(`${API_URL}/ingest`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://third-party.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,x-project-key",
      },
    });
    expect([200, 204]).toContain(preflight.status());
    // flask-cors echoes the caller's origin for a wildcard resource; both forms are CORS-open.
    expect(["*", "https://third-party.example"]).toContain(preflight.headers()["access-control-allow-origin"]);
    expect((preflight.headers()["access-control-allow-headers"] ?? "").toLowerCase()).toContain("x-project-key");

    const posted = await request.post(`${API_URL}/ingest`, {
      headers: { "X-Project-Key": project.public_key, "User-Agent": DESKTOP_UA, Origin: "https://third-party.example" },
      data: { type: "Error", message: "cross-origin", url: "https://third-party.example/" },
    });
    expect(posted.status()).toBe(202);
    expect(["*", "https://third-party.example"]).toContain(posted.headers()["access-control-allow-origin"]);

    for (const url of [SDK_URL, SDK_URL.replace(/o\.js$/, "o/v1.js")]) {
      const sdk = await request.get(url);
      expect(sdk.status(), url).toBe(200);
      expect(sdk.headers()["content-type"]).toMatch(/javascript/);
      expect(sdk.headers()["access-control-allow-origin"]).toBe("*");
      expect(sdk.headers()["cache-control"]).toMatch(/max-age/);
      const body = await sdk.text();
      expect(body).toContain("oops-js/0.1.0");
      expect(body.length).toBeLessThan(16_000);
    }
  });
});
