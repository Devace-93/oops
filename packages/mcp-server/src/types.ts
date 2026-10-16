/** Wire types of the oops REST API (see CONTRACT.md at the repo root). */

export type Role = "viewer" | "editor" | "admin";

export type Scope =
  | "projects:read"
  | "projects:write"
  | "projects:delete"
  | "stats:read"
  | "events:delete"
  | "usage:read"
  | "audit:read";

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

export interface ProjectCounts {
  pageviews_30d: number;
  visitors_30d: number;
  pageviews_today: number;
  last_event_at: string | null;
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
  collect_enabled: boolean;
  exclude_bots: boolean;
  store_ip: boolean;
  counts: ProjectCounts;
  created_at: string;
  updated_at: string;
}

export interface Totals {
  pageviews: number;
  visitors: number;
  events: number;
}

export interface SeriesPoint extends Totals {
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

export interface Live {
  window_minutes: number;
  visitors: number;
  pageviews: number;
  pages: { path: string; visitors: number; pageviews: number }[];
}

export interface Stats {
  project_id: string;
  range: StatsRange;
  filters: Partial<Record<Dimension, string>>;
  totals: Totals;
  previous: Totals;
  series: SeriesPoint[];
  breakdowns: Record<Dimension, BreakdownRow[]>;
  live: Live;
}

export interface Breakdown {
  project_id: string;
  range: StatsRange;
  filters: Partial<Record<Dimension, string>>;
  by: Dimension;
  items: BreakdownRow[];
  page: number;
  per_page: number;
  total: number;
}

export interface EventRow {
  id: number;
  ts: string;
  kind: "pageview" | "event";
  name: string | null;
  hostname: string | null;
  path: string;
  title: string | null;
  referrer: string | null;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  screen_w: number | null;
  screen_h: number | null;
  lang: string | null;
  visitor: string;
  ip: string | null;
  source: string;
  props: Record<string, unknown>;
}

export interface EventsPage {
  project_id: string;
  range: StatsRange;
  filters: Partial<Record<Dimension, string>>;
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
  last_event_at: string | null;
  all_time_pageviews: number;
}

export interface KeyInfo {
  account: { id: string; name: string; plan: string; created_at?: string };
  key: { id: string; prefix: string; role: Role };
  scopes: Scope[];
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
  actor_id: string | null;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  outcome: string;
  meta: Record<string, unknown>;
}

export interface RotatedKey {
  public_key: string;
  public_key_prefix: string;
}

export interface CreateProjectInput {
  name: string;
  key?: string;
  description?: string;
  url?: string;
  timezone?: string;
  allowed_origins?: string[];
  store_ip?: boolean;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  url?: string;
  timezone?: string;
  allowed_origins?: string[];
  collect_enabled?: boolean;
  exclude_bots?: boolean;
  store_ip?: boolean;
}

export interface StatsParams {
  period?: Period;
  from?: string;
  to?: string;
  tz?: string;
  interval?: Interval;
  limit?: number;
  /** Dimension filters, e.g. { country: "ES", device: "mobile" }. */
  filters?: Partial<Record<Dimension, string>>;
}

export interface EventsParams extends StatsParams {
  kind?: "pageview" | "event";
  q?: string;
  page?: number;
  per_page?: number;
}
