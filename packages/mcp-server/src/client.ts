/**
 * Minimal typed HTTP client for the oops management API (and the ingest
 * endpoint, used by `report_error`).
 *
 * Deliberately dependency-free (global `fetch`) so the MCP server stays small
 * and the client can be swapped for a fake in tests.
 */
import type {
  AuditEvent,
  AuditParams,
  CreateProjectInput,
  Event,
  EventsParams,
  IngestEventInput,
  IngestResult,
  Issue,
  IssueStatus,
  IssuesParams,
  KeyInfo,
  Live,
  Page,
  Project,
  PurgeResult,
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
    opts: { query?: Query; body?: unknown; headers?: Record<string, string>; auth?: boolean } = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": `oops-errors-mcp/${VERSION}`,
      ...(opts.headers ?? {}),
    };
    if (opts.auth !== false) headers["X-API-Key"] = this.apiKey;
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

  listProjects(): Promise<{ items: Project[] }> {
    return this.request("GET", "/projects");
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

  /** New public key; the old one stops working at once. Returns the updated project. */
  rotatePublicKey(id: string): Promise<Project> {
    return this.request("POST", `/projects/${enc(id)}/rotate-key`);
  }

  summary(projectId: string): Promise<Summary> {
    return this.request("GET", `/projects/${enc(projectId)}/summary`);
  }

  /** Purge every event and issue of the project. */
  purgeEvents(projectId: string): Promise<PurgeResult> {
    return this.request("DELETE", `/projects/${enc(projectId)}/events`);
  }

  // --- Issues and events --------------------------------------------------- //

  listIssues(projectId: string, params: IssuesParams = {}): Promise<Page<Issue>> {
    return this.request("GET", `/projects/${enc(projectId)}/issues`, { query: params as Query });
  }

  /** `issueRef` is the issue uuid or its per-project number as a string (see `parseIssueRef`). */
  getIssue(projectId: string, issueRef: string): Promise<Issue> {
    return this.request("GET", `/projects/${enc(projectId)}/issues/${enc(issueRef)}`);
  }

  updateIssue(projectId: string, issueRef: string, status: IssueStatus): Promise<Issue> {
    return this.request("PATCH", `/projects/${enc(projectId)}/issues/${enc(issueRef)}`, { body: { status } });
  }

  bulkUpdateIssues(projectId: string, ids: string[], status: IssueStatus): Promise<{ updated: number }> {
    return this.request("POST", `/projects/${enc(projectId)}/issues/bulk`, { body: { ids, status } });
  }

  listIssueEvents(projectId: string, issueRef: string, params: { page?: number; per_page?: number } = {}): Promise<Page<Event>> {
    return this.request("GET", `/projects/${enc(projectId)}/issues/${enc(issueRef)}/events`, { query: params });
  }

  listEvents(projectId: string, params: EventsParams = {}): Promise<Page<Event>> {
    return this.request("GET", `/projects/${enc(projectId)}/events`, { query: params as Query });
  }

  getEvent(projectId: string, eventId: string): Promise<Event> {
    return this.request("GET", `/projects/${enc(projectId)}/events/${enc(eventId)}`);
  }

  // --- Stats ------------------------------------------------------------- //

  stats(projectId: string, params: StatsParams = {}): Promise<Stats> {
    return this.request("GET", `/projects/${enc(projectId)}/stats`, { query: params as Query });
  }

  live(projectId: string): Promise<Live> {
    return this.request("GET", `/projects/${enc(projectId)}/live`);
  }

  // --- Account ----------------------------------------------------------- //

  usage(): Promise<Usage> {
    return this.request("GET", "/account/usage");
  }

  auditLog(params: AuditParams = {}): Promise<Page<AuditEvent>> {
    return this.request("GET", "/account/audit", { query: params as Query });
  }

  // --- Ingest (project public key, no API key) ---------------------------- //

  /**
   * Report one event into a project. Authenticated with the project's PUBLIC
   * key (`X-Project-Key`), never the API key: that is the only credential the
   * ingest endpoint understands. Always 202; `ok: false` carries a drop reason.
   */
  ingest(publicKey: string, event: IngestEventInput): Promise<IngestResult> {
    return this.request("POST", "/ingest", {
      body: event,
      auth: false,
      headers: { "X-Project-Key": publicKey },
    });
  }
}
