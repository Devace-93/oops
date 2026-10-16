# oops — Interface Contract

This file is the shared contract between the backend (Flask), the Qwik frontend,
the tracker script and the MCP server. All of them build against it. Keep it in
sync.

oops is a privacy-friendly web-analytics service: an **account** registers
**projects** (one per tracked site or app), each project receives **hits**
(page views and custom events) through a per-project public key — from the
**tracker script** (`/m.js`), the **pixel** or the **collect API** — and the
dashboard, the REST API and the MCP server read the aggregated **stats**.

Vocabulary:

- **hit** = one row in `events`: a page view (`kind=pageview`) or a custom
  event (`kind=event`, with a `name` and optional `props`).
- **visitor** = a daily, per-project, cookie-less hash of (IP, user agent).
  Over several days, "visitors" is the sum of daily uniques.
- **dimension** = a column you can break down or filter by: `path`, `hostname`,
  `referrer`, `country`, `region`, `city`, `device`, `browser`, `os`, `lang`,
  `utm_source`, `utm_medium`, `utm_campaign`, `name`, `ip` (values only when
  the project stores addresses).
- **features** = oops' *own* switches (`packages/shared/feature_flags.json`,
  resolved from PostHog, exposed as `GET /api/features` and `me.features`).

## Ports (container)

| Service  | Port | Notes |
|----------|------|-------|
| api      | 5000 | Flask JSON API, mounted at `/api` by Caddy |
| web      | 3000 | Qwik City (Bun) SSR server: marketing, dashboard, `/m.js` |
| mcp      | 3333 | Streamable HTTP MCP server, mounted at `/mcp` by Caddy |
| postgres | 5432 | |
| redis    | 6379 | db0 rate-limit storage |
| caddy    | 8084 | dev entrypoint (prod: routed by the 3m4 edge Caddy, see deploy/PRODUCTION.md) |

Local dev lives on `http://localhost:8084` (8080 is 3m4, 8081 exp, 8082 retro).
Frontend tooling is **Bun**. Compose project name is `oops`.

## Auth

- Dashboard: JWT bearer, `Authorization: Bearer <access_token>`. Access TTL
  ~30 min; refresh token (opaque, stored hashed) ~30 days.
- Management API: API keys, header `X-API-Key: oops_live_…` (maps to an
  account). The MCP server also accepts the key as `Authorization: Bearer`.
- Collect API: project **public keys**, header `X-Project-Key: oops_pub_…`
  or the `k` / `project_key` field of the body or query string (so the pixel
  can be a plain `<img>`). A public key identifies exactly one project; it has
  no role, cannot read anything and cannot call the management API. It is
  *public by design* (it ships in the snippet); abuse is contained by rate
  limits, size caps, the bot filter and the per-project `allowed_origins`, and
  it can be rotated at any time.

Keys are stored as sha256 hashes plus a non-sensitive prefix
(`oops_live_AbCd`, `oops_pub_AbCd`); the full secret is returned exactly
once (creation / rotation). Exception: the public key is also shown in the
project settings (it is not a secret), so `Project.public_key` is always
present for the owner.

### Authorization (RBAC)

- Every API key has a **role** (`viewer` | `editor` | `admin`). Roles → scopes
  live in `packages/shared/api_key_roles.json` (shared by API, dashboard, MCP).
- Scopes: `projects:read|write|delete`, `stats:read`, `events:delete`,
  `usage:read`, `audit:read`. Dashboard JWT sessions hold every scope.
- Each endpoint names its scope. Missing scope → **403**
  `{ "error": { "code": "insufficient_scope", "message", "required_scope", "role" } }`
  plus an `auth.denied` audit event.
- Audit: every mutation and every denial is appended to `audit_events` in the
  same transaction. Actions: `project.create|update|delete|rotate_key`,
  `events.purge`, `apikey.create|revoke`, `auth.denied`. Hits are **not**
  audited (they are end-user traffic, metered instead).

## Limits and metering

Plan limits come from `packages/shared/plan_limits.json`. While the
`early-access` feature is ON every account gets the `enterprise` limits.

- **Hard limits** (creation blocked with **402** `limit_reached`, `error.which`
  = `projects` | `api_keys`).
