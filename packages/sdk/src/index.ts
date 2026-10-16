/**
 * oops browser SDK — the script a site drops in to report its errors:
 *
 *   <script defer src="https://oops.3m4.net/o.js" data-key="oops_pub_…" data-env="production" data-release="1.4.2"></script>
 *
 * - Captures uncaught errors (`error` event), unhandled promise rejections and,
 *   with `data-console="true"`, `console.error` calls.
 * - Keeps the last 30 breadcrumbs: clicks, SPA navigation (History API +
 *   popstate), failed fetch / XHR (status ≥ 400 or network error) and
 *   console.warn / console.error when enabled.
 * - Posts `text/plain` JSON to `<script origin>/api/ingest` (or `data-api`)
 *   with `navigator.sendBeacon`, falling back to `fetch` with keepalive.
 * - Client-side hygiene: same type + message + top frame within 2 s is dropped,
 *   at most 30 events per minute, localhost / IP / file: pages are skipped
 *   unless `data-local="true"`, `data-sample="0.5"` samples error events.
 * - Never throws into the host page: every entry point is wrapped.
 *
 * Public API on `window.oops` (calls queued in `window.oops.q` before load are
 * replayed): capture, message, setUser, setTag, setTags, setContext,
 * breadcrumb, flush.
 */
import {
  allowRate,
  buildPayload,
  clickCrumb,
  absolute,
  dedupKey,
  endpointFromScript,
  formatArgs,
  httpCrumb,
  isDuplicate,
  isErrorLike,
  isLocalPage,
  normaliseError,
  parseJsonObject,
  pushCrumb,
  shouldSample,
  type Breadcrumb,
  type CaptureOptions,
  type Level,
  type NormalisedError,
  type RateState,
  type Scope,
  type User,
} from "./payload";
import { parseStack } from "./stack";

interface OopsApi {
  capture(error: unknown, opts?: CaptureOptions): void;
  message(text: string, level?: Level, opts?: CaptureOptions): void;
  setUser(user: User | null): void;
  setTag(key: string, value: string): void;
  setTags(tags: Record<string, string>): void;
  setContext(key: string, value: unknown): void;
  breadcrumb(crumb: Breadcrumb): void;
  flush(): void;
  q?: unknown[][];
}

