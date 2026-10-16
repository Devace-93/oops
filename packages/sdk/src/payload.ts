/**
 * Pure helpers for the SDK, kept apart from the DOM glue so they can be
 * unit-tested with `bun test`. The payload mirrors the ingest contract
 * (CONTRACT.md → Ingest) field for field; scrubbing, URL cleaning and caps
 * beyond the ones here happen server-side.
 */
import type { Frame } from "./stack";

export const SDK_VERSION = "0.1.0";
export const SDK_NAME = "oops-js/" + SDK_VERSION;
export const MAX_BREADCRUMBS = 30;
export const DEDUP_WINDOW_MS = 2000;
export const RATE_LIMIT = 30;
export const RATE_WINDOW_MS = 60000;

export type Level = "fatal" | "error" | "warning" | "info";

export interface User {
  id?: string;
  email?: string;
  name?: string;
}

export interface Breadcrumb {
  ts?: string;
  category: string;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
}

export interface CaptureOptions {
  level?: Level;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
}

/** An error reduced to what the payload needs, whatever was thrown. */
export interface NormalisedError {
  type?: string;
  message: string;
  stack?: string;
}

/** Per-page state set through the public API. */
export interface Scope {
  user?: User | null;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
}

export interface PageContext {
  url: string;
  environment: string;
  release?: string;
  now: number;
}

export interface IngestPayload {
  k: string;
  type?: string;
  message: string;
  level: Level;
  stack?: string;
  frames: Frame[];
  url: string;
  release?: string;
  environment: string;
  platform: "javascript";
  sdk: string;
  user?: User;
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
  fingerprint?: string[];
  ts: string;
}

export interface PageLike {
  hostname: string;
  protocol: string;
}

/** Hosts where reporting is skipped unless `data-local="true"` is set. */
export function isLocalPage(page: PageLike): boolean {
  const host = page.hostname;
  return (
    page.protocol === "file:" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    /\.(local|localhost|internal|test)$/.test(host)
  );
}

/** Ingest endpoint derived from the script's own `src` (same origin, `/api/ingest`). */
export function endpointFromScript(src: string | null | undefined): string {
  if (!src) return "/api/ingest";
  try {
    const u = new URL(src, typeof location !== "undefined" ? location.href : "https://oops.3m4.net/");
    return u.origin + "/api/ingest";
  } catch {
    return "/api/ingest";
  }
}

/** `data-user='{"id":"u_42"}'` → object; anything that is not a JSON object → undefined. */
export function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function isErrorLike(value: unknown): value is { name?: string; message: string; stack?: string } {
  return !!value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string" && ("stack" in (value as object) || "name" in (value as object));
}

/** Short string form of any value, for messages and console breadcrumbs. */
export function stringify(value: unknown, max = 4096): string {
  let s: string;
  if (typeof value === "string") s = value;
  else if (value && typeof value === "object") {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  } else s = String(value);
  return s.slice(0, max);
}

/**
 * Whatever was thrown or rejected → `{ type, message, stack }`. Errors keep
 * their name and stack; strings and other values become a message under
 * `fallbackType`.
 */
export function normaliseError(value: unknown, fallbackType = "Error"): NormalisedError {
  if (isErrorLike(value)) {
    return {
      type: (value.name && String(value.name)) || fallbackType,
      message: value.message,
      stack: typeof value.stack === "string" ? value.stack : undefined,
    };
  }
  return { type: fallbackType, message: stringify(value) };
}

/** Dedup key: type + message + top frame position. */
export function dedupKey(type: string | undefined, message: string, frames: Frame[]): string {
  // Same key the server groups by: type, message and the top frame's file +
  // function (line / column are left out so two call sites of the same throw
  // within the window still count as one).
  const top = frames[0];
  return (type || "") + "\n" + message + "\n" + (top ? (top.filename || "") + ":" + (top.function || "") : "");
}

/** Resolve a request URL against the page so breadcrumbs always carry the host. */
export function absolute(url: string): string {
  try {
    return new URL(url, typeof location !== "undefined" ? location.href : "https://localhost/").href;
  } catch {
    return url;
  }
}

