import { test, expect, type Page } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { SDK_URL, createProject, getIssue, listEvents, listIssues, pollUntil, registerAccount } from "../helpers";

/**
 * The browser SDK on a third-party-looking host page. The page is served from
 * a fake public host (routed), loads /o.js from the running stack and posts
 * events cross-origin exactly like a customer site would.
 */
const HOST_ORIGIN = "https://host.example";
const INGEST = `${BASE_URL}/api/ingest`;

async function serveHost(page: Page, projectKey: string, extraAttrs = ""): Promise<void> {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Host app</title></head>
<body>
  <h1>Host app</h1>
  <button id="pay" class="btn primary">Pay now</button>
  <script>window.oops = { q: [["setUser", { id: "u_42", email: "ada@example.com" }], ["setTag", "plan", "pro"]] };</script>
  <script>
    function boom() { throw new TypeError("checkout is not a function"); }
  </script>
  <script defer src="${SDK_URL}" data-key="${projectKey}" data-api="${INGEST}" data-env="staging" data-release="e2e-1" ${extraAttrs}></script>
</body></html>`;
  // Playwright matches the most recently registered route first: the catch-all goes first.
  await page.route(`${HOST_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.route(`${HOST_ORIGIN}/api/broken**`, (route) => route.fulfill({ status: 500, contentType: "text/plain", body: "nope" }));
  await page.goto(`${HOST_ORIGIN}/app/checkout?x=1`);
  await page.waitForFunction(() => typeof (window as any).oops?.capture === "function");
}

test.describe("browser SDK", () => {
  test("@critical uncaught error, rejected promise, capture and message reach the API with frames, breadcrumbs and user", async ({ page, request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await serveHost(page, project.public_key);

    // Breadcrumbs first: a click, an SPA navigation and a failed fetch.
    await page.click("#pay");
    await page.evaluate(async () => {
      history.pushState({}, "", "/app/pay");
      await fetch("/api/broken?token=SECRET").catch(() => {});
    });
    // Then the errors.
    await page.evaluate(() => setTimeout(() => (window as any).boom(), 0));
    await page.evaluate(() => {
      Promise.reject(new Error("rejected in e2e"));
    });
    await page.evaluate(() => (window as any).oops.capture(new Error("manual e2e"), { level: "warning", tags: { page: "checkout" }, extra: { cart: 3 } }));
    await page.evaluate(() => (window as any).oops.message("checkout opened", "info", { tags: { step: "one" } }));

    const issues = await pollUntil(
      () => listIssues(request, account, project.id, { status: "all" }),
      (r) => r.total >= 4,
    );
    expect(issues.total).toBe(4);
    const byTitle = (re: RegExp) => issues.items.find((i) => re.test(i.title))!;
    const uncaught = byTitle(/checkout is not a function/);
    const rejected = byTitle(/rejected in e2e/);
    const manual = byTitle(/manual e2e/);
    const message = byTitle(/checkout opened/);
    expect(uncaught.title).toBe("TypeError: checkout is not a function");
    expect(uncaught.level).toBe("error");
    expect(rejected.title).toBe("Error: rejected in e2e");
    expect(manual.level).toBe("warning");
    expect(message.level).toBe("info");
    expect(message.type ?? null).toBeNull();
    for (const i of [uncaught, rejected, manual, message]) {
      expect(i.event_count).toBe(1);
      expect(i.user_count).toBe(1);
      expect(i.environments).toEqual(["staging"]);
      expect(i.releases).toEqual(["e2e-1"]);
    }

    const ev = (await getIssue(request, account, project.id, uncaught.id)).latest_event!;
    expect(ev.source).toBe("sdk");
    expect(ev.platform).toBe("javascript");
    expect(ev.sdk).toBe("oops-js/0.1.0");
    expect(ev.environment).toBe("staging");
    expect(ev.release).toBe("e2e-1");
    expect(ev.url).toBe("https://host.example/app/pay");
    expect(ev.hostname).toBe("host.example");
    expect(ev.path).toBe("/app/pay");
    expect(ev.user).toMatchObject({ id: "u_42", email: "ada@example.com" }); // replayed from window.oops.q
    expect(ev.tags).toMatchObject({ plan: "pro" });
    expect(ev.browser).toBe("Chrome");
    expect(ev.device).toBe("desktop");
    expect(ev.stack_raw).toContain("boom");
    expect(ev.frames.length).toBeGreaterThanOrEqual(1);
    const top = ev.frames[0]!;
    expect(top.function).toBe("boom");
    expect(top.filename).toMatch(/^https:\/\/host\.example\/app\/checkout/);
    expect(top.in_app).toBe(true);
    expect(top.lineno).toBeGreaterThan(0);
    expect(uncaught.culprit).toContain("boom");

    const categories = ev.breadcrumbs.map((b) => b.category);
    expect(categories).toEqual(expect.arrayContaining(["click", "navigation", "fetch"]));
    const click = ev.breadcrumbs.find((b) => b.category === "click")!;
    expect(click.message).toBe("button#pay.btn.primary");
    expect(click.data).toMatchObject({ text: "Pay now" });
    expect(click.ts).toBeTruthy();
    const nav = ev.breadcrumbs.find((b) => b.category === "navigation")!;
    expect(nav.message).toBe("/app/pay");
    expect(nav.data).toMatchObject({ from: "/app/checkout?x=1", to: "/app/pay" });
    const failed = ev.breadcrumbs.find((b) => b.category === "fetch")!;
    expect(failed.message).toBe("GET https://host.example/api/broken");
    expect(failed.level).toBe("error");
    expect(failed.data).toMatchObject({ status: 500 });
    expect(JSON.stringify(ev.breadcrumbs)).not.toContain("SECRET");

    const manualEvent = (await getIssue(request, account, project.id, manual.id)).latest_event!;
    expect(manualEvent.level).toBe("warning");
    expect(manualEvent.tags).toEqual({ plan: "pro", page: "checkout" });
    expect(manualEvent.extra).toMatchObject({ cart: 3 });
    expect(manualEvent.source).toBe("sdk");
    const messageEvent = (await getIssue(request, account, project.id, message.id)).latest_event!;
    expect(messageEvent.message).toBe("checkout opened");
    expect(messageEvent.tags).toEqual({ plan: "pro", step: "one" });
    expect(messageEvent.frames).toEqual([]);

    // Only the two errors the page threw on purpose; nothing from the SDK.
    expect(pageErrors.every((m) => /checkout is not a function|rejected in e2e/.test(m))).toBe(true);
    expect(pageErrors.length).toBe(2);
  });

  test("dedup within 2 s, setUser / setContext / breadcrumb, bad key never throws", async ({ page, request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    await serveHost(page, project.public_key);
    await page.evaluate(() => {
      const o = (window as any).oops;
      o.setUser({ id: "u_7", name: "Grace" });
      o.setContext("cart", { items: 2 });
      o.breadcrumb({ category: "ui", message: "modal opened", data: { id: "pay" } });
      // Twice within 2 s: one event.
      o.capture(new Error("twice"), { fingerprint: ["twice"] });
      o.capture(new Error("twice"), { fingerprint: ["twice"] });
      // The API is forgiving.
      o.capture();
      o.setTags(null);
      o.breadcrumb();
      o.flush();
    });
    const issues = await pollUntil(
      () => listIssues(request, account, project.id),
      (r) => r.total >= 1,
    );
    await page.waitForTimeout(1000);
    const again = await listIssues(request, account, project.id);
    expect(again.total).toBe(1);
    expect(again.items[0]!.event_count).toBe(1);
    const ev = (await getIssue(request, account, project.id, issues.items[0]!.id)).latest_event!;
    expect(ev.user).toMatchObject({ id: "u_7", name: "Grace" });
    expect(ev.extra).toMatchObject({ cart: { items: 2 } });
    const crumb = ev.breadcrumbs.find((b) => b.category === "ui")!;
    expect(crumb.message).toBe("modal opened");
    expect(crumb.data).toMatchObject({ id: "pay" });
    expect(pageErrors).toEqual([]);

    // After the window the same error is a new occurrence.
    await page.waitForTimeout(1200);
    await page.evaluate(() => (window as any).oops.capture(new Error("twice"), { fingerprint: ["twice"] }));
    const after = await pollUntil(
      () => getIssue(request, account, project.id, issues.items[0]!.id),
      (i) => i.event_count >= 2,
    );
    expect(after.event_count).toBe(2);

    // A bad key: the API answers 401 to the beacon, the page never notices.
    const page2 = await page.context().newPage();
    const errors2: string[] = [];
    page2.on("pageerror", (e) => errors2.push(e.message));
    await serveHost(page2, "oops_pub_invalid");
    await page2.evaluate(() => setTimeout(() => (window as any).boom(), 0));
    await page2.evaluate(() => (window as any).oops.message("ignored"));
    await page2.waitForTimeout(600);
    expect(errors2).toEqual(["checkout is not a function"]);
    await page2.close();
  });

  test("local pages are skipped by default and reported with data-local", async ({ page, request }) => {
    test.skip(!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL), "needs the stack on localhost to be a local page");
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    await page.goto("/signup"); // the app itself, on localhost

    const inject = async (attrs: Record<string, string>) =>
      page.evaluate(
        async ([src, key, api, extra]) => {
          await new Promise<void>((resolve) => {
            const s = document.createElement("script");
            s.src = src;
            s.setAttribute("data-key", key);
            s.setAttribute("data-api", api);
            for (const [k, v] of Object.entries(extra)) s.setAttribute(k, v);
            s.onload = () => resolve();
            document.body.appendChild(s);
          });
        },
        [SDK_URL, project.public_key, INGEST, attrs] as const,
      );

    await inject({});
    await page.evaluate(() => (window as any).oops.capture(new Error("should not send")));
    await page.waitForTimeout(800);
    expect((await listEvents(request, account, project.id)).total).toBe(0);

    await inject({ "data-local": "true" });
    await page.evaluate(() => (window as any).oops.capture(new Error("local but allowed")));
    const events = await pollUntil(
      () => listEvents(request, account, project.id),
      (r) => r.total >= 1,
    );
    expect(events.total).toBe(1);
    expect(events.items[0]!.message).toBe("local but allowed");
    expect(events.items[0]!.source).toBe("sdk");
  });
});