- **Soft-drop limit**: `events_per_month`. Every hit received by the collect
  API counts +1 on the account's calendar-month counter (`usage.events`). Past
  the limit the API keeps answering 202 (a tracked site never sees an error)
  but the hit is **not stored** (`{ok:false, reason:"limit"}`); the counter
  keeps counting so the overage is visible (`usage.events_dropped`), and one
  PostHog `limit_reached {which: "events"}` event fires per period.
- **Retention**: `retention_days`. `python -m dbcore.cli prune-events` (cron)
  deletes events older than the account plan's window.

## Privacy

- Raw IPs are not stored by default. `ip_hash = sha256(ip + ":" + daily_salt)`
  where `daily_salt = sha256(IP_HASH_SECRET + ":" + YYYY-MM-DD)`; used for
  rate limits only. A project with `store_ip: true` keeps the raw address in
  `Event.ip` (≤ 45 chars, IPv6 included); it then shows in the event log and
  as the `ip` dimension.
- `visitor_hash = sha256(daily_salt + ":" + project_id + ":" + ip + ":" + user_agent)`.
  No cookie, no localStorage, no cross-day or cross-site identity. The raw
  user agent is parsed into `device` / `browser` / `os` and discarded.
- Location (`country`, `region`, `city`) comes from the GeoLite2 database
  (`GEOIP_DB_PATH`) while the `geo` feature is ON; the IP is only used
  transiently for the lookup. No database = all three are null.
- Page URLs lose their query string before storage (it is only read for the
  three `utm_*` tags), so tokens and emails in URLs never reach the dashboard.
- `title` ≤ 200, `path` ≤ 2048, `referrer` ≤ 2048 (scheme + host + path, no
  query), `props` ≤ 2 KB JSON, `name` ≤ 60.

## REST API (all under `/api`)

Responses are JSON. Errors: `{ "error": { "code": "string", "message": "string" } }`.
Rate limits: default `RATE_LIMIT_DEFAULT` per IP; management routes called with
an API key add `RATE_LIMIT_PUBLIC_API` per key; collect routes use
`RATE_LIMIT_COLLECT` per (project, IP) instead of the default.

CORS: management routes allow the dashboard origin only. **Collect routes
allow any origin** (no credentials; preflight allows `Content-Type`,
`X-Project-Key`, `Authorization`) because they are called from tracked sites.
Request bodies are capped at 64 KB (413).

### Auth

- `POST /auth/register` `{email, password, account_name?}` → `{user, account, access_token, refresh_token}` (201). Gated by feature `signups`.
- `POST /auth/login` `{email, password}` → `{user, account, access_token, refresh_token}`
- `POST /auth/refresh` `{refresh_token}` → `{access_token}`
- `POST /auth/logout` `{refresh_token}` → 204
- `GET  /auth/me` → `{user, account, plan, limits, usage, counts:{projects}, features}`

### Projects

- `GET    /projects?q=` → `{items:[Project], total}` — `projects:read`. Newest first; `q` searches name, key and URL.
- `POST   /projects` `{name, key?, description?, url?, timezone?, allowed_origins?, store_ip?}` → Project (201) — `projects:write`.
  `key` defaults to a slug of `name`; must match `^[a-z0-9][a-z0-9-]{0,62}$`
  and be unique per account (409 `key_taken`). `timezone` is an IANA name
  (400 `invalid_timezone`), default `UTC`. Generates the public key.
  402 `limit_reached` (`which: "projects"`).
- `GET    /projects/:id` → Project — `projects:read`
- `PATCH  /projects/:id` `{name?, description?, url?, timezone?, allowed_origins?, collect_enabled?, exclude_bots?, store_ip?}` → Project — `projects:write`.
  `allowed_origins` is a list (≤ 20) of hostnames (`example.com`,
  `*.example.com`; full URLs are reduced to their host; 400 `invalid_origins`).
- `DELETE /projects/:id` → 204 — `projects:delete` (cascades events)
- `POST   /projects/:id/rotate-key` → `{public_key, public_key_prefix}` — `projects:write`. The old key stops working immediately. Audit `project.rotate_key`.
- `GET    /projects/:id/summary` → Summary — `stats:read`.
- `DELETE /projects/:id/events?before=YYYY-MM-DD` → `{deleted, before}` — `events:delete`. Without `before`, everything. Audit `events.purge`.

`:id` is the project UUID. Every project endpoint is scoped to `g.account_id`;
a project of another account is a 404, never a 403.

### Stats (`stats:read`)

Common query parameters (the **range**):

