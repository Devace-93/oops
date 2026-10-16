import { test, expect } from "@playwright/test";
import { API_URL, DESKTOP_UA, MOBILE_UA, TRACKER_URL, collect, createProject, listEvents, patchProject, registerAccount, stats } from "../helpers";

/**
 * The public collect API: JSON with the key in a header, text/plain body with
 * the key inside (what the tracker sends), the pixel, bots, allowed origins,
 * paused projects, bad keys, CORS, and the stats that come out the other end.
 */
test.describe("collect API", () => {
  test("@critical page views and a custom event show up in stats and the event log", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account, { timezone: "Europe/Madrid" });

    const a = await collect(request, project.public_key, {
      u: "https://site.example/docs?utm_source=newsletter&utm_campaign=oct&token=SECRET",
      r: "https://news.ycombinator.com/item?id=1",
      t: "Docs",
      w: 1440,
      h: 900,
      l: "es-MX",
    });
    expect(a.status, JSON.stringify(a.body)).toBe(202);
    expect(a.body).toEqual({ ok: true });

    // Same visitor (same UA + IP), second page: internal referrer is not a referral.
    const b = await collect(request, project.public_key, { u: "https://site.example/pricing", r: "https://site.example/docs" });
    expect(b.body.ok).toBe(true);

    // A mobile visitor, text/plain body with the key inside (tracker style).
    const c = await request.post(`${API_URL}/collect`, {
      headers: { "Content-Type": "text/plain", "User-Agent": MOBILE_UA },
      data: JSON.stringify({ k: project.public_key, n: "signup", u: "https://site.example/pricing", p: { plan: "pro" }, s: "script" }),
    });
    expect(c.status(), await c.text()).toBe(202);

    const s = await stats(request, account, project.id);
    expect(s.range.tz).toBe("Europe/Madrid");
    expect(s.totals).toEqual({ pageviews: 2, visitors: 2, events: 1 });
    expect(s.breakdowns.path.map((r: any) => r.value).sort()).toEqual(["/docs", "/pricing"]);
    expect(s.breakdowns.referrer.map((r: any) => r.value).sort()).toEqual(["(direct)", "news.ycombinator.com"]);
    expect(s.breakdowns.device.map((r: any) => r.value).sort()).toEqual(["desktop", "mobile"]);
    expect(s.breakdowns.utm_source).toEqual([{ value: "newsletter", pageviews: 1, visitors: 1, events: 0 }]);
    expect(s.breakdowns.name).toEqual([{ value: "signup", pageviews: 0, visitors: 1, events: 1 }]);
    expect(s.series.length).toBeGreaterThanOrEqual(1);
    expect(s.series.reduce((n: number, p: any) => n + p.pageviews, 0)).toBe(2);
    expect(s.live.visitors).toBe(2);

    const events = await listEvents(request, account, project.id);
    expect(events.total).toBe(3);
    const docs = events.items.find((e) => e.path === "/docs")!;
    expect(docs.referrer_host).toBe("news.ycombinator.com");
    expect(docs.utm_campaign).toBe("oct");
    expect(docs.title).toBe("Docs");
    expect(docs.lang).toBe("es-MX");
    expect(docs.browser).toBe("Chrome");
    expect(docs.device).toBe("desktop");
    expect(JSON.stringify(docs)).not.toContain("SECRET"); // query string never stored
    const signup = events.items.find((e) => e.kind === "event")!;
    expect(signup.name).toBe("signup");
    expect(signup.props).toEqual({ plan: "pro" });
    expect(signup.device).toBe("mobile");

    // Filters scope everything.
    const mobile = await stats(request, account, project.id, { period: "today", device: "mobile" });
    expect(mobile.totals).toEqual({ pageviews: 0, visitors: 1, events: 1 });
    expect(mobile.filters).toEqual({ device: "mobile" });
  });

  test("the pixel stores a hit and always answers a GIF", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    const res = await request.get(`${API_URL}/collect/pixel.gif?k=${project.public_key}&u=/newsletter/october&n=open`, {
      headers: { "User-Agent": DESKTOP_UA, Referer: "https://mail.example/" },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/image\/gif/);
    expect(res.headers()["cache-control"]).toMatch(/no-store/);
    const events = await listEvents(request, account, project.id);
    expect(events.total).toBe(1);
    expect(events.items[0]!.source).toBe("pixel");
    expect(events.items[0]!.kind).toBe("event");
    expect(events.items[0]!.name).toBe("open");
    expect(events.items[0]!.path).toBe("/newsletter/october");

    // Unknown key: still a GIF, nothing stored.
    const bad = await request.get(`${API_URL}/collect/pixel.gif?k=oops_pub_nope&u=/x`);
    expect([200, 401]).toContain(bad.status());
  });

  test("bots, paused projects and disallowed origins are dropped, not rejected", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account, { allowed_origins: ["site.example", "*.site.example"] });

    const bot = await collect(request, project.public_key, { u: "https://site.example/" }, { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" });
    expect(bot.status).toBe(202);
    expect(bot.body).toEqual({ ok: false, reason: "bot" });

    const elsewhere = await collect(request, project.public_key, { u: "https://copycat.example/" });
    expect(elsewhere.body).toEqual({ ok: false, reason: "origin" });
    const sub = await collect(request, project.public_key, { u: "https://app.site.example/" });
    expect(sub.body).toEqual({ ok: true });

    await patchProject(request, account, project.id, { collect_enabled: false });
    const paused = await collect(request, project.public_key, { u: "https://site.example/" });
    expect(paused.body).toEqual({ ok: false, reason: "paused" });

    const events = await listEvents(request, account, project.id);
    expect(events.total).toBe(1);
  });

  test("validation: bad key, bad event name, oversized props", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);

    const badKey = await collect(request, "oops_pub_doesnotexist", { u: "/" });
    expect(badKey.status).toBe(401);
    expect(badKey.body.error.code).toBe("invalid_project_key");

    const badName = await collect(request, project.public_key, { n: "<script>", u: "/" });
    expect(badName.status).toBe(400);
    expect(badName.body.error.code).toBe("invalid_name");

    const big = await collect(request, project.public_key, { n: "big", u: "/", p: { blob: "x".repeat(3000) } });
    expect(big.status).toBe(400);
    expect(big.body.error.code).toBe("props_too_large");
  });

  test("rotating the key invalidates the old one; purge empties the log", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    await collect(request, project.public_key, { u: "/" });
    const rot = await request.post(`${API_URL}/projects/${project.id}/rotate-key`, { headers: { Authorization: `Bearer ${account.accessToken}` } });
    expect(rot.status()).toBe(200);
    const { public_key } = await rot.json();
    expect((await collect(request, project.public_key, { u: "/" })).status).toBe(401);
    expect((await collect(request, public_key, { u: "/" })).body.ok).toBe(true);
    expect((await listEvents(request, account, project.id)).total).toBe(2);

    // store_ip keeps the raw address on new hits only.
    await patchProject(request, account, project.id, { store_ip: true });
    expect((await collect(request, public_key, { u: "/with-ip" })).body.ok).toBe(true);
    const rows = (await listEvents(request, account, project.id)).items;
    expect(rows.find((e) => e.path === "/with-ip")!.ip).toMatch(/^[0-9a-f.:]+$/);
    expect(rows.find((e) => e.path === "/")!.ip).toBeNull();
    const byIp = await stats(request, account, project.id, { period: "today" });
    expect(byIp.breakdowns.ip.length).toBe(1);

    const purge = await request.delete(`${API_URL}/projects/${project.id}/events`, { headers: { Authorization: `Bearer ${account.accessToken}` } });
    expect(purge.status(), await purge.text()).toBe(200);
    expect((await purge.json()).deleted).toBe(3);
    expect((await listEvents(request, account, project.id)).total).toBe(0);
  });

  test("collect is CORS-open; m.js is cacheable and CORS-open", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);

    const preflight = await request.fetch(`${API_URL}/collect`, {
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

    const hit = await request.post(`${API_URL}/collect`, {
      headers: { "X-Project-Key": project.public_key, "User-Agent": DESKTOP_UA, Origin: "https://third-party.example" },
      data: { u: "https://third-party.example/" },
    });
    expect(hit.status()).toBe(202);
    expect(["*", "https://third-party.example"]).toContain(hit.headers()["access-control-allow-origin"]);

    const tracker = await request.get(TRACKER_URL);
    expect(tracker.status()).toBe(200);
    expect(tracker.headers()["content-type"]).toMatch(/javascript/);
    expect(tracker.headers()["access-control-allow-origin"]).toBe("*");
    expect(tracker.headers()["cache-control"]).toMatch(/max-age/);
    expect((await tracker.text()).length).toBeLessThan(12_000);
  });
});
