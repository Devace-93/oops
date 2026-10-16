/**
 * Small helpers shared by the dashboard: period presets, number / date
 * formatting, country names and flags, dimension labels and the project-key
 * slug. Pure functions only (Qwik serialises everything that crosses a `$`).
 */
import type { CatalogKey } from "../i18n/catalog/en";
import type { Dimension, Device, Interval, Metric, Period } from "./types";

export const PERIODS: Period[] = ["today", "yesterday", "7d", "30d", "90d", "12mo"];

export const PERIOD_LABEL: Record<Period, CatalogKey> = {
  today: "period.today",
  yesterday: "period.yesterday",
  "7d": "period.7d",
  "30d": "period.30d",
  "90d": "period.90d",
  "12mo": "period.12mo",
};

export const OOPS: Metric[] = ["pageviews", "visitors", "events"];

export const METRIC_LABEL: Record<Metric, CatalogKey> = {
  pageviews: "metric.pageviews",
  visitors: "metric.visitors",
  events: "metric.events",
};

export const DIMENSION_LABEL: Record<Dimension, CatalogKey> = {
  path: "dim.path",
  hostname: "dim.hostname",
  referrer: "dim.referrer",
  country: "dim.country",
  region: "dim.region",
  city: "dim.city",
  device: "dim.device",
  browser: "dim.browser",
  os: "dim.os",
  lang: "dim.lang",
  utm_source: "dim.utm_source",
  utm_medium: "dim.utm_medium",
  utm_campaign: "dim.utm_campaign",
  name: "dim.name",
  ip: "dim.ip",
};

export const DEVICE_LABEL: Record<Device, CatalogKey> = {
  desktop: "device.desktop",
  mobile: "device.mobile",
  tablet: "device.tablet",
  bot: "device.bot",
};

export const DEVICE_ICON: Record<string, string> = { desktop: "🖥️", mobile: "📱", tablet: "📟", bot: "🤖" };

export const DIRECT = "(direct)";

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

export function fmtDateTime(iso: string | null | undefined, lang = "en-US"): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
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

/** Axis / tooltip label for a series bucket (local time, no zone conversion). */
export function bucketLabel(bucket: string, interval: Interval, lang = "en-US", long = false): string {
  try {
    if (interval === "hour") {
      const d = new Date(bucket + ":00");
      return long
        ? d.toLocaleString(lang, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
        : d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    }
    if (interval === "month") {
      const d = new Date(bucket + "-01T00:00:00");
      return d.toLocaleDateString(lang, { month: "short", year: long ? "numeric" : "2-digit" });
    }
    const d = new Date(bucket + "T00:00:00");
    return long
      ? d.toLocaleDateString(lang, { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : d.toLocaleDateString(lang, { month: "short", day: "numeric" });
  } catch {
    return bucket;
  }
}

/** "ES" → "Spain" in the viewer's language (falls back to the code). */
export function countryName(code: string | null | undefined, lang = "en-US"): string {
  if (!code) return "";
  try {
    const names = new Intl.DisplayNames([lang], { type: "region" });
    return names.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** "ES" → "🇪🇸". */
export function flag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "🌐";
  const base = 0x1f1e6;
  const upper = code.toUpperCase();
  return String.fromCodePoint(base + upper.charCodeAt(0) - 65, base + upper.charCodeAt(1) - 65);
}

/** "es-MX" → "Spanish (Mexico)" in the viewer's language. */
export function languageName(tag: string | null | undefined, lang = "en-US"): string {
  if (!tag) return "";
  try {
    return new Intl.DisplayNames([lang], { type: "language" }).of(tag) ?? tag;
  } catch {
    return tag;
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
