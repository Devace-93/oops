import { test, expect, type Page } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import { TRACKER_URL, createProject, listEvents, pollUntil, registerAccount } from "../helpers";

/**
 * The tracker script on a third-party-looking host page. The page is served
 * from a fake host URL (routed), loads /m.js from the running stack and posts
 * hits cross-origin exactly like a customer site would.
 */
const HOST_ORIGIN = "https://host.example";

async function serveHost(page: Page, projectKey: string, extraAttrs = ""): Promise<void> {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Host app</title></head>
<body>
  <h1>Host app</h1>
  <a id="go" href="#">go</a>
  <button id="cta" data-oops-event="cta_click" data-oops-props='{"where":"hero"}'>CTA</button>
  <script defer src="${TRACKER_URL}" data-key="${projectKey}" data-api="${BASE_URL}/api/collect" ${extraAttrs}></script>
</body></html>`;
  await page.route(`${HOST_ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto(`${HOST_ORIGIN}/app/editor?utm_source=e2e`, { referer: "https://google.com/" });
}

test.describe("tracker", () => {
  test("@critical page view on load, SPA route change, custom event via API and via data attribute", async ({ page, request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await serveHost(page, project.public_key);
    await page.waitForFunction(() => typeof (window as any).oops?.track === "function");

    // SPA navigation + a custom event from JS + a declarative click.
    await page.evaluate(() => {
      history.pushState({}, "", "/app/settings");
      (window as any).oops.track("saved", { items: 3 });
    });
    await page.click("#cta");

    const events = await pollUntil(
      () => listEvents(request, account, project.id),
      (r) => r.total >= 4,
    );
    expect(events.total).toBe(4);
    const paths = events.items.filter((e) => e.kind === "pageview").map((e) => e.path).sort();
    expect(paths).toEqual(["/app/editor", "/app/settings"]);
    const first = events.items.find((e) => e.path === "/app/editor")!;
    expect(first.hostname).toBe("host.example");
    expect(first.referrer_host).toBe("google.com");
    expect(first.utm_source).toBe("e2e");
    expect(first.title).toBe("Host app");
    expect(first.source).toBe("script");
    const saved = events.items.find((e) => e.name === "saved")!;
    expect(saved.props).toEqual({ items: 3 });
    const cta = events.items.find((e) => e.name === "cta_click")!;
    expect(cta.props).toEqual({ where: "hero" });
    expect(errors).toEqual([]);
  });

  test("never throws into the host page with a bad key, and skips localhost by default", async ({ page, request }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await serveHost(page, "oops_pub_invalid");
    await page.waitForFunction(() => typeof (window as any).oops?.track === "function");
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);

    // On localhost the script installs the facade but sends nothing.
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    await page.goto(`/signup`); // the app itself, on localhost
    await page.evaluate(
      async ([src, key, api]) => {
        await new Promise<void>((resolve) => {
          const s = document.createElement("script");
          s.src = src;
          s.setAttribute("data-key", key);
          s.setAttribute("data-api", api);
          s.onload = () => resolve();
          document.body.appendChild(s);
        });
        (window as any).oops.track("should_not_send");
      },
      [TRACKER_URL, project.public_key, `${BASE_URL}/api/collect`] as const,
    );
    await page.waitForTimeout(800);
    expect((await listEvents(request, account, project.id)).total).toBe(0);
  });
});
