import { test, expect } from "@playwright/test";
import { API_URL, collect, jwtHeaders, registerAccount, seedSession, uniqueName } from "../helpers";

/**
 * Create a project in the dashboard → its settings show the public key and the
 * install snippet → hits appear on the overview with the chart, KPI tiles and
 * breakdowns → filters work.
 */
test.describe("projects", () => {
  test("@critical create a project, read its public key, see hits on the overview", async ({ page, request }) => {
    const account = await registerAccount(request);
    await seedSession(page, account);
    const name = uniqueName();

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill(name);
    await page.getByRole("button", { name: /^create/i }).click();

    // Lands on settings: public key + snippet with the real key.
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]+\/settings/);
    const key = page.locator("[data-public-key]");
    await expect(key).toBeVisible();
    const publicKey = (await key.getAttribute("data-public-key")) ?? "";
    expect(publicKey).toMatch(/^oops_pub_/);
    await expect(page.getByTestId("snippet")).toContainText("m.js");
    await expect(page.getByTestId("snippet")).toContainText(publicKey);

    // Send a few hits through the API and look at the overview.
    const projectId = page.url().match(/projects\/([0-9a-f-]+)/)![1]!;
    for (const u of ["https://site.example/", "https://site.example/docs", "https://site.example/docs"]) {
      expect((await collect(request, publicKey, { u })).body.ok).toBe(true);
    }
    await page.goto(`/dashboard/projects/${projectId}`);
    await expect(page.getByTestId("kpis")).toBeVisible();
    await expect(page.getByTestId("kpis")).toContainText("3"); // page views
    await expect(page.getByRole("img", { name: /page views/i })).toBeVisible(); // the chart
    await expect(page.locator("[data-breakdown='path']")).toContainText("/docs");
    await expect(page.getByTestId("live-visitors")).toContainText("1");

    // Clicking a page filters the whole overview.
    await page.locator("[data-breakdown='path']").getByRole("button", { name: /\/docs/ }).click();
    await expect(page.getByTestId("active-filters")).toContainText("/docs");
    await expect(page.getByTestId("kpis")).toContainText("2");

    // The API agrees.
    const res = await request.get(`${API_URL}/projects/${projectId}`, { headers: jwtHeaders(account) });
    expect(res.status()).toBe(200);
    const project = await res.json();
    expect(project.public_key).toBe(publicKey);
    expect(project.counts.pageviews_30d).toBe(3);
  });

  test("a project of another account is a 404, never a 403", async ({ request }) => {
    const owner = await registerAccount(request);
    const other = await registerAccount(request);
    const created = await request.post(`${API_URL}/projects`, { headers: jwtHeaders(owner), data: { name: uniqueName() } });
    expect(created.status()).toBe(201);
    const { id } = await created.json();
    const res = await request.get(`${API_URL}/projects/${id}`, { headers: jwtHeaders(other) });
    expect(res.status()).toBe(404);
    const st = await request.get(`${API_URL}/projects/${id}/stats`, { headers: jwtHeaders(other) });
    expect(st.status()).toBe(404);
  });

  test("API keys: viewer can read stats but not change the project; events page lists hits", async ({ page, request }) => {
    const account = await registerAccount(request);
    const created = await request.post(`${API_URL}/projects`, { headers: jwtHeaders(account), data: { name: uniqueName() } });
    const project = await created.json();
    await collect(request, project.public_key, { u: "https://site.example/hello", n: "wave", p: { hi: true } });

    const viewer = await request.post(`${API_URL}/apikeys`, { headers: jwtHeaders(account), data: { name: "ro", role: "viewer" } });
    expect(viewer.status()).toBe(201);
    const { key } = await viewer.json();
    const st = await request.get(`${API_URL}/projects/${project.id}/stats?period=today`, { headers: { "X-API-Key": key } });
    expect(st.status()).toBe(200);
    expect((await st.json()).totals.events).toBe(1);
    const denied = await request.patch(`${API_URL}/projects/${project.id}`, { headers: { "X-API-Key": key }, data: { name: "x" } });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).error.code).toBe("insufficient_scope");

    await seedSession(page, account);
    await page.goto(`/dashboard/projects/${project.id}/events`);
    await expect(page.getByTestId("events-table")).toContainText("/hello");
    await expect(page.getByTestId("events-table")).toContainText("wave");
  });
});
