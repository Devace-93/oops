import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BASE_URL } from "./playwright.config";

export const API_URL = `${BASE_URL}/api`;
export const MCP_URL = `${BASE_URL}/mcp`;
export const TRACKER_URL = `${BASE_URL}/m.js`;

/** localStorage keys used by apps/web/src/lib/auth.ts (see CONTRACT.md). */
export const ACCESS_KEY = "oops_access_token";
export const REFRESH_KEY = "oops_refresh_token";

export const PASSWORD = "E2e-Passw0rd!";

/**
 * A realistic desktop UA for API-level collect calls. Playwright's default
 * request UA and headless Chrome both match the API's bot filter (on purpose),
 * so every e2e hit sets this explicitly.
 */
export const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
export const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export type Role = "viewer" | "editor" | "admin";

export interface Account {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  accountId: string;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  public_key: string;
  public_key_prefix: string;
  timezone: string;
  allowed_origins: string[];
  collect_enabled: boolean;
  exclude_bots: boolean;
  store_ip: boolean;
  counts: { pageviews_30d: number; visitors_30d: number; pageviews_today: number; last_event_at: string | null };
}

export function uniqueEmail(tag = "e2e"): string {
  return `${tag}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export function uniqueName(prefix = "E2E site"): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Create a fresh account through the API. Never reuses existing data. */
export async function registerAccount(
  request: APIRequestContext,
  opts: { email?: string; accountName?: string } = {},
): Promise<Account> {
  const email = opts.email ?? uniqueEmail();
  const res = await request.post(`${API_URL}/auth/register`, {
    data: { email, password: PASSWORD, account_name: opts.accountName },
  });
  expect(res.status(), `register ${email}: ${await res.text()}`).toBe(201);
  const body = await res.json();
  return {
    email,
    password: PASSWORD,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    userId: body.user.id,
    accountId: body.account.id,
  };
}

export function jwtHeaders(account: Pick<Account, "accessToken">) {
  return { Authorization: `Bearer ${account.accessToken}` };
}

export function keyHeaders(key: string) {
  return { "X-API-Key": key };
}

/** POST /api/projects with a JWT. Returns the project including its public key. */
export async function createProject(
  request: APIRequestContext,
  account: Account,
  opts: { name?: string; url?: string; timezone?: string; allowed_origins?: string[] } = {},
): Promise<Project> {
  const res = await request.post(`${API_URL}/projects`, {
    headers: jwtHeaders(account),
    data: { name: opts.name ?? uniqueName(), url: opts.url, timezone: opts.timezone, allowed_origins: opts.allowed_origins },
  });
  expect(res.status(), `create project: ${await res.text()}`).toBe(201);
  return res.json();
}

/** PATCH /api/projects/:id. */
export async function patchProject(
  request: APIRequestContext,
  account: Account,
  projectId: string,
  patch: Record<string, unknown>,
): Promise<Project> {
  const res = await request.patch(`${API_URL}/projects/${projectId}`, {
    headers: jwtHeaders(account),
    data: patch,
  });
  expect(res.status(), `patch project: ${await res.text()}`).toBe(200);
  return res.json();
}

/** POST /api/apikeys with a JWT. Returns the one-time secret plus metadata. */
export async function createApiKey(
  request: APIRequestContext,
  account: Account,
  name: string,
  role: Role,
): Promise<{ id: string; key: string; prefix: string; role: Role }> {
  const res = await request.post(`${API_URL}/apikeys`, {
    headers: jwtHeaders(account),
    data: { name, role },
  });
  expect(res.status(), `create api key: ${await res.text()}`).toBe(201);
  return res.json();
}

/** Send one hit through the public collect API (JSON + header, desktop UA by default). */
export async function collect(
  request: APIRequestContext,
  publicKey: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: any }> {
  const res = await request.post(`${API_URL}/collect`, {
    headers: { "X-Project-Key": publicKey, "User-Agent": DESKTOP_UA, ...headers },
    data: body,
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status(), body: parsed };
}

/** GET /api/projects/:id/stats as the owner. */
export async function stats(
  request: APIRequestContext,
  account: Account,
  projectId: string,
  query: Record<string, string> = { period: "today" },
): Promise<any> {
  const qs = new URLSearchParams(query).toString();
  const res = await request.get(`${API_URL}/projects/${projectId}/stats${qs ? `?${qs}` : ""}`, {
    headers: jwtHeaders(account),
  });
  expect(res.status(), `stats: ${await res.text()}`).toBe(200);
  return res.json();
}

/** GET /api/projects/:id/events as the owner. */
export async function listEvents(
  request: APIRequestContext,
  account: Account,
  projectId: string,
  query: Record<string, string> = { period: "today" },
): Promise<{ items: any[]; total: number }> {
  const qs = new URLSearchParams(query).toString();
  const res = await request.get(`${API_URL}/projects/${projectId}/events${qs ? `?${qs}` : ""}`, {
    headers: jwtHeaders(account),
  });
  expect(res.status(), `events: ${await res.text()}`).toBe(200);
  return res.json();
}

/**
 * Seed the browser session with API-issued tokens (fast path for dashboard
 * tests). The app reads them from localStorage on hydration. Must be called
 * after the page is on the app origin (localStorage is origin-scoped).
 */
export async function seedSession(page: Page, account: Account): Promise<void> {
  await page.goto("/login");
  await page.evaluate(
    ([ak, rk, at, rt]) => {
      localStorage.setItem(ak, at);
      localStorage.setItem(rk, rt);
    },
    [ACCESS_KEY, REFRESH_KEY, account.accessToken, account.refreshToken] as const,
  );
}

/** Log in through the real /login form. */
export async function loginViaUi(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/?$/);
}

/** Poll an async condition until it holds. */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (v: T) => boolean,
  { timeoutMs = 15_000, intervalMs = 500 } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T = await fn();
  while (!predicate(last) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    last = await fn();
  }
  return last;
}