| param | meaning |
|---|---|
| `period` | `today` \| `yesterday` \| `7d` \| `30d` (default) \| `90d` \| `12mo` — local dates in `tz` |
| `from`, `to` | `YYYY-MM-DD`, inclusive local dates; override `period`. Max span 400 days (400 `invalid_range`) |
| `tz` | IANA zone, default the project's `timezone` (400 `invalid_tz`) |
| `interval` | `hour` \| `day` \| `month`; auto: hour ≤ 2 days, month > 120 days |
| any dimension | filter, e.g. `country=ES&device=mobile`; `referrer=(direct)` selects hits without referrer; `name=` implies `kind=event` |

- `GET /projects/:id/stats?…&limit=8` → Stats (totals, previous period of the same length, series, every dimension's top `limit` rows (1–50), live).
- `GET /projects/:id/stats/breakdown?by=<dimension>&page=1&per_page=50&…` → `{project_id, range, filters, by, items:[BreakdownRow], page, per_page, total}` (400 `invalid_dimension`). Sorted by visitors then page views; `name` by events.
- `GET /projects/:id/stats/series?…` → `{project_id, range, filters, series}`
- `GET /projects/:id/events?…&kind=pageview|event&q=&page=1&per_page=50` → `{project_id, range, filters, items:[Event], page, per_page, total}` newest first. `q` matches path, title or event name.
- `GET /projects/:id/live` → Live (last `LIVE_WINDOW_MIN` minutes, default 5).

### Collect (end users; project public key)

Feature `collect-api` OFF → 503 `feature_disabled`. Unknown/rotated key → 401
`invalid_project_key`. Rate limited per (project, IP). Every accepted request
answers **202** with a tiny JSON body; a tracked site never sees a 4xx for a
valid, well-formed hit.

- `POST /collect` (also `/collect/` and `/collect/event`). Body is JSON (any
  content type — the tracker posts `text/plain` to avoid a preflight), form
  fields or the query string. Fields (short keys are what the tracker sends,
  long aliases are accepted):

  | field | rules |
  |---|---|
  | `k` / `project_key` | required if no header |
  | `n` / `name` | event name; `pageview` (default) or 1–60 chars `[A-Za-z0-9_][A-Za-z0-9_ .:/-]*` (400 `invalid_name`) |
  | `u` / `url` | full URL or path. Hostname → `hostname`, path → `path`, query → UTM tags only |
  | `r` / `referrer` | referrer URL; dropped when its host equals the page host |
  | `t` / `title` | ≤ 200 |
  | `w`, `h` | screen size, 1–20000 |
  | `l` / `lang` | ≤ 16 |
  | `p` / `props` | JSON object ≤ 2 KB, custom events only (400 `invalid_props` / `props_too_large`) |
  | `s` / `source` | `script` (default) \| `pixel` \| `api` |

  Response `{ "ok": true }` when stored, or `{ "ok": false, "reason": r }` with
  `r` = `paused` (`collect_enabled` is false) · `origin` (page host — from the
  URL or the `Origin` / `Referer` header — not in `allowed_origins`; a bare path
  with no header passes, since it cannot be attributed to a host) · `bot` (UA looks like a crawler / headless browser and
  `exclude_bots` is true) · `limit` (over the monthly budget). Bots and
  origin / paused drops are not metered; limit drops are.
  Device, browser, OS, location, `visitor_hash` and `ip_hash` come from the
  request itself; the server time is the hit time.
- `GET /collect/pixel.gif?k=…&u=/path&n=open&r=&t=` → a 43-byte transparent
  GIF (`Cache-Control: no-store`), source `pixel`. `u` falls back to the
  `Referer` header. Always answers the GIF, even for an invalid hit.

### Account / keys

- `GET /account/usage` → Usage — JWT or key, `usage:read`
- `GET /account/audit?limit=50&action=` → `{items:[AuditEvent], limit}` newest first — JWT or key, `audit:read`
- `GET /apikeys` → `[{id, name, prefix, role, last_used_at, created_at}]` (JWT)
- `GET /apikeys/roles` → `{default_role, roles:{viewer|editor|admin: {label, description, scopes}}}` (public)
- `POST /apikeys` `{name, role?}` → `{id, key, prefix, name, role}` (201; full key shown once; 400 `invalid_role`; 402 `which: "api_keys"`) (JWT)
- `GET /apikeys/me` → `{account, key:{id, prefix, role}, scopes:[...]}` (API key only; what the MCP server calls at startup)
- `DELETE /apikeys/:id` → 204 (JWT)

### Features (oops' own switches)

- `GET /features` → `{features:{<key>: bool}}`. Public; an optional bearer token upgrades resolution to the account's targeting bucket.

### MCP (AI agents)

- Streamable HTTP endpoint `POST /mcp` (Caddy → `mcp:3333`), auth `Authorization: Bearer oops_live_…` (or `X-API-Key`). Stateless; one server per request bound to the caller's key.
- stdio flavour published to npm as `oops-errors-mcp`. Tools/roles table in `packages/mcp-server/README.md`.
- Tools (scope in parentheses): `list_projects` `get_project` (projects:read) ·
  `create_project` `update_project` `rotate_project_key` (projects:write) ·
  `delete_project` (projects:delete, needs confirmation) ·
  `project_summary` `get_stats` `get_breakdown` `list_events` `get_live` (stats:read) ·
  `purge_events` (events:delete, needs confirmation) ·
  `get_usage` (usage:read) · `get_audit_log` (audit:read).
- Resources `oops://projects` and `oops://projects/{id}/summary`; prompt
  `weekly_report` (project) walks a model through the last 7 days vs the week before.
- Destructive tools ask the user through MCP elicitation when the client
  supports it, otherwise refuse until called with `confirm: true`.

### Billing (only when BILLING_ENABLED=true)

- `GET  /billing/offerings` → offerings/packages for the paywall
- `POST /billing/webhook` ← RevenueCat (server-to-server; verifies `Authorization` header)

### Health

- `GET /healthz` → `{status:"ok"}` (also `/api/healthz` behind Caddy)

## Objects

### Project
```json
{
  "id": "uuid",
  "key": "kinegram",
  "name": "Kinegram Generator",
  "description": "optional",
  "url": "https://kinegram.3m4.net",
  "public_key": "oops_pub_…   (always, owner-only object)",
  "public_key_prefix": "oops_pub_AbCd",
  "timezone": "Europe/Madrid",
  "allowed_origins": ["kinegram.3m4.net"],
  "collect_enabled": true,
  "exclude_bots": true,
  "store_ip": false,
  "counts": { "pageviews_30d": 1284, "visitors_30d": 611, "pageviews_today": 42, "last_event_at": "2026-10-15T10:00:00Z" },
  "created_at": "2026-10-15T10:00:00Z",
  "updated_at": "2026-10-15T10:00:00Z"
}
```

### Event
```json
{
  "id": 123,
  "ts": "2026-10-15T10:00:00Z",
  "kind": "pageview",
  "name": null,
  "hostname": "kinegram.3m4.net",
  "path": "/editor",
  "title": "Editor",
  "referrer": "https://news.ycombinator.com/item",
  "referrer_host": "news.ycombinator.com",
  "utm_source": null, "utm_medium": null, "utm_campaign": null,
  "country": "ES", "region": "Madrid", "city": "Madrid",
  "device": "desktop", "browser": "Firefox", "os": "Linux",
  "screen_w": 1440, "screen_h": 900,
  "lang": "es-ES",
  "visitor": "a1b2c3d4",
  "ip": null,
  "source": "script",
  "props": {}
}
```
`kind` ∈ `pageview` | `event`. `device` ∈ `desktop` | `mobile` | `tablet` |
`bot` | `null`. `source` ∈ `script` | `pixel` | `api`. `visitor` is the first 8
chars of the daily visitor hash; `ip` is the raw address when the project has
`store_ip` on, otherwise null.

### Totals / SeriesPoint / BreakdownRow
```json
{ "pageviews": 1284, "visitors": 611, "events": 37 }
{ "bucket": "2026-10-15", "pageviews": 42, "visitors": 30, "events": 2 }
{ "value": "/docs", "pageviews": 612, "visitors": 480, "events": 0 }
```
`bucket` is a local key: `YYYY-MM-DDTHH:00` (hour), `YYYY-MM-DD` (day),
`YYYY-MM` (month). Missing buckets are present with zeros. For `referrer`,
hits without a referrer appear as `"(direct)"`; other dimensions skip nulls.

### Stats
```json
{
  "project_id": "uuid",
  "range": { "from": "2026-09-16", "to": "2026-10-15", "tz": "Europe/Madrid", "interval": "day", "days": 30 },
  "filters": { "country": "ES" },
  "totals": Totals,
  "previous": Totals,
  "series": [SeriesPoint],
  "breakdowns": { "path": [BreakdownRow], "referrer": [...], "country": [...], "region": [...], "city": [...], "device": [...], "browser": [...], "os": [...], "lang": [...], "utm_source": [...], "utm_medium": [...], "utm_campaign": [...], "name": [...] },
  "live": Live
}
```

### Live
```json
{ "window_minutes": 5, "visitors": 7, "pageviews": 11, "pages": [ { "path": "/", "visitors": 4, "pageviews": 5 } ] }
```

### Summary
```json
{
  "project_id": "uuid",
  "timezone": "Europe/Madrid",
  "today": Totals, "yesterday": Totals, "last_7_days": Totals, "last_30_days": Totals,
  "live_visitors": 7,
  "last_event_at": "2026-10-15T10:00:00Z",
  "all_time_pageviews": 98213
}
```

### Usage
```json
{
  "period_start": "2026-10-01",
  "period_end": "2026-11-01",
  "events": 12345,
  "events_dropped": 0,
  "counts": { "projects": 2, "api_keys": 1 },
  "limits": { "...plan_limits.json entry..." }
}
```

### AuditEvent
```json
{ "id", "ts", "actor_type": "user|api_key|system", "actor_id", "actor_label", "action", "target_type", "target_id", "outcome": "ok|denied|error", "meta": {} }
```

## Tracker contract (`/m.js`)

Built from `packages/tracker` (TypeScript, zero dependencies, ES2019, ≤ 3 KB
gzipped) into `apps/web/public/m.js` (IIFE) so the web service serves it at
`https://metrics.3m4.net/m.js`. Versioned copy at `/m/v1.js` (same file).
Caddy adds `Cache-Control: public, max-age=3600` and `Access-Control-Allow-Origin: *`.

```html
<script defer src="https://metrics.3m4.net/m.js" data-key="oops_pub_…"></script>
```

- Attributes: `data-key` (required), `data-api` (collect endpoint, default
  script origin + `/api/collect`), `data-spa` (`true` default: hooks
  `pushState` / `replaceState` / `popstate`), `data-hash` (`true` keeps the
  `#fragment` and listens to `hashchange`), `data-dnt` (`true` honours Do Not
  Track), `data-local` (`true` also tracks on localhost / raw IPs / `file:` /
  `*.local`, which are skipped by default).
- Sends `{k, n, u, r, t, w, h, l, s:"script", p?}` as `text/plain` JSON via
  `navigator.sendBeacon`, falling back to `fetch(..., {keepalive:true})`. The
  referrer is only sent with the first hit of a page load (SPA navigations
  send an empty one). One page view per distinct path; the first is sent on
  load, or when a prerendered page becomes visible.
- Global `window.oops`: `track(name, props?)`, `pageview()`. Calls queued
  before load as `window.oops = { q: [["track", "x", {...}]] }` are replayed.
- Declarative: clicks on `[data-oops-event="name"]` (bubbling, capture
  phase) send that event with the JSON in `data-oops-props`.
- No cookies, no storage, no fingerprinting. Never throws into the host page.

## Frontend contract

- Same chrome as the other 3m4 apps: footer (author → Source → info.3m4.net,
  then pricing/blog/sponsors), language picker (34 locales, `3m4.lang`),
  theme toggle (`3m4.theme`). Tokens in localStorage `oops_access_token` /
  `oops_refresh_token`.
- Routes: `/` landing · `/info` + `/info/pricing` + `/info/docs` (tracker,
  pixel, collect API, REST reference, MCP) · `/blog` · `/sponsors` · `/login` ·
  `/signup` · `/dashboard` (projects with 30-day counts, usage) ·
  `/dashboard/projects/[id]` (overview: one filter row with period presets +
  custom range, live counter, KPI tiles with deltas, one-metric column chart,
  breakdown cards with click-to-filter and a paginated "view all" modal) ·
  `/dashboard/projects/[id]/events` (raw event log with expandable rows) ·
  `/dashboard/projects/[id]/settings` (public key + rotate, install snippets
  with the real key: script / pixel / custom events / API, tracking switches,
  time zone, allowed hostnames, project info, purge, delete) ·
  `/dashboard/settings` (API keys, audit) · `/dashboard/billing` (hidden in early access).
- Brand colour: Tailwind **fuchsia** scale as `primary` (3m4 blue, exp violet,
  retro emerald, bubbles orange).
