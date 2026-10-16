/** Wire types of the oops REST API (see CONTRACT.md at the repo root, "Objects"). */

export type Role = "viewer" | "editor" | "admin";

export type Scope =
  | "projects:read"
  | "projects:write"
  | "projects:delete"
  | "issues:read"
  | "issues:write"
  | "events:delete"
  | "usage:read"
  | "audit:read";

export type Level = "fatal" | "error" | "warning" | "info";
export type IssueStatus = "open" | "resolved" | "ignored";
export type IssueStatusFilter = IssueStatus | "all";
export type IssuePeriod = "24h" | "7d" | "30d" | "90d" | "all";
export type IssueSort = "last_seen" | "first_seen" | "events" | "users";
export type StatsPeriod = "today" | "yesterday" | "24h" | "7d" | "30d" | "90d" | "12mo";
export type Interval = "hour" | "day" | "month";
/** Dimensions the API breaks events down by (`GET /stats` → `breakdowns`). */
export type Dimension = "level" | "environment" | "release" | "browser" | "os" | "device" | "type";
/** Dimensions accepted as filters on `/issues`, `/events` and `/stats`. */
export type FilterDimension = "level" | "environment" | "release";

export interface ProjectCounts {
  open_issues: number;
  events_24h: number;
  events_30d: number;
  users_30d: number;
  last_event_at?: string | null;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  url?: string | null;
  /** Always present for the owner (the public key is not a secret). */
  public_key: string;
  public_key_prefix: string;
  timezone: string;
  allowed_origins: string[];
  ingest_enabled: boolean;
  store_ip: boolean;
  counts: ProjectCounts;
  created_at: string;
  updated_at: string;
}

/** `GET /projects/<id>/summary`. */
export interface Summary {
  open_issues: number;
  events_24h: number;
  events_30d: number;
  users_30d: number;
  last_event_at: string | null;
}

export interface Frame {
  filename?: string | null;
  function?: string | null;
  lineno?: number | null;
  colno?: number | null;
  in_app: boolean;
}

export interface Breadcrumb {
  ts?: string | null;
  category: string;
  message?: string | null;
  level?: string | null;
  data?: Record<string, unknown> | null;
}

export interface EventUser {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface Event {
  /** bigint as string */
  id: string;
  project_id: string;
  issue_id: string;
  issue_number: number;
  ts: string;
  level: Level;
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
  user?: EventUser | null;
  user_hash: string;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  /** Only with `store_ip`. */
  ip?: string | null;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
  source: "sdk" | "api" | string;
}

export interface Issue {
  id: string;
  project_id: string;
  /** Per-project, starts at 1; shown as `#number`. */
  number: number;
  fingerprint: string;
  title: string;
  culprit?: string | null;
  type?: string | null;
  level: Level;
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
  /** Only on `GET /issues/<id>`. */
  latest_event?: Event | null;
  created_at: string;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  per_page: number;
  total: number;
}

export interface StatsTotals {
  events: number;
  users: number;
  issues_new: number;
  issues_open?: number;
}

export interface SeriesPoint {
  ts: string;
  events: number;
  users: number;
}

export interface BreakdownRow {
  value: string;
  events: number;
  users: number;
}

export interface StatsRange {
  from: string;
  to: string;
  tz: string;
  interval: Interval;
}

export interface Stats {
  range: StatsRange;
  totals: StatsTotals;
  previous: StatsTotals;
  series: SeriesPoint[];
  breakdowns: Partial<Record<Dimension, BreakdownRow[]>>;
}

export interface Live {
  events: number;
  window_min: number;
}

/** `GET /apikeys/me`: identity and permissions of the calling key (CONTRACT.md). */
export interface KeyInfo {
  id: string;
  name: string;
  role: Role;
  prefix: string;
  scopes: Scope[];
  account: { id: string; name: string; plan: string; created_at?: string };
}

export interface ApiKey {
  id: string;
  name: string;
  role: Role;
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface Usage {
  period_start: string;
  period_end: string;
  events: number;
  events_dropped: number;
  counts: { projects: number; api_keys: number };
  limits: Record<string, unknown>;
}

export interface AuditEvent {
  id: string;
  ts: string;
  actor_type: string;
  actor_id?: string | null;
  actor_label?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  outcome: string;
  meta: Record<string, unknown>;
}

export interface PurgeResult {
  deleted_events: number;
  deleted_issues: number;
}

// --- Request inputs ---------------------------------------------------------- //

export interface CreateProjectInput {
  name: string;
  key?: string;
  description?: string;
  url?: string;
  timezone?: string;
  allowed_origins?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  url?: string;
  timezone?: string;
  allowed_origins?: string[];
  ingest_enabled?: boolean;
  store_ip?: boolean;
}

export interface IssuesParams {
  status?: IssueStatusFilter;
  level?: Level;
  environment?: string;
  release?: string;
  q?: string;
  period?: IssuePeriod;
  sort?: IssueSort;
  page?: number;
  per_page?: number;
}

export interface EventsParams {
  level?: Level;
  environment?: string;
  release?: string;
  q?: string;
  /** Issue uuid or number. */
  issue?: string;
  period?: IssuePeriod;
  page?: number;
  per_page?: number;
}

export interface StatsParams {
  period?: StatsPeriod;
  from?: string;
  to?: string;
  interval?: Interval;
  level?: Level;
  environment?: string;
  release?: string;
}

export interface AuditParams {
  action?: string;
  actor_type?: string;
  outcome?: string;
  since?: string;
  page?: number;
  per_page?: number;
}

/** Body of `POST /ingest` (the project key travels in the `X-Project-Key` header). */
export interface IngestEventInput {
  type?: string;
  message?: string;
  level?: Level;
  stack?: string;
  frames?: Frame[];
  url?: string;
  release?: string;
  environment?: string;
  platform?: string;
  sdk?: string;
  user?: EventUser;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  breadcrumbs?: Breadcrumb[];
  fingerprint?: string[];
  ts?: string;
}

export type IngestResult =
  | { ok: true; event_id: string; issue_id: string; issue_number: number }
  | { ok: false; reason: "paused" | "origin" | "limit" | string };
