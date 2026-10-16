/** Shared API shapes (mirror of CONTRACT.md → Objects + endpoint responses). */

export interface User {
  id: string;
  email: string;
  created_at?: string;
}

export type PlanKey = "free" | "pro" | "team" | "enterprise" | "selfhost";

export interface Account {
  id: string;
  name: string;
  plan: PlanKey;
  created_at?: string;
}

/** One entry of packages/shared/plan_limits.json; -1 means unlimited. */
export interface Limits {
  projects: number;
  api_keys: number;
  events_per_month: number;
  retention_days: number;
  audit_retention_days: number;
  max_users: number;
  api?: string;
}

export interface Usage {
  period_start?: string;
  period_end?: string;
  /** Error events received by the ingest API this calendar month, dropped ones included. */
  events: number;
  /** Events over the plan budget that were counted but not stored. */
  events_dropped: number;
  counts: { projects: number; api_keys: number };
  limits?: Limits;
}

export interface AuthResponse {
  user: User;
  account: Account;
  access_token: string;
  refresh_token: string;
}

export interface MeResponse {
  user: User;
  account: Account;
  plan?: string;
  limits: Limits;
  usage: Usage;
  counts: { projects: number };
  /** oops' own feature switches, resolved for this account. */
  features?: Record<string, boolean>;
}

/* ─── Projects ─────────────────────────────────────────────────────────── */

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
  /** Public ingest key (not a secret; ships in the SDK snippet). */
  public_key: string;
  public_key_prefix: string;
  /** IANA zone used to bucket days. */
  timezone: string;
  /** Hostnames allowed to report; empty = any. */
  allowed_origins: string[];
  /** Pause ingest without touching the snippet. */
  ingest_enabled: boolean;
  /** Keep the raw IP on each event (off by default). */
  store_ip: boolean;
  counts: ProjectCounts;
  created_at: string;
  updated_at: string;
}

export interface ProjectPatch {
  name?: string;
  description?: string | null;
  url?: string | null;
  timezone?: string;
  allowed_origins?: string[];
  ingest_enabled?: boolean;
  store_ip?: boolean;
}

/** GET /projects/:id/summary */
export interface Summary {
  open_issues: number;
  events_24h: number;
  events_30d: number;
  users_30d: number;
  last_event_at?: string | null;
}

/* ─── Issues and events ────────────────────────────────────────────────── */

export type Level = "fatal" | "error" | "warning" | "info";
export type IssueStatus = "open" | "resolved" | "ignored";
/** `status` query of GET /issues. */
export type StatusFilter = IssueStatus | "all";
export type IssueSort = "last_seen" | "first_seen" | "events" | "users";
/** `period` query of GET /issues and GET /events (by last_seen / ts). */
export type IssuePeriod = "24h" | "7d" | "30d" | "90d" | "all";
export type EventSource = "sdk" | "api";

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
  /** Top of the stack first. */
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
  /** Only with store_ip. */
  ip?: string | null;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
  source: EventSource;
}

export interface Issue {
  id: string;
  project_id: string;
  /** Per-project human number (#12), starts at 1. */
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
  /** Last 10 releases seen. */
  releases: string[];
  latest_event_id?: string | null;
  /** Only on GET /issues/:id. */
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

export type IssuesPage = Page<Issue>;
export type EventsPage = Page<Event>;

export interface IssuesQuery {
  status?: StatusFilter;
  level?: Level | "";
  environment?: string;
  release?: string;
  q?: string;
  period?: IssuePeriod;
  sort?: IssueSort;
  page?: number;
  per_page?: number;
}

export interface EventsQuery {
  level?: Level | "";
  environment?: string;
  release?: string;
  q?: string;
  issue?: string;
  period?: IssuePeriod;
  page?: number;
  per_page?: number;
}

/* ─── Stats ────────────────────────────────────────────────────────────── */

export type Period = "today" | "yesterday" | "24h" | "7d" | "30d" | "90d" | "12mo";
export type Interval = "hour" | "day" | "month";
export type Metric = "events" | "users";
export type Dimension = "level" | "environment" | "release" | "browser" | "os" | "device" | "type";
/** Dimensions the issues / events / stats endpoints accept as filters. */
export type FilterDimension = "level" | "environment" | "release";
export type Filters = Partial<Record<FilterDimension, string>>;

export interface StatsTotals {
  events: number;
  users: number;
  issues_new: number;
  issues_open: number;
}

export interface StatsPrevious {
  events: number;
  users: number;
  issues_new: number;
}

export interface SeriesPoint {
  /** Bucket start, ISO with the project zone offset. */
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
  previous: StatsPrevious;
  series: SeriesPoint[];
  /** Top 10 values by events per dimension. */
  breakdowns: Partial<Record<Dimension, BreakdownRow[]>>;
}

export interface StatsQuery {
  period?: Period;
  from?: string;
  to?: string;
  interval?: Interval;
  filters?: Filters;
}

/** GET /projects/:id/live */
export interface Live {
  events: number;
  window_min: number;
}

/* ─── Account, keys, audit ─────────────────────────────────────────────── */

export type ApiKeyRole = "viewer" | "editor" | "admin";

export interface ApiKey {
  id: string;
  name?: string;
  prefix: string;
  role: ApiKeyRole;
  last_used_at?: string | null;
  revoked_at?: string | null;
  created_at: string;
}

export interface RoleInfo {
  label: string;
  description: string;
  scopes: string[];
}

export interface RolesResponse {
  default_role: ApiKeyRole;
  roles: Record<ApiKeyRole, RoleInfo>;
}

export type AuditOutcome = "ok" | "denied" | "error";

export interface AuditEvent {
  id: string;
  ts: string;
  actor_type: "user" | "api_key" | "system";
  actor_id?: string | null;
  actor_label?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  outcome: AuditOutcome;
  meta?: Record<string, unknown>;
}

export interface AuditQuery {
  action?: string;
  actor_type?: string;
  outcome?: string;
  since?: string;
  page?: number;
  per_page?: number;
}

/** `which` is set on 402 limit_reached: projects | api_keys. */
export interface ApiError {
  code: string;
  message: string;
  which?: string;
  required_scope?: string;
  role?: string;
}
