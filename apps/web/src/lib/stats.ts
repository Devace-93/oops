/**
 * Small helpers shared by the dashboard: period presets, metric / dimension /
 * level / status labels, number and date formatting, stack-frame and
 * breadcrumb presentation, the project-key slug. Pure functions only (Qwik
 * serialises everything that crosses a `$`).
 */
import type { CatalogKey } from "../i18n/catalog/en";
import type { Breadcrumb, Dimension, FilterDimension, Frame, Interval, IssuePeriod, IssueSort, IssueStatus, Level, Metric, Period, StatusFilter } from "./types";

/* ─── Periods ──────────────────────────────────────────────────────────── */

/** GET /stats presets, in picker order. */
export const PERIODS: Period[] = ["today", "yesterday", "24h", "7d", "30d", "90d", "12mo"];

export const PERIOD_LABEL: Record<Period, CatalogKey> = {
  today: "period.today",
  yesterday: "period.yesterday",
  "24h": "period.24h",
  "7d": "period.7d",
  "30d": "period.30d",
  "90d": "period.90d",
  "12mo": "period.12mo",
};

/** GET /issues and GET /events presets (by last_seen / ts). */
export const ISSUE_PERIODS: IssuePeriod[] = ["24h", "7d", "30d", "90d", "all"];

export const ISSUE_PERIOD_LABEL: Record<IssuePeriod, CatalogKey> = {
  "24h": "period.24h",
  "7d": "period.7d",
  "30d": "period.30d",
  "90d": "period.90d",
  all: "period.all",
};

/** The stats period that best matches an issues period (the KPI strip follows the inbox filter). */
export function statsPeriodFor(p: IssuePeriod): Period {
  return p === "all" ? "12mo" : p;
}

/* ─── Metrics, dimensions ──────────────────────────────────────────────── */

export const METRICS: Metric[] = ["events", "users"];

export const METRIC_LABEL: Record<Metric, CatalogKey> = {
  events: "metric.events",
  users: "metric.users",
};

export const DIMENSIONS: Dimension[] = ["level", "environment", "release", "browser", "os", "device", "type"];

export const DIMENSION_LABEL: Record<Dimension, CatalogKey> = {
  level: "dim.level",
  environment: "dim.environment",
  release: "dim.release",
  browser: "dim.browser",
  os: "dim.os",
  device: "dim.device",
  type: "dim.type",
};

export const FILTER_DIMENSIONS: FilterDimension[] = ["level", "environment", "release"];

export function isFilterDimension(d: Dimension): d is FilterDimension {
  return d === "level" || d === "environment" || d === "release";
}

export const DEVICE_ICON: Record<string, string> = { desktop: "🖥️", mobile: "📱", tablet: "📟", bot: "🤖" };

/* ─── Levels, statuses ─────────────────────────────────────────────────── */

export const LEVELS: Level[] = ["fatal", "error", "warning", "info"];

export const LEVEL_LABEL: Record<Level, CatalogKey> = {
  fatal: "level.fatal",
  error: "level.error",
  warning: "level.warning",
  info: "level.info",
};

/** Badge classes per level: fatal/error dark red, warning amber, info blue (fuchsia stays the brand). */
export const LEVEL_CLASS: Record<Level, string> = {
  fatal: "bg-red-800 text-white",
  error: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
};

export const STATUSES: IssueStatus[] = ["open", "resolved", "ignored"];
export const STATUS_FILTERS: StatusFilter[] = ["open", "resolved", "ignored", "all"];

export const STATUS_LABEL: Record<StatusFilter, CatalogKey> = {
  open: "status.open",
  resolved: "status.resolved",
  ignored: "status.ignored",
  all: "status.all",
};

export const STATUS_CLASS: Record<IssueStatus, string> = {
  open: "bg-primary-100 text-primary-800",
  resolved: "bg-green-100 text-green-800",
  ignored: "bg-slate-100 text-slate-600",
};

export const ISSUE_SORTS: IssueSort[] = ["last_seen", "first_seen", "events", "users"];

export const ISSUE_SORT_LABEL: Record<IssueSort, CatalogKey> = {
  last_seen: "sort.last_seen",
  first_seen: "sort.first_seen",
  events: "sort.events",
  users: "sort.users",
};

/* ─── Project key ──────────────────────────────────────────────────────── */

/** Slug used as the default project key (same rule as the API). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

/* ─── Numbers ──────────────────────────────────────────────────────────── */

