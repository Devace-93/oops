/**
 * Pure helpers for the tracker (kept apart from the DOM glue so they can be
 * unit-tested with `bun test`). The payload keys are deliberately short — the
 * script is served to every visitor of every tracked site — and mirror the
 * collect API contract: k key, n name, u url, r referrer, t title, w/h
 * screen, l language, p props, s source.
 */
export interface PageLike {
  href: string;
  hostname: string;
  protocol: string;
}

export interface Payload {
  k: string;
  n: string;
  u: string;
  r: string;
  t: string;
  w: number;
  h: number;
  l: string;
  s: "script";
  p?: Record<string, unknown>;
}

/** Hosts where tracking is skipped unless `data-local="true"` is set. */
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

/** The URL sent with a hit: the hash is dropped unless hash routing is on. */
export function pageUrl(href: string, hashMode: boolean): string {
  return hashMode ? href : href.split("#")[0];
}

/** Collect endpoint derived from the script's own `src` (same host, `/api/collect`). */
export function endpointFromScript(src: string | null | undefined): string {
  if (!src) return "/api/collect";
  try {
    const u = new URL(src, typeof location !== "undefined" ? location.href : "https://oops.3m4.net/");
    return `${u.origin}/api/collect`;
  } catch {
    return "/api/collect";
  }
}

export function buildPayload(
  key: string,
  name: string,
  url: string,
  referrer: string,
  title: string,
  screen: { width: number; height: number } | null | undefined,
  lang: string,
  props?: Record<string, unknown> | null,
): Payload {
  const body: Payload = {
    k: key,
    n: name || "pageview",
    u: url,
    r: referrer || "",
    t: (title || "").slice(0, 200),
    w: screen ? screen.width : 0,
    h: screen ? screen.height : 0,
    l: (lang || "").slice(0, 16),
    s: "script",
  };
  if (props && typeof props === "object" && Object.keys(props).length) body.p = props;
  return body;
}

/** `data-oops-props='{"plan":"pro"}'` on a clicked element → object. */
export function parseProps(raw: string | null): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
