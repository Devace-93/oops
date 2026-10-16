import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { BASE_URL } from "./playwright.config";

export const API_URL = `${BASE_URL}/api`;
export const MCP_URL = `${BASE_URL}/mcp`;
export const SDK_URL = `${BASE_URL}/o.js`;

/** localStorage keys used by apps/web/src/lib/auth.ts. */
export const ACCESS_KEY = "oops_access_token";
export const REFRESH_KEY = "oops_refresh_token";

export const PASSWORD = "E2e-Passw0rd!";

/** A realistic desktop UA for API-level ingest calls (parsed into browser / os / device). */
export const DESKTOP_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/** A V8 stack whose top frame is `init` in x.js:12:4 (matches the CONTRACT example). */
export const V8_STACK = [
  "TypeError: x is not a function",
  "    at init (https://app.example/js/x.js:12:4)",
  "    at main (https://app.example/js/main.js:1:200)",
  "    at https://cdn.example/lib.min.js:5:1234",
].join("\n");

/** The same stack in Firefox / Safari format. */
export const GECKO_STACK = ["init@https://app.example/js/x.js:12:4", "main@https://app.example/js/main.js:1:200", "@https://cdn.example/lib.min.js:5:1234"].join("\n");

export type Role = "viewer" | "editor" | "admin";
export type IssueStatus = "open" | "resolved" | "ignored";

export interface Account {
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  accountId: string;
}

/** Who calls the management API: the owner's JWT or an API key. */
export type Auth = Pick<Account, "accessToken"> | { apiKey: string };

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  url?: string | null;
  public_key: string;
  public_key_prefix: string;
  timezone: string;
  allowed_origins: string[];
  ingest_enabled: boolean;
  store_ip: boolean;
  counts: { open_issues: number; events_24h: number; events_30d: number; users_30d: number; last_event_at?: string | null };
  created_at: string;
  updated_at: string;
}

export interface Frame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
}

export interface Breadcrumb {
  ts?: string;
  category: string;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
}

export interface Event {
  id: string;
  project_id: string;
  issue_id: string;
  issue_number: number;
  ts: string;
  level: string;
  type?: string | null;
  message: string;
  frames: Frame[];
  stack_raw?: string | null;
  url?: string | null;
  path?: string | null;
  hostname?: string | null;
  release?: string | null;
  environment: string;
  platform?: string | null;
  sdk?: string | null;
  user?: { id?: string; email?: string; name?: string } | null;
  user_hash: string;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  ip?: string | null;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
  source: "sdk" | "api";
}

export interface Issue {
  id: string;
  project_id: string;
  number: number;
  fingerprint: string;
  title: string;
  culprit?: string | null;
  type?: string | null;
  level: string;
  status: IssueStatus;
  first_seen: string;
  last_seen: string;
  resolved_at?: string | null;
  regressed_at?: string | null;
  event_count: number;
  user_count: number;
  environments: string[];
  releases: string[];
  latest_event_id?: string | null;
  latest_event?: Event;
  created_at: string;
  updated_at: string;
}

export interface Paged<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export type IngestResult = { ok: true; event_id: string; issue_id: string; issue_number: number } | { ok: false; reason: string };

export interface HttpResult<T = any> {
  status: number;
  body: T;
  headers: Record<string, string>;
}

