import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite for oops. Runs against an already-running stack (docker compose):
 *   E2E_BASE_URL  base of the Caddy entrypoint (default http://localhost:8084)
 * The API lives under <base>/api, the MCP endpoint at <base>/mcp and the
 * browser SDK at <base>/o.js.
 *
 * The browser gets a normal desktop Chrome UA so events parse into a realistic
 * browser / os / device. Chromium's Local Network Access checks are disabled so
 * a routed "public" host page (https://host.example) can load /o.js from, and
 * post events to, the loopback stack, like a real site would to oops.3m4.net.
 */
export const BASE_URL = process.env.E2E_BASE_URL?.replace(/\/$/, "") || "http://localhost:8084";

const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

export default defineConfig({
  globalSetup: "./global-setup.ts",
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Files share nothing (each creates its own account), but several tests within
  // a file reuse one account/session, so keep each file sequential.
  fullyParallel: false,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    userAgent: DESKTOP_UA,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        userAgent: DESKTOP_UA,
        launchOptions: {
          args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults"],
        },
      },
    },
  ],
});
