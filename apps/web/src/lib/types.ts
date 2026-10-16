/** Shared API shapes (mirror of CONTRACT.md). */

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
  /** Hits received this period (page views + custom events), dropped ones included. */
  events: number;
  /** Hits over the plan budget that were counted but not stored. */
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

export interface ProjectCounts {
  pageviews_30d: number;
  visitors_30d: number;
  pageviews_today: number;
  last_event_at?: string | null;
}

export interface Project {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  url?: string | null;
  /** Public collect key (not a secret; ships in the tracker snippet). */
  public_key: string;
  public_key_prefix: string;
  timezone: string;
  allowed_origins: string[];
  collect_enabled: boolean;
  exclude_bots: boolean;
  /** Keep the raw visitor IP on each hit (off by default). */
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
  collect_enabled?: boolean;
  exclude_bots?: boolean;
  store_ip?: boolean;
}

export type EventKind = "pageview" | "event";
export type EventSource = "script" | "pixel" | "api";
export type Device = "desktop" | "mobile" | "tablet" | "bot";

export type Dimension =
  | "path"
  | "hostname"
  | "referrer"
  | "country"
  | "region"
  | "city"
  | "device"
  | "browser"
  | "os"
  | "lang"
  | "utm_source"
  | "utm_medium"
  | "utm_campaign"
  | "name"
  | "ip";

export type Period = "today" | "yesterday" | "7d" | "30d" | "90d" | "12mo";
export type Interval = "hour" | "day" | "month";
export type Metric = "pageviews" | "visitors" | "events";

export interface Totals {
  pageviews: number;
  visitors: number;
  events: number;
}

export interface SeriesPoint extends Totals {
  /** Local bucket key: "2026-10-15T13:00" | "2026-10-15" | "2026-10". */
  bucket: string;
}

export interface BreakdownRow extends Totals {
  value: string;
}

export interface StatsRange {
  from: string;
  to: string;
  tz: string;
  interval: Interval;
  days: number;
}

export type Filters = Partial<Record<Dimension, string>>;

export interface Live {
  window_minutes: number;
  visitors: number;
  pageviews: number;
  pages: { path: string; visitors: number; pageviews: number }[];
}

export interface Stats {
  project_id: string;
  range: StatsRange;
  filters: Filters;
  totals: Totals;
  previous: Totals;
  series: SeriesPoint[];
  breakdowns: Record<Dimension, BreakdownRow[]>;
  live: Live;
}

export interface Breakdown {
  project_id: string;
  range: StatsRange;
  filters: Filters;
  by: Dimension;
  items: BreakdownRow[];
  page: number;
  per_page: number;
  total: number;
}

export interface EventRow {
  id: number;
  ts: string;
  kind: EventKind;
  name?: string | null;
  hostname?: string | null;
  path: string;
  title?: string | null;
  referrer?: string | null;
  referrer_host?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  device?: Device | null;
  browser?: string | null;
  os?: string | null;
  screen_w?: number | null;
  screen_h?: number | null;
  lang?: string | null;
  /** First 8 chars of the daily visitor hash (for grouping rows by visitor). */
  visitor: string;
  /** Raw address, only when the project stores IPs. */
  ip?: string | null;
  source: EventSource;
  props: Record<string, unknown>;
}

export interface EventsPage {
  project_id: string;
  range: StatsRange;
  filters: Filters;
  items: EventRow[];
  page: number;
  per_page: number;
  total: number;
}

export interface Summary {
  project_id: string;
  timezone: string;
  today: Totals;
  yesterday: Totals;
  last_7_days: Totals;
  last_30_days: Totals;
  live_visitors: number;
  last_event_at?: string | null;
  all_time_pageviews: number;
}

export interface StatsQuery {
  period?: Period;
  from?: string;
  to?: string;
  tz?: string;
  interval?: Interval;
  limit?: number;
  filters?: Filters;
}

export type ApiKeyRole = "viewer" | "editor" | "admin";

export interface ApiKey {
  id: string;
  name?: string;
  prefix: string;
  role: ApiKeyRole;
  last_used_at?: string | null;
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

/** `which` is set on 402 limit_reached: projects | api_keys. */
export interface ApiError {
  code: string;
  message: string;
  which?: string;
  required_scope?: string;
  role?: string;
}