/** True when `key` was seen within the window; records the sighting otherwise. */
export function isDuplicate(seen: Record<string, number>, key: string, now: number, windowMs = DEDUP_WINDOW_MS): boolean {
  const last = seen[key];
  if (last !== undefined && now - last < windowMs) return true;
  seen[key] = now;
  return false;
}

export interface RateState {
  t: number;
  n: number;
}

/** Sliding one-minute cap: at most `limit` events per window. */
export function allowRate(state: RateState, now: number, limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS): boolean {
  if (!state.t || now - state.t >= windowMs) {
    state.t = now;
    state.n = 0;
  }
  if (state.n >= limit) return false;
  state.n++;
  return true;
}

/** `data-sample="0.5"`: keep the event when `rnd < rate`; missing / invalid / ≥ 1 keeps everything. */
export function shouldSample(rate: string | null | undefined, rnd: number): boolean {
  const r = rate == null || rate === "" ? NaN : Number(rate);
  if (isNaN(r) || r >= 1) return true;
  if (r <= 0) return false;
  return rnd < r;
}

export interface ElementLike {
  tagName: string;
  id?: string;
  className?: unknown;
  textContent?: string | null;
}

/** `button#pay.btn.primary` + the visible text (≤ 60) for a click breadcrumb. */
export function clickCrumb(el: ElementLike): Breadcrumb {
  let sel = el.tagName.toLowerCase();
  if (el.id) sel += "#" + el.id;
  if (typeof el.className === "string" && el.className) sel += "." + el.className.trim().split(/\s+/).slice(0, 3).join(".");
  const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
  const crumb: Breadcrumb = { category: "click", message: sel.slice(0, 200) };
  if (text) crumb.data = { text };
  return crumb;
}

/** Breadcrumb for a failed fetch / XHR: method + URL without query, status (0 = network error). */
export function httpCrumb(category: "fetch" | "xhr", method: string, url: string, status: number): Breadcrumb {
  return { category, level: "error", message: method.toUpperCase() + " " + stripQuery(url), data: { status } };
}

export function stripQuery(url: string): string {
  return String(url).split(/[?#]/)[0] as string;
}

/** Console arguments → one line (≤ 200 chars) for a breadcrumb. */
export function formatArgs(args: unknown[]): string {
  let out = "";
  for (let i = 0; i < args.length; i++) out += (i ? " " : "") + stringify(args[i], 200);
  return out.slice(0, 200);
}

/** Add a breadcrumb to the ring buffer (keeps the last 30). */
export function pushCrumb(buffer: Breadcrumb[], crumb: Breadcrumb, now: number): void {
  if (!crumb.ts) crumb.ts = new Date(now).toISOString();
  buffer.push(crumb);
  while (buffer.length > MAX_BREADCRUMBS) buffer.shift();
}

export function buildPayload(
  key: string,
  err: NormalisedError,
  frames: Frame[],
  scope: Scope,
  opts: CaptureOptions,
  crumbs: Breadcrumb[],
  ctx: PageContext,
): IngestPayload {
  const body: IngestPayload = {
    k: key,
    type: err.type ? String(err.type).slice(0, 200) : undefined,
    message: (err.message || "").slice(0, 4096),
    level: opts.level || "error",
    stack: err.stack ? err.stack.slice(0, 16384) : undefined,
    frames: frames.slice(0, 50),
    url: ctx.url,
    release: ctx.release || undefined,
    environment: ctx.environment,
    platform: "javascript",
    sdk: SDK_NAME,
    user: scope.user || undefined,
    tags: Object.assign({}, scope.tags, opts.tags),
    extra: Object.assign({}, scope.extra, opts.extra),
    breadcrumbs: crumbs.slice(),
    fingerprint: Array.isArray(opts.fingerprint) && opts.fingerprint.length ? opts.fingerprint.slice(0, 5).map((f) => String(f).slice(0, 100)) : undefined,
    ts: new Date(ctx.now).toISOString(),
  };
  return body;
}
