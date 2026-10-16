# @oops/sdk

The script a site drops in to report its JavaScript errors to
[oops](https://oops.3m4.net). Zero dependencies, ES2019, under 4 KB gzipped
(the build fails over budget), nothing persisted in the browser. Built by
`bun run build` into `apps/web/public/o.js` (and `/o/v1.js`), which the web
service serves.

```html
<script defer src="https://oops.3m4.net/o.js" data-key="oops_pub_…" data-env="production" data-release="1.4.2"></script>
```

## What it captures

- Uncaught errors (`window` `error` event) and `unhandledrejection`.
- `console.error` calls when `data-console="true"` (an `Error` argument keeps
  its stack; anything else becomes a message-only event).
- A ring buffer of the last 30 **breadcrumbs**, sent with every event: clicks
  (`button#pay.btn` + text ≤ 60), SPA navigation (`pushState` /
  `replaceState` / `popstate`), failed `fetch` / `XMLHttpRequest` (status
  ≥ 400 or network error; method + URL without query) and `console.warn` /
  `console.error` when enabled.

Each event is posted as `text/plain` JSON (no CORS preflight) to
`<script origin>/api/ingest` with `navigator.sendBeacon`, falling back to
`fetch` with `keepalive`. The payload is the ingest contract verbatim:
`k, type, message, level, stack, frames, url, release, environment,
platform: "javascript", sdk: "oops-js/0.1.0", user, tags, extra, breadcrumbs,
fingerprint, ts`. The stack is parsed client-side into `frames` (V8 and
Firefox / Safari formats, top frame first, `in_app` = same origin as the page
or a relative path) and the raw `stack` string travels too.

Client-side hygiene: identical events (type + message + top frame) within
2 s are dropped, at most 30 events per minute per page, `localhost` / raw IP /
`file:` / `*.local` pages are skipped unless `data-local="true"`, and
`data-sample` keeps only a fraction of *automatic* error events (explicit
`capture` / `message` calls always go through). The script never throws into
the host page.

## Attributes

| Attribute | Default | Meaning |
|---|---|---|
| `data-key` | — | the project's public key (required) |
| `data-api` | script origin + `/api/ingest` | full ingest endpoint URL, for instances behind another host |
| `data-env` | `production` | `environment` label on every event |
| `data-release` | — | `release` label (version or git sha) |
| `data-console` | `false` | capture `console.error` as events and `console.warn` / `console.error` as breadcrumbs |
| `data-local` | `false` | also report from `localhost`, raw IPs, `file:` and `*.local` |
| `data-sample` | `1` | fraction (`0`–`1`) of automatic error events to send |
| `data-user` | — | initial user as JSON: `'{"id":"u_42","email":"…","name":"…"}'` |

## JavaScript API

Available as `window.oops` once the script has loaded. Calls made before that
can be queued: `window.oops = { q: [["setUser", { id: "u_42" }]] }` and they are
replayed on load.

```js
oops.capture(new Error("manual"), { level: "warning", tags: { page: "checkout" }, extra: { cart: 3 }, fingerprint: ["checkout", "pay-failed"] });
oops.message("Checkout opened", "info", { tags: { step: "1" } });  // level: fatal | error | warning | info
oops.setUser({ id: "u_42", email: "a@b.c", name: "Ada" });          // null clears it
oops.setTag("plan", "pro");
oops.setTags({ plan: "pro", region: "eu" });
oops.setContext("cart", { items: 3 });                                // merged into `extra`
oops.breadcrumb({ category: "ui", message: "modal opened", level: "info", data: { id: "pay" } });
oops.flush();                                                         // no-op, API symmetry
```

## Development

```bash
bun install && bun test && bun run build   # unit tests (stack parser, payload, dedup, sampling…) + o.js
```

Size as of 0.1.0: ~6.3 KB raw, ~2.95 KB gzipped.
