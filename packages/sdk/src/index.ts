/**
 * oops tracker — the script a site drops in to count page views:
 *
 *   <script defer src="https://metrics.3m4.net/m.js" data-key="oops_pub_…"></script>
 *
 * - Sends one hit per page view (and per SPA route change) to /api/collect
 *   with `navigator.sendBeacon` (falls back to `fetch` with keepalive). Bodies
 *   are `text/plain` JSON so there is no CORS preflight.
 * - No cookies, no localStorage, nothing persisted in the browser; visitors
 *   are counted server-side with a daily salted hash.
 * - Never throws into the host page: every failure is swallowed.
 * - Exposes `window.oops.track(name, props)` for custom events and
 *   `window.oops.pageview()` for manual page views, and auto-tracks clicks
 *   on elements with `data-oops-event="name"`.
 *
 * Attributes (on the script tag): data-key (required), data-api (override
 * the collect endpoint), data-spa="false" (no History API hooks),
 * data-hash="true" (hash routing: keep #fragment in the URL), data-dnt="true"
 * (honour the Do Not Track signal), data-local="true" (also track on
 * localhost / IPs / file:).
 */
import { buildPayload, endpointFromScript, isLocalPage, pageUrl, parseProps } from "./payload";

interface MetricsApi {
  track(name: string, props?: Record<string, unknown>): void;
  pageview(): void;
  q?: unknown[][];
}

(function () {
  try {
    const w = window as unknown as { oops?: MetricsApi; doNotTrack?: string; history: History };
    const d = document;
    const script =
      (d.currentScript as HTMLScriptElement | null) ||
      (d.querySelector("script[data-key][src*='m.js'], script[data-key][src*='/m/v1']") as HTMLScriptElement | null);
    const key = script && script.getAttribute("data-key");
    if (!script || !key) return;

    const attr = (name: string) => script.getAttribute("data-" + name);
    const api = attr("api") || endpointFromScript(script.getAttribute("src"));
    const spa = attr("spa") !== "false";
    const hashMode = attr("hash") === "true";
    const honourDnt = attr("dnt") === "true";
    const local = attr("local") === "true";
    const dnt = honourDnt && (navigator.doNotTrack === "1" || w.doNotTrack === "1");
    const ignored = dnt || (!local && isLocalPage(location));

    let lastPath = "";
    let firstHit = true;

    function send(name: string, props?: Record<string, unknown>): void {
      if (ignored) return;
      const body = JSON.stringify(
        buildPayload(key as string, name, pageUrl(location.href, hashMode), firstHit ? d.referrer : "", d.title, screen, navigator.language, props),
      );
      firstHit = false;
      try {
        if (navigator.sendBeacon && navigator.sendBeacon(api, new Blob([body], { type: "text/plain" }))) return;
      } catch {
        /* fall through to fetch */
      }
      try {
        fetch(api, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" }, credentials: "omit" }).catch(
          () => {},
        );
      } catch {
        /* nothing to do */
      }
    }

    function page(): void {
      const path = location.pathname + location.search + (hashMode ? location.hash : "");
      if (path === lastPath) return;
      lastPath = path;
      send("pageview");
    }

    const queued = w.oops && w.oops.q;
    const facade: MetricsApi = {
      track: (name, props) => {
        if (name && name !== "pageview") send(String(name), props);
      },
      pageview: () => {
        lastPath = "";
        page();
      },
    };
    w.oops = facade;
    if (Array.isArray(queued)) {
      for (const call of queued) {
        const [method, ...args] = call as [keyof MetricsApi, ...unknown[]];
        const fn = facade[method];
        if (typeof fn === "function") (fn as (...a: unknown[]) => void).apply(facade, args);
      }
    }
    if (ignored) return;

    if (spa) {
      const h = w.history;
      const push = h.pushState;
      const replace = h.replaceState;
      h.pushState = function (this: History) {
        // eslint-disable-next-line prefer-rest-params
        push.apply(this, arguments as unknown as Parameters<History["pushState"]>);
        page();
      };
      h.replaceState = function (this: History) {
        // eslint-disable-next-line prefer-rest-params
        replace.apply(this, arguments as unknown as Parameters<History["replaceState"]>);
        page();
      };
      addEventListener("popstate", page);
      if (hashMode) addEventListener("hashchange", page);
    }

    d.addEventListener(
      "click",
      (ev) => {
        const target = ev.target as Element | null;
        const el = target && target.closest ? target.closest("[data-oops-event]") : null;
        if (el) facade.track(el.getAttribute("data-oops-event") || "", parseProps(el.getAttribute("data-oops-props")));
      },
      true,
    );

    // Prerendered pages: wait until the user actually sees the page.
    if ((d as Document & { prerendering?: boolean }).prerendering || d.visibilityState === ("prerender" as DocumentVisibilityState)) {
      const once = () => {
        if (d.visibilityState === "visible") {
          d.removeEventListener("visibilitychange", once);
          page();
        }
      };
      d.addEventListener("visibilitychange", once);
    } else {
      page();
    }
  } catch {
    /* the tracker must never break the host page */
  }
})();