export function uniqueEmail(tag = "e2e"): string {
  return `${tag}+${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export function uniqueName(prefix = "E2E app"): string {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Register a fresh account through the API and return its tokens. */
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

export function authHeaders(auth: Auth): Record<string, string> {
  return "apiKey" in auth ? keyHeaders(auth.apiKey) : jwtHeaders(auth);
}

async function parseBody(text: string): Promise<any> {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Generic management call; returns status + parsed body without asserting. */
export async function call<T = any>(
  request: APIRequestContext,
  method: "get" | "post" | "patch" | "delete" | "put",
  path: string,
  auth: Auth | null,
  opts: { data?: unknown; query?: Record<string, string>; headers?: Record<string, string> } = {},
): Promise<HttpResult<T>> {
  const qs = opts.query ? new URLSearchParams(opts.query).toString() : "";
  const res = await request[method](`${API_URL}${path}${qs ? `?${qs}` : ""}`, {
    headers: { ...(auth ? authHeaders(auth) : {}), ...(opts.headers ?? {}) },
    data: opts.data,
  });
  return { status: res.status(), body: await parseBody(await res.text()), headers: res.headers() };
}

async function expectOk<T>(promise: Promise<HttpResult<T>>, what: string, status = 200): Promise<T> {
  const r = await promise;
  expect(r.status, `${what}: ${JSON.stringify(r.body)}`).toBe(status);
  return r.body;
}

/** POST /api/projects with a JWT. Returns the project including its public key. */
export async function createProject(
  request: APIRequestContext,
  account: Account,
  opts: { name?: string; key?: string; description?: string; url?: string; timezone?: string; allowed_origins?: string[] } = {},
): Promise<Project> {
  return expectOk(
    call<Project>(request, "post", "/projects", account, {
      data: {
        name: opts.name ?? uniqueName(),
        key: opts.key,
        description: opts.description,
        url: opts.url,
        timezone: opts.timezone,
        allowed_origins: opts.allowed_origins,
      },
    }),
    "create project",
    201,
  );
}

export async function getProject(request: APIRequestContext, auth: Auth, projectId: string): Promise<Project> {
  return expectOk(call<Project>(request, "get", `/projects/${projectId}`, auth), "get project");
}

/** PATCH /api/projects/:id. */
export async function patchProject(request: APIRequestContext, auth: Auth, projectId: string, patch: Record<string, unknown>): Promise<Project> {
  return expectOk(call<Project>(request, "patch", `/projects/${projectId}`, auth, { data: patch }), "patch project");
}

/** POST /api/apikeys with a JWT. Returns the one-time secret plus metadata. */
export async function createApiKey(
  request: APIRequestContext,
  account: Account,
  role: Role,
  name = `${role} key`,
): Promise<{ id: string; name: string; role: Role; prefix: string; secret: string }> {
  const body = await expectOk(call(request, "post", "/apikeys", account, { data: { name, role } }), "create api key", 201);
  return { ...body.key, secret: body.secret };
}

/**
 * Send one event through the public ingest API. By default JSON with the key
 * in `X-Project-Key`; `textPlain` posts a `text/plain` body with `k` inside,
 * which is what the SDK does (no CORS preflight).
 */
export async function ingest(
  request: APIRequestContext,
  publicKey: string,
  payload: Record<string, unknown>,
  opts: { textPlain?: boolean; headers?: Record<string, string>; path?: string; rawBody?: string } = {},
): Promise<HttpResult<IngestResult | { error: { code: string; message: string } }>> {
  const path = opts.path ?? "/ingest";
  const headers: Record<string, string> = { "User-Agent": DESKTOP_UA, ...(opts.headers ?? {}) };
  let data: unknown;
  if (opts.rawBody !== undefined) {
    headers["Content-Type"] = headers["Content-Type"] ?? "text/plain";
    data = opts.rawBody;
  } else if (opts.textPlain) {
    headers["Content-Type"] = "text/plain";
    data = JSON.stringify({ k: publicKey, ...payload });
  } else {
    headers["X-Project-Key"] = publicKey;
    data = payload;
  }
  const res = await request.post(`${API_URL}${path}`, { headers, data });
  return { status: res.status(), body: await parseBody(await res.text()), headers: res.headers() };
}

/** `ingest` that must succeed: 202 + ok:true; returns the per-event result. */
export async function ingestOk(
  request: APIRequestContext,
  publicKey: string,
  payload: Record<string, unknown>,
  opts: Parameters<typeof ingest>[3] = {},
): Promise<Extract<IngestResult, { ok: true }>> {
  const r = await ingest(request, publicKey, payload, opts);
  expect(r.status, `ingest: ${JSON.stringify(r.body)}`).toBe(202);
  expect((r.body as IngestResult).ok, `ingest dropped: ${JSON.stringify(r.body)}`).toBe(true);
  return r.body as Extract<IngestResult, { ok: true }>;
}

/** POST /api/ingest/batch. */
export async function ingestBatch(
  request: APIRequestContext,
  publicKey: string,
  events: Record<string, unknown>[],
  headers: Record<string, string> = {},
): Promise<HttpResult<{ ok: boolean; results: IngestResult[] }>> {
  return ingest(request, publicKey, { events }, { path: "/ingest/batch", headers }) as Promise<HttpResult<any>>;
}

/** GET /api/projects/:id/issues. Default `status` is `open` server-side. */
export async function listIssues(request: APIRequestContext, auth: Auth, projectId: string, query: Record<string, string> = {}): Promise<Paged<Issue>> {
  return expectOk(call<Paged<Issue>>(request, "get", `/projects/${projectId}/issues`, auth, { query }), "list issues");
}

/** GET /api/projects/:id/issues/:issue (uuid or project number) → Issue with latest_event. */
export async function getIssue(request: APIRequestContext, auth: Auth, projectId: string, issueId: string | number): Promise<Issue> {
  return expectOk(call<Issue>(request, "get", `/projects/${projectId}/issues/${issueId}`, auth), "get issue");
}

/** PATCH /api/projects/:id/issues/:issue { status }. */
export async function patchIssue(request: APIRequestContext, auth: Auth, projectId: string, issueId: string, status: IssueStatus): Promise<Issue> {
  return expectOk(call<Issue>(request, "patch", `/projects/${projectId}/issues/${issueId}`, auth, { data: { status } }), "patch issue");
}

/** GET /api/projects/:id/issues/:issue/events, newest first. */
export async function listIssueEvents(
  request: APIRequestContext,
  auth: Auth,
  projectId: string,
  issueId: string,
  query: Record<string, string> = {},
): Promise<Paged<Event>> {
  return expectOk(call<Paged<Event>>(request, "get", `/projects/${projectId}/issues/${issueId}/events`, auth, { query }), "issue events");
}

/** GET /api/projects/:id/events. */
export async function listEvents(request: APIRequestContext, auth: Auth, projectId: string, query: Record<string, string> = {}): Promise<Paged<Event>> {
  return expectOk(call<Paged<Event>>(request, "get", `/projects/${projectId}/events`, auth, { query }), "events");
}

/** GET /api/projects/:id/stats. */
export async function stats(request: APIRequestContext, auth: Auth, projectId: string, query: Record<string, string> = {}): Promise<any> {
  return expectOk(call(request, "get", `/projects/${projectId}/stats`, auth, { query }), "stats");
}

/** GET /api/projects/:id/summary. */
export async function summary(
  request: APIRequestContext,
  auth: Auth,
  projectId: string,
): Promise<{ open_issues: number; events_24h: number; events_30d: number; users_30d: number; last_event_at: string | null }> {
  return expectOk(call(request, "get", `/projects/${projectId}/summary`, auth), "summary");
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

/** Log in through the real /login form (labels "Email" / "Password", button "Log in"). */
export async function loginUi(page: Page, account: Pick<Account, "email" | "password">): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: /log in/i }).click();
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
