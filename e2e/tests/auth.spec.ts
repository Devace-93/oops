import { test, expect } from "@playwright/test";
import { ACCESS_KEY, PASSWORD, registerAccount, uniqueEmail } from "../helpers";

/**
 * Sign-up → dashboard → log out from the marketing nav → log in again.
 * One account per run.
 */
test.describe("auth + session", () => {
  test("@critical sign up, land on the dashboard, log out, log in", async ({ page }) => {
    const email = uniqueEmail();

    await page.goto("/signup");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), ACCESS_KEY)).toBeTruthy();

    // Marketing nav resolves the session client-side.
    await page.goto("/");
    const authBox = page.getByRole("banner").locator("[data-auth-state]");
    await expect(authBox).toHaveAttribute("data-auth-state", "true");
    await authBox.getByRole("button", { name: /log out/i }).click();
    await expect(authBox).toHaveAttribute("data-auth-state", "false");
    expect(await page.evaluate((k) => localStorage.getItem(k), ACCESS_KEY)).toBeNull();

    // Dashboard is now guarded.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\/?$/);

    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/);
  });

  test("login rejects a wrong password", async ({ page, request }) => {
    const account = await registerAccount(request);
    await page.goto("/login");
    await page.getByLabel("Email").fill(account.email);
    await page.getByLabel("Password").fill("definitely-wrong-1");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/login\/?$/);
    await expect(page.locator("form").getByText(/invalid|incorrect|wrong|failed/i)).toBeVisible();
  });
});
