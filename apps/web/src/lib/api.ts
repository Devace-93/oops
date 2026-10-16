/**
 * API client for the oops Flask backend.
 *
 * - Base URL from VITE_API_URL (fallback "/api" — works behind Caddy).
 * - Attaches the bearer access token.
 * - On a 401, transparently refreshes via POST /auth/refresh (once) and retries.
 *
 * Throws `ApiRequestError` (carrying the parsed `error` body + HTTP status) so
 * callers can branch on e.g. 402 limit_reached (`error.which`).
 */
import { getAccessToken, getRefreshToken, setAccessToken, clearTokens } from "./auth";
import type {
  ApiError,
  ApiKey,
  ApiKeyRole,
  AuditEvent,
  AuthResponse,
  Breakdown,
  Dimension,
  EventKind,
  EventsPage,
  Live,
  MeResponse,
  Project,
  ProjectPatch,
  RolesResponse,
  Stats,
  StatsQuery,
  Summary,
  Usage,
} from "./types";

const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export class ApiRequestError extends Error {
  status: number;
  error: ApiError;
  constructor(status: number, error: ApiError) {
    super(error?.message || `Request failed (${status})`);
    this.name = "ApiRequestError";
    this.status = status;
    this.error = error;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip attaching/refreshing the bearer token (e.g. login/register). */
  auth?: boolean;
  headers?: Record<string, string>;
  /** Internal: prevents infinite refresh loops. */
  _retried?: boolean;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const data = await res.json();
    if (data?.error) return data.error as ApiError;
    return { code: "error", message: data?.message || res.statusText };
  } catch {
    return { code: "error", message: res.statusText || "Request failed" };
  }
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh_token = getRefreshToken();
  if (!refresh_token) return false;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = (await res.json()) as { access_token: string };
      setAccessToken(data.access_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function rawFetch(path: string, opts: RequestOptions = {}): Promise<Response> {
  const { method = "GET", body, auth = true, headers: extra = {}, _retried = false } = opts;

  const headers: Record<string, string> = { ...extra };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && auth && !_retried) {
    const ok = await tryRefresh();
    if (ok) return rawFetch(path, { ...opts, _retried: true });
    clearTokens();
  }

  if (!res.ok) {
    throw new ApiRequestError(res.status, await parseError(res));
  }
  return res;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await rawFetch(path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Build a query string from defined, non-empty values. */
function qs(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

function statsParams(query: StatsQuery = {}): Record<string, string | number | undefined> {
  return {
    period: query.from || query.to ? undefined : query.period,
    from: query.from,
    to: query.to,
    tz: query.tz,
    interval: query.interval,
    limit: query.limit,
    ...(query.filters ?? {}),
  };
}

const enc = encodeURIComponent;
const p = (id: string) => `/projects/${enc(id)}`;

export const api = {
  /* ─── Auth ───────────────────────────────────────────────────────────── */
  register: (email: string, password: string, account_name?: string) =>
    apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      auth: false,
      body: { email, password, account_name },
    }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>("/auth/login", { method: "POST", auth: false, body: { email, password } }),

  logout: (refresh_token: string) =>
    apiFetch<void>("/auth/logout", { method: "POST", body: { refresh_token } }),

  me: () => apiFetch<MeResponse>("/auth/me"),

  /* ─── Features (oops' own switches; public, used by anonymous pages) ── */
  features: () => apiFetch<{ features: Record<string, boolean> }>("/features", { auth: false }),

  /* ─── Projects ───────────────────────────────────────────────────────── */
  listProjects: (q = "") => apiFetch<{ items: Project[]; total: number }>(`/projects${qs({ q })}`),

  createProject: (input: { name: string; key?: string; description?: string; url?: string; timezone?: string }) =>
    apiFetch<Project>("/projects", { method: "POST", body: input }),

  getProject: (id: string) => apiFetch<Project>(p(id)),

  updateProject: (id: string, input: ProjectPatch) =>
    apiFetch<Project>(p(id), { method: "PATCH", body: input }),

  deleteProject: (id: string) => apiFetch<void>(p(id), { method: "DELETE" }),

  rotateProjectKey: (id: string) =>
    apiFetch<{ public_key: string; public_key_prefix: string }>(`${p(id)}/rotate-key`, { method: "POST" }),

  projectSummary: (id: string) => apiFetch<Summary>(`${p(id)}/summary`),

  purgeEvents: (id: string, before?: string) =>
    apiFetch<{ deleted: number; before: string | null }>(`${p(id)}/events${qs({ before })}`, { method: "DELETE" }),

  /* ─── Stats ──────────────────────────────────────────────────────────── */
  stats: (id: string, query: StatsQuery = {}) => apiFetch<Stats>(`${p(id)}/stats${qs(statsParams(query))}`),

  breakdown: (id: string, by: Dimension, query: StatsQuery = {}, page = 1, per_page = 50) =>
    apiFetch<Breakdown>(`${p(id)}/stats/breakdown${qs({ ...statsParams(query), by, page, per_page })}`),

  events: (id: string, query: StatsQuery = {}, opts: { page?: number; per_page?: number; kind?: EventKind | ""; q?: string } = {}) =>
    apiFetch<EventsPage>(
      `${p(id)}/events${qs({ ...statsParams(query), page: opts.page ?? 1, per_page: opts.per_page ?? 50, kind: opts.kind, q: opts.q })}`,
    ),

  live: (id: string) => apiFetch<Live & { project_id: string }>(`${p(id)}/live`),

  /* ─── Account ────────────────────────────────────────────────────────── */
  usage: () => apiFetch<Usage>("/account/usage"),

  audit: (limit = 50, action = "") =>
    apiFetch<{ items: AuditEvent[]; limit: number }>(`/account/audit${qs({ limit, action })}`),

  /* ─── API keys ───────────────────────────────────────────────────────── */
  listApiKeys: () => apiFetch<ApiKey[]>("/apikeys"),

  apiKeyRoles: () => apiFetch<RolesResponse>("/apikeys/roles", { auth: false }),

  createApiKey: (name: string, role: ApiKeyRole = "editor") =>
    apiFetch<{ id: string; key: string; prefix: string; name: string; role: ApiKeyRole }>("/apikeys", {
      method: "POST",
      body: { name, role },
    }),

  deleteApiKey: (id: string) => apiFetch<void>(`/apikeys/${enc(id)}`, { method: "DELETE" }),

  /* ─── Billing ────────────────────────────────────────────────────────── */
  billingOfferings: () => apiFetch<unknown>("/billing/offerings"),
};

/** Public base URL of the API, for docs snippets (e.g. curl examples). */
export const API_PUBLIC_BASE = BASE;
