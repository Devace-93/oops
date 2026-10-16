/**
 * Minimal typed HTTP client for the oops management API.
 *
 * Deliberately dependency-free (global `fetch`) so the MCP server stays small
 * and the client can be swapped for a fake in tests.
 */
import type {
  AuditEvent,
  Breakdown,
  CreateProjectInput,
  Dimension,
  EventsPage,
  EventsParams,
  KeyInfo,
  Live,
  Project,
  RotatedKey,
  Stats,
  StatsParams,
  Summary,
  UpdateProjectInput,
  Usage,
} from "./types.js";
import { VERSION } from "./version.js";

/** An error the API returned on purpose (`{ error: { code, message, ...extra } }`). */
export class OopsApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Extra error fields, e.g. `which` on `limit_reached`, `required_scope` on `insufficient_scope`. */
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "OopsApiError";
  }
}

export interface OopsClientOptions {
  /** Base URL including the `/api` prefix, e.g. `https://oops.3m4.net/api`. */
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
}

type Query = Record<string, string | number | boolean | undefined>;

const enc = encodeURIComponent;

function statsQuery(params: StatsParams = {}): Query {
  const { filters, ...rest } = params;
  return { ...rest, ...(filters ?? {}) } as Query;
}

export class OopsClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: OopsClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    opts: { query?: Query; body?: unknown } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      "X-API-Key": this.apiKey,
      Accept: "application/json",
      "User-Agent": `oops-errors-mcp/${VERSION}`,
    };
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await this.fetchImpl(url, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = ((data as { error?: Record<string, unknown> } | null)?.error ?? {}) as Record<
        string,
        unknown
      >;
      const { code, message, ...extra } = err;
      throw new OopsApiError(
        res.status,
        typeof code === "string" ? code : `http_${res.status}`,
        typeof message === "string" ? message : `HTTP ${res.status}`,
        extra,
      );
    }
    return data as T;
  }

  /** Identity + scopes of the calling key. */
  me(): Promise<KeyInfo> {
    return this.request("GET", "/apikeys/me");
  }

  // --- Projects ---------------------------------------------------------- //

  listProjects(params: { q?: string } = {}): Promise<{ items: Project[]; total: number }> {
    return this.request("GET", "/projects", { query: params });
  }

  createProject(input: CreateProjectInput): Promise<Project> {
    return this.request("POST", "/projects", { body: input });
  }

  getProject(id: string): Promise<Project> {
    return this.request("GET", `/projects/${enc(id)}`);
  }

  updateProject(id: string, patch: UpdateProjectInput): Promise<Project> {
    return this.request("PATCH", `/projects/${enc(id)}`, { body: patch });
  }

  deleteProject(id: string): Promise<void> {
    return this.request("DELETE", `/projects/${enc(id)}`);
  }

  rotateProjectKey(id: string): Promise<RotatedKey> {
    return this.request("POST", `/projects/${enc(id)}/rotate-key`);
  }

  summary(projectId: string): Promise<Summary> {
    return this.request("GET", `/projects/${enc(projectId)}/summary`);
  }

  purgeEvents(projectId: string, before?: string): Promise<{ deleted: number; before: string | null }> {
    return this.request("DELETE", `/projects/${enc(projectId)}/events`, { query: { before } });
  }

  // --- Stats ------------------------------------------------------------- //

  stats(projectId: string, params: StatsParams = {}): Promise<Stats> {
    return this.request("GET", `/projects/${enc(projectId)}/stats`, { query: statsQuery(params) });
  }

  breakdown(projectId: string, by: Dimension, params: StatsParams = {}, page = 1, per_page = 50): Promise<Breakdown> {
    return this.request("GET", `/projects/${enc(projectId)}/stats/breakdown`, {
      query: { ...statsQuery(params), by, page, per_page },
    });
  }

  events(projectId: string, params: EventsParams = {}): Promise<EventsPage> {
    const { kind, q, page, per_page, ...stats } = params;
    return this.request("GET", `/projects/${enc(projectId)}/events`, {
      query: { ...statsQuery(stats), kind, q, page, per_page },
    });
  }

  live(projectId: string): Promise<Live & { project_id: string }> {
    return this.request("GET", `/projects/${enc(projectId)}/live`);
  }

  // --- Account ----------------------------------------------------------- //

  usage(): Promise<Usage> {
    return this.request("GET", "/account/usage");
  }

  auditLog(params: { limit?: number; action?: string } = {}): Promise<{ items: AuditEvent[] }> {
    return this.request("GET", "/account/audit", { query: params });
  }
}
