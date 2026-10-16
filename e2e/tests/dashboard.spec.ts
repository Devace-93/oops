import { test, expect, type Page } from "@playwright/test";
import { getIssue, ingestOk, listIssues, loginUi, pollUntil, registerAccount, uniqueName } from "../helpers";

/**
 * The dashboard end to end: log in through the form, create a project, read
 * the snippet with the public key in settings, see ingested issues in the
 * project inbox, triage one from the UI (Resolve / Ignore), watch the status
 * tabs follow.
 *
 * UI vocabulary this spec depends on (see e2e/README.md):
 *   - /login: labels "Email", "Password", button "Log in" → /dashboard
 *   - /dashboard: button "New project", input labelled "Project name", button "Create…" → /dashboard/projects/<id>/settings
 *   - settings: an element with [data-public-key="oops_pub_…"], data-testid="snippet" containing "o.js" and the key
 *   - /dashboard/projects/<id>: the inbox lists issue titles as links; tabs "Open" / "Resolved" / "Ignored" / "All" with counts
 *   - issue page: buttons "Resolve", "Ignore", "Reopen"; the status word is shown
 */
const statusTab = (page: Page, name: "Open" | "Resolved" | "Ignored" | "All") => {
  const re = new RegExp(`^${name}\\b`);
  return page.getByRole("tab", { name: re }).or(page.getByRole("link", { name: re })).or(page.getByRole("button", { name: re })).first();
};

test.describe("dashboard", () => {
  test("@critical log in, create a project, see the snippet, triage an issue from the inbox", async ({ page, request }) => {
    const account = await registerAccount(request);
    await loginUi(page, account);
    const name = uniqueName();

    // Create a project from the dashboard; land on its settings.
    await page.getByRole("button", { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill(name);
    await page.getByRole("button", { name: /^create/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]+\/settings/);
    const projectId = page.url().match(/projects\/([0-9a-f-]+)/)![1]!;

    // Settings show the public key and the install snippet with it.
    const keyEl = page.locator("[data-public-key]");
    await expect(keyEl).toBeVisible();
    const publicKey = (await keyEl.getAttribute("data-public-key")) ?? "";
    expect(publicKey).toMatch(/^oops_pub_/);
    await expect(page.getByTestId("snippet")).toContainText("o.js");
    await expect(page.getByTestId("snippet")).toContainText(publicKey);

    // Ingest through the API: one issue with two events, one warning.
    const first = await ingestOk(request, publicKey, {
      type: "TypeError",
      message: "checkout button exploded",
      url: "https://shop.example/pay",
      user: { id: "u_1" },
      stack: "TypeError: checkout button exploded\n    at pay (https://shop.example/js/pay.js:12:4)",
    });
    // Same type, message and top frame → same issue (an event without a stack would group separately).
    await ingestOk(request, publicKey, {
      type: "TypeError",
      message: "checkout button exploded",
      url: "https://shop.example/pay",
      user: { id: "u_2" },
      stack: "TypeError: checkout button exploded\n    at pay (https://shop.example/js/pay.js:12:4)",
    });
    const warning = await ingestOk(request, publicKey, { type: "SyncWarning", message: "inventory sync drifted", level: "warning" });

    // The inbox lists both open issues.
    await page.goto(`/dashboard/projects/${projectId}`);
    const mainIssue = page.getByRole("link", { name: /checkout button exploded/ });
    await expect(mainIssue).toBeVisible();
    await expect(page.getByRole("link", { name: /inventory sync drifted/ })).toBeVisible();
    await expect(statusTab(page, "Open")).toContainText("2");

    // Open it and resolve from the UI.
    await mainIssue.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${projectId}/issues/`));
    await expect(page.getByRole("heading", { name: /checkout button exploded/ })).toBeVisible();
    await expect(page.getByText("pay.js").first()).toBeVisible(); // the top frame
    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen", exact: true })).toBeVisible();
    await expect(page.getByText(/^resolved$/i).first()).toBeVisible();
    const resolved = await pollUntil(
      () => getIssue(request, account, projectId, first.issue_id),
      (i) => i.status === "resolved",
    );
    expect(resolved.status).toBe("resolved");
    expect(resolved.event_count).toBe(2);
    expect(resolved.user_count).toBe(2);

    // The tabs follow: 1 open, 1 resolved; the resolved issue left the Open tab.
    await page.goto(`/dashboard/projects/${projectId}`);
    await expect(statusTab(page, "Open")).toContainText("1");
    await expect(statusTab(page, "Resolved")).toContainText("1");
    await expect(page.getByRole("link", { name: /checkout button exploded/ })).toHaveCount(0);
    await statusTab(page, "Resolved").click();
    await expect(page.getByRole("link", { name: /checkout button exploded/ })).toBeVisible();

    // Ignore the warning from its page.
    await statusTab(page, "Open").click();
    await page.getByRole("link", { name: /inventory sync drifted/ }).click();
    await page.getByRole("button", { name: "Ignore", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reopen", exact: true })).toBeVisible();
    const ignored = await pollUntil(
      () => getIssue(request, account, projectId, warning.issue_id),
      (i) => i.status === "ignored",
    );
    expect(ignored.status).toBe("ignored");
    await page.goto(`/dashboard/projects/${projectId}`);
    await expect(statusTab(page, "Open")).toContainText("0");
    await expect(statusTab(page, "Ignored")).toContainText("1");
    await statusTab(page, "All").click();
    await expect(page.getByRole("link", { name: /checkout button exploded/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /inventory sync drifted/ })).toBeVisible();

    // The API agrees.
    expect((await listIssues(request, account, projectId)).total).toBe(0);
    expect((await listIssues(request, account, projectId, { status: "all" })).total).toBe(2);
  });

  test("the dashboard lists the project; its card links to the project page", async ({ page, request }) => {
    const account = await registerAccount(request);
    const name = uniqueName();
    await loginUi(page, account);
    await page.getByRole("button", { name: /new project/i }).click();
    await page.getByLabel(/project name/i).fill(name);
    await page.getByRole("button", { name: /^create/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/projects\/[0-9a-f-]+\/settings/);
    const projectId = page.url().match(/projects\/([0-9a-f-]+)/)![1]!;

    await page.goto("/dashboard");
    const card = page.getByRole("link", { name: new RegExp(name) });
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/projects/${projectId}`));
    await expect(page.getByRole("heading", { name: new RegExp(name) })).toBeVisible();
  });
});