/** 1284 → "1.3K", 12 → "12", 2_400_000 → "2.4M". */
export function fmtCompact(n: number, lang = "en-US"): string {
  try {
    return new Intl.NumberFormat(lang, { notation: "compact", maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

export function fmtNumber(n: number, lang = "en-US"): string {
  try {
    return new Intl.NumberFormat(lang).format(n);
  } catch {
    return String(n);
  }
}

/** Percentage change from `prev` to `cur`; null when there is no baseline. */
export function deltaPct(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

export function fmtPct(n: number, lang = "en-US"): string {
  const sign = n > 0 ? "+" : "";
  try {
    return `${sign}${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n)}%`;
  } catch {
    return `${sign}${n}%`;
  }
}

/* ─── Dates ────────────────────────────────────────────────────────────── */

export function fmtDateTime(iso: string | null | undefined, lang = "en-US"): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

/** Date + time with seconds, for event timestamps. */
export function fmtTimestamp(iso: string | null | undefined, lang = "en-US"): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(lang, { dateStyle: "medium", timeStyle: "medium" });
  } catch {
    return iso;
  }
}

export function fmtDate(iso: string | null | undefined, lang = "en-US"): string {
  if (!iso) return "";
  try {
    return new Date(iso.length === 10 ? iso + "T00:00:00" : iso).toLocaleDateString(lang, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

/** "3 min ago", "2 days ago", "just now" — in the viewer's language via Intl. */
export function fmtRelative(iso: string | null | undefined, lang = "en-US", now = Date.now()): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Math.round((t - now) / 1000); // negative = past
  const abs = Math.abs(diff);
  try {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    if (abs < 45) return rtf.format(0, "second").replace(/^in /, "");
    if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
    if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
    if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
    return rtf.format(Math.round(diff / (86400 * 365)), "year");
  } catch {
    return fmtDateTime(iso, lang);
  }
}

/** Axis / tooltip label for a series bucket, rendered in the project's zone. */
export function bucketLabel(ts: string, interval: Interval, lang = "en-US", long = false, tz?: string): string {
  try {
    const d = new Date(ts);
    const timeZone = tz || undefined;
    if (interval === "hour") {
      return long
        ? d.toLocaleString(lang, { timeZone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : d.toLocaleTimeString(lang, { timeZone, hour: "2-digit", minute: "2-digit" });
    }
    if (interval === "month") {
      return d.toLocaleDateString(lang, { timeZone, month: "short", year: long ? "numeric" : "2-digit" });
    }
    return long
      ? d.toLocaleDateString(lang, { timeZone, weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : d.toLocaleDateString(lang, { timeZone, month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

/** The browser's IANA time zone, or UTC during SSR. */
export function browserTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Every IANA zone the browser knows (for the settings picker). */
export function timezones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    return intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : ["UTC"];
  } catch {
    return ["UTC"];
  }
}

/** Today's date as YYYY-MM-DD in a time zone. */
export function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Hostname + path of a URL, for compact display. */
export function shortUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

/** True when the timestamp is within the live window (5 minutes). */
export function isLive(iso: string | null | undefined, windowMin = 5): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() < windowMin * 60_000;
}

/* ─── Stack frames and breadcrumbs ─────────────────────────────────────── */

/** "https://app/x.js:12:4" — filename with line and column when known. */
export function frameLocation(f: Frame): string {
  const file = f.filename || "<anonymous>";
  if (f.lineno == null) return file;
  return f.colno == null ? `${file}:${f.lineno}` : `${file}:${f.lineno}:${f.colno}`;
}

/** Last path segment of a frame's filename (keeps the display compact). */
export function frameFile(f: Frame): string {
  if (!f.filename) return "<anonymous>";
  try {
    const u = new URL(f.filename);
    return u.pathname.split("/").filter(Boolean).pop() || u.host;
  } catch {
    return f.filename.split(/[\\/]/).pop() || f.filename;
  }
}

/** Glyph per breadcrumb category (the SDK sends click / navigation / fetch / xhr / console). */
export function breadcrumbIcon(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("click") || c.includes("ui")) return "👆";
  if (c.includes("nav") || c.includes("route")) return "🧭";
  if (c.includes("fetch") || c.includes("xhr") || c.includes("http") || c.includes("request")) return "🌐";
  if (c.includes("console") || c.includes("log")) return "📝";
  if (c.includes("error") || c.includes("exception")) return "💥";
  if (c.includes("user") || c.includes("auth")) return "👤";
  return "•";
}

/** Pretty JSON for tags / extra / breadcrumb data panels. */
export function fmtJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Breadcrumb time relative to the event ("-2.3s"), or the clock time when far apart. */
export function crumbOffset(crumb: Breadcrumb, eventTs: string, lang = "en-US"): string {
  if (!crumb.ts) return "";
  const t = new Date(crumb.ts).getTime();
  const e = new Date(eventTs).getTime();
  if (Number.isNaN(t) || Number.isNaN(e)) return crumb.ts;
  const diff = (t - e) / 1000;
  if (Math.abs(diff) >= 3600) return fmtTimestamp(crumb.ts, lang);
  const abs = Math.abs(diff);
  const txt = abs >= 60 ? `${Math.round(abs / 60)}m${Math.round(abs % 60)}s` : `${abs.toFixed(abs < 10 ? 1 : 0)}s`;
  return diff <= 0 ? `-${txt}` : `+${txt}`;
}