(function () {
  try {
    const w = window as unknown as Window & typeof globalThis & { oops?: OopsApi };
    const d = document;
    const script =
      (d.currentScript as HTMLScriptElement | null) ||
      (d.querySelector("script[data-key][src*='o.js'],script[data-key][src*='/o/v1']") as HTMLScriptElement | null);
    const key = script && script.getAttribute("data-key");
    if (!script || !key) return;

    const attr = (name: string) => script.getAttribute("data-" + name);
    const api = attr("api") || endpointFromScript(script.getAttribute("src"));
    const environment = attr("env") || "production";
    const release = attr("release") || undefined;
    const sample = attr("sample");
    const muted = attr("local") !== "true" && isLocalPage(location);
    const origin = location.origin || location.protocol + "//" + location.host;
    const scope: Scope = { user: parseJsonObject(attr("user")) as User | undefined, tags: {}, extra: {} };
    const crumbs: Breadcrumb[] = [];
    const seen: Record<string, number> = {};
    const rate: RateState = { t: 0, n: 0 };
    const nativeFetch = w.fetch;

    const crumb = (c: Breadcrumb) => pushCrumb(crumbs, c, Date.now());

    function post(body: string): void {
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(api, new Blob([body], { type: "text/plain" }))) return;
      } catch {
        /* fall through to fetch */
      }
      try {
        if (nativeFetch)
          nativeFetch
            .call(w, api, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" }, credentials: "omit" })
            .catch(() => {});
      } catch {
        /* nothing to do */
      }
    }

    /** Dedup → sampling (automatic captures only) → rate cap → send. */
    function report(err: NormalisedError, opts: CaptureOptions | undefined, sampled: boolean): void {
      if (muted) return;
      const frames = parseStack(err.stack, origin);
      const now = Date.now();
      if (isDuplicate(seen, dedupKey(err.type, err.message, frames), now)) return;
      if (sampled && !shouldSample(sample, Math.random())) return;
      if (!allowRate(rate, now)) return;
      post(JSON.stringify(buildPayload(key as string, err, frames, scope, opts || {}, crumbs, { url: location.href, environment, release, now })));
    }

    /** Wrap a public method so it can never throw into the host page. */
    const safe = <T extends (...a: any[]) => void>(fn: T): T =>
      function (this: unknown) {
        try {
          // eslint-disable-next-line prefer-rest-params
          fn.apply(this, arguments as unknown as Parameters<T>);
        } catch {
          /* swallow */
        }
      } as unknown as T;

    const queued = w.oops && w.oops.q;
    const facade: OopsApi = {
      capture: safe((error: unknown, opts?: CaptureOptions) => {
        if (error != null) report(normaliseError(error), opts, false);
      }),
      message: safe((text: string, level?: Level, opts?: CaptureOptions) =>
        report({ message: String(text) }, Object.assign({}, opts, { level: level || "info" }), false),
      ),
      setUser: safe((user: User | null) => {
        scope.user = user && typeof user === "object" ? user : undefined;
      }),
      setTag: safe((k: string, v: string) => {
        scope.tags[String(k)] = String(v);
      }),
      setTags: safe((tags: Record<string, string>) => {
        for (const k in tags) scope.tags[k] = String(tags[k]);
      }),
      setContext: safe((k: string, v: unknown) => {
        scope.extra[String(k)] = v;
      }),
      breadcrumb: safe((c: Breadcrumb) => {
        if (c && typeof c === "object") crumb({ category: String(c.category || "manual"), message: c.message, level: c.level, data: c.data });
      }),
      flush: () => {},
    };
    w.oops = facade;
    if (Array.isArray(queued)) {
      for (const call of queued) {
        const [method, ...args] = call as [keyof OopsApi, ...unknown[]];
        const fn = facade[method];
        if (typeof fn === "function") (fn as (...a: unknown[]) => void).apply(facade, args);
      }
    }
    if (muted) return;

    // Uncaught errors. Without an Error object (cross-origin "Script error.")
    // the position from the event becomes the only frame.
    addEventListener("error", (ev: ErrorEvent) => {
      try {
        if (!("message" in ev)) return;
        const e = ev.error;
        const err = e != null ? normaliseError(e) : { type: "Error", message: String(ev.message) };
        if (!err.stack && ev.filename) err.stack = "    at " + ev.filename + ":" + (ev.lineno | 0) + ":" + (ev.colno | 0);
        report(err, undefined, true);
      } catch {
        /* never into the page */
      }
    });
    addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
      try {
        report(normaliseError(ev.reason, "UnhandledRejection"), undefined, true);
      } catch {
        /* never into the page */
      }
    });

    // Breadcrumbs: clicks.
    d.addEventListener(
      "click",
      (ev) => {
        try {
          const t = ev.target as Element | null;
          if (t && t.tagName) crumb(clickCrumb(t));
        } catch {
          /* ignore */
        }
      },
      true,
    );

    // Breadcrumbs: SPA navigation.
    let last = location.pathname + location.search;
    const nav = () => {
      const to = location.pathname + location.search;
      if (to !== last) {
        crumb({ category: "navigation", message: to, data: { from: last, to } });
        last = to;
      }
    };
    const h = w.history;
    for (const m of ["pushState", "replaceState"] as const) {
      const orig = h[m];
      h[m] = function (this: History) {
        // eslint-disable-next-line prefer-rest-params
        orig.apply(this, arguments as unknown as Parameters<History["pushState"]>);
        nav();
      };
    }
    addEventListener("popstate", nav);

    // Breadcrumbs: failed fetch / XHR.
    if (nativeFetch) {
      w.fetch = (function (input: RequestInfo | URL, init?: RequestInit) {
        const method = String((init && init.method) || (input && (input as Request).method) || "GET");
        const url = absolute(String(input && (input as Request).url ? (input as Request).url : input));
        // eslint-disable-next-line prefer-rest-params
        const p = nativeFetch.apply(w, arguments as unknown as [RequestInfo | URL, RequestInit?]);
        try {
          p.then(
            (res) => {
              if (res.status >= 400) crumb(httpCrumb("fetch", method, url, res.status));
            },
            () => crumb(httpCrumb("fetch", method, url, 0)),
          );
        } catch {
          /* ignore */
        }
        return p;
      }) as typeof fetch;
    }
    const X = w.XMLHttpRequest;
    if (X) {
      type Tracked = XMLHttpRequest & { __oops?: [string, string] };
      const open = X.prototype.open;
      const send = X.prototype.send;
      X.prototype.open = function (this: Tracked, method: string, url: string | URL) {
        this.__oops = [String(method), String(url)];
        // eslint-disable-next-line prefer-rest-params
        return open.apply(this, arguments as unknown as Parameters<XMLHttpRequest["open"]>);
      } as XMLHttpRequest["open"];
      X.prototype.send = function (this: Tracked) {
        const x = this;
        try {
          x.addEventListener("loadend", () => {
            if (x.__oops && (x.status === 0 || x.status >= 400)) crumb(httpCrumb("xhr", x.__oops[0], x.__oops[1], x.status));
          });
        } catch {
          /* ignore */
        }
        // eslint-disable-next-line prefer-rest-params
        return send.apply(this, arguments as unknown as Parameters<XMLHttpRequest["send"]>);
      };
    }

    // console.warn / console.error → breadcrumbs; console.error → event.
    if (attr("console") === "true" && w.console) {
      const con = w.console;
      for (const level of ["warn", "error"] as const) {
        const orig = con[level];
        con[level] = function () {
          // eslint-disable-next-line prefer-rest-params
          const args = Array.prototype.slice.call(arguments) as unknown[];
          try {
            if (level === "error")
              report(isErrorLike(args[0]) ? normaliseError(args[0]) : { message: formatArgs(args) }, { level: "error" }, true);
            crumb({ category: "console", level: level === "warn" ? "warning" : "error", message: formatArgs(args) });
          } catch {
            /* ignore */
          }
          // eslint-disable-next-line prefer-rest-params
          return orig.apply(con, arguments as unknown as unknown[]);
        };
      }
    }
  } catch {
    /* the SDK must never break the host page */
  }
})();
