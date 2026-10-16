# oops — Interface Contract

This file is the shared contract between the backend (Flask), the Qwik frontend,
the browser SDK and the MCP server. All of them build against it. Keep it in
sync.

oops is an error-tracking service: an **account** registers **projects** (one
per app, site or service), each project receives **error events** through a
per-project public key — from the **browser SDK** (`/o.js`) or the **ingest
API** — the server groups them into **issues** by fingerprint, and the
dashboard, the REST API and the MCP server read, triage and resolve them.

Vocabulary:

- **event** = one row in `events`: a single occurrence of an error (or a
  captured message) with its stack frames, breadcrumbs, tags and context.
- **issue** = the group every event lands in, keyed by `fingerprint`. It
  carries the counters (`event_count`, `user_count`), `first_seen` /
  `last_seen`, a `status` (`open` | `resolved` | `ignored`) and a per-project
  `number` (`#12`) for humans.
- **fingerprint** = sha256 of the client-provided `fingerprint` array when
  present, otherwise of `type` + normalised `message` + the top in-app frame
  (`filename` without query string + `function`). Normalisation replaces runs
  of digits, hex blobs ≥ 8 chars, UUIDs and quoted strings with placeholders
  and truncates to 200 chars, so `User 42 not found` and `User 43 not found`
  are one issue.
- **level** = `fatal` | `error` | `warning` | `info` (default `error`).
- **environment** (`production` by default) and **release** (free text, e.g.
  `1.4.2` or a git sha) are free-form labels on every event, used as filters.
- **affected users** = `COUNT(DISTINCT user_hash)`: the client's own `user.id`
  (hashed per project) when it sends one, otherwise the daily cookie-less
  visitor hash of (IP, user agent).
- **features** = oops' *own* switches (`packages/shared/feature_flags.json`,
  resolved from PostHog, exposed as `GET /api/features` and `me.features`).

## Ports (container)

| Service  | Port | Notes |
|----------|------|-------|
| api      | 5000 | Flask JSON API, mounted at `/api` by Caddy |
| web      | 3000 | Qwik City (Bun) SSR server: marketing, dashboard, `/o.js` |
| mcp      | 3333 | Streamable HTTP MCP server, mounted at `/mcp` by Caddy |
| postgres | 5432 | |
| redis    | 6379 | db0 rate-limit storage |
| caddy    | 8084 | dev entrypoint (prod: routed by the 3m4 edge Caddy, see deploy/PRODUCTION.md) |

Local dev lives on `http://localhost:8084` (8080 is 3m4, 8081 exp, 8082 retro,
8083 metrics). Frontend tooling is **Bun**. Compose project name is `oops`.

## Auth

- Dashboard: JWT bearer, `Authorization: Bearer <access_token>`. Access TTL
  ~30 min; refresh token (opaque, stored hashed) ~30 days.
- Management API: API keys, header `X-API-Key: oops_live_…` (maps to an
  account). The MCP server also accepts the key as `Authorization: Bearer`.
- Ingest API: project **public keys**, header `X-Project-Key: oops_pub_…` or
  the `k` / `project_key` field of the body. A public key identifies exactly
  one project; it has no role, cannot read anything and cannot call the
  management API. It is *public by design* (it ships in the SDK snippet);
  abuse is contained by rate limits, size caps and the per-project
  `allowed_origins`, and it can be rotated at any time.

Keys are stored as sha256 hashes plus a non-sensitive prefix
(`oops_live_AbCd`, `oops_pub_AbCd`); the full secret is returned exactly once
(creation / rotation). Exception: the public key is also shown in the project
settings (it is not a secret), so `Project.public_key` is always present for
the owner.

### Authorization (RBAC)

- Every API key has a **role** (`viewer` | `editor` | `admin`). Roles → scopes
  live in `packages/shared/api_key_roles.json` (shared by API, dashboard, MCP).
- Scopes: `projects:read|write|delete`, `issues:read`, `issues:write`,
  `events:delete`, `usage:read`, `audit:read`. Dashboard JWT sessions hold
  every scope.
  - viewer: `projects:read`, `issues:read`, `usage:read`
  - editor: viewer + `projects:write`, `issues:write`
  - admin: editor + `projects:delete`, `events:delete`, `audit:read`
- Each endpoint names its scope. Missing scope → **403**
  `{ "error": { "code": "insufficient_scope", "message", "required_scope", "role" } }`
  plus an `auth.denied` audit event.
- Audit: every mutation and every denial is appended to `audit_events` in the
  same transaction. Actions: `project.create|update|delete|rotate_key`,
  `issue.update`, `issues.bulk_update`, `events.purge`, `apikey.create|revoke`,
  `auth.denied`. Ingested events are **not** audited (they are end-user
  traffic, metered instead).

## Limits and metering

Plan limits come from `packages/shared/plan_limits.json`. While the
`early-access` feature is ON every account gets the `enterprise` limits.

- **Hard limits** (creation blocked with **402** `limit_reached`, `error.which`
  = `projects` | `api_keys`).
- **Soft-drop limit**: `events_per_month`. Every event received by the ingest
  API counts +1 on the account's calendar-month counter (`usage.events`). Past
  the limit the API keeps answering 202 (an app reporting an error never gets
  a second error back) but the event is **not stored**
  (`{ok:false, reason:"limit"}`); the counter keeps counting so the overage is
  visible (`usage.events_dropped`), and one PostHog `limit_reached
  {which: "events"}` event fires per period.
- **Retention**: `retention_days`. `python -m dbcore.cli prune-events` (cron)
  deletes events older than the account plan's window, then deletes issues
  left with zero events and recomputes `event_count` / `user_count` on the
  ones that lost events.

## Privacy and payload hygiene

- Raw IPs are not stored by default. `ip_hash = sha256(ip + ":" + daily_salt)`
  where `daily_salt = sha256(IP_HASH_SECRET + ":" + YYYY-MM-DD)`; used for
  rate limits and the anonymous visitor hash only. A project with
  `store_ip: true` keeps the raw address in `Event.ip` (≤ 45 chars).
- `user_hash = sha256(project_id + ":" + user.id)` when the client sends a
  user id, else `sha256(daily_salt + ":" + project_id + ":" + ip + ":" + ua)`.
  The client-provided `user` object (`id` ≤ 120, `email` ≤ 255, `name` ≤ 120)
  is stored as sent: it is the developer's own identifier for their own user.
- The raw user agent is parsed into `browser` / `os` / `device` and discarded.
- URLs lose query string and fragment before storage (`url` keeps
  scheme + host + path, ≤ 2048; `path` and `hostname` are derived).
- **Scrubbing**: inside `tags`, `extra`, `breadcrumbs[].data` and `user`, any
  key matching `/password|passwd|secret|token|authorization|cookie|api[_-]?key|card|cvv|ssn/i`
  has its value replaced by `"[Filtered]"`. Strings that look like bearer
  tokens or card numbers inside `message` are replaced too.
- Caps: `type` ≤ 200, `message` ≤ 4096 (fingerprint uses the first 200
  normalised chars), `frames` ≤ 50 (keep the first 50 from the top),
  `frames[].filename` ≤ 1024, `frames[].function` ≤ 255, `stack` (raw string)
  ≤ 16 KB, `tags` ≤ 20 pairs (key ≤ 40, value ≤ 200), `extra` ≤ 8 KB JSON,
  `breadcrumbs` ≤ 30 items / 8 KB (keep the last 30), `fingerprint` ≤ 5 × 100,
  `environment` ≤ 40, `release` ≤ 100, `platform` ≤ 30, `sdk` ≤ 60. Request
  bodies are capped at 64 KB (413); a batch holds ≤ 20 events.

## REST API (all under `/api`)

Responses are JSON. Errors: `{ "error": { "code": "string", "message": "string" } }`.
Rate limits: default `RATE_LIMIT_DEFAULT` per IP; management routes called with
an API key add `RATE_LIMIT_PUBLIC_API` per key; ingest routes use
`RATE_LIMIT_INGEST` per (project, IP) instead of the default.

CORS: management routes allow the dashboard origin only. **Ingest routes allow
any origin** (no credentials; preflight allows `Content-Type`,
`X-Project-Key`, `Authorization`) because they are called from the apps that
embed the SDK. `text/plain` bodies are accepted so the SDK can post without a
preflight.

### Auth

| Method | Path | Body / notes |
|---|---|---|
| POST | `/auth/register` | `{ email, password, account_name? }` → 201 `{ user, account, access_token, refresh_token }`. 403 `signups_disabled` while the `signups` feature is OFF. |
| POST | `/auth/login` | `{ email, password }` → 200 same shape. |
| POST | `/auth/refresh` | `{ refresh_token }` → `{ access_token, refresh_token }` (rotation). |
| POST | `/auth/logout` | `{ refresh_token }` → 204. |
| GET | `/auth/me` | `{ user, account, plan, limits, usage, counts: { projects }, features }`. |

### Projects (`projects:*`)

| Method | Path | Notes |
|---|---|---|
| GET | `/projects` | `{ items: Project[] }`, newest first. `projects:read` |
| POST | `/projects` | `{ name, key?, description?, url?, allowed_origins?, timezone? }` → 201 `Project` (public key included). 402 past the plan. `projects:write` |
| GET | `/projects/<id>` | `Project`. `projects:read` |
| PATCH | `/projects/<id>` | `ProjectPatch` → `Project`. `projects:write` |
| DELETE | `/projects/<id>` | 204, cascades issues and events. `projects:delete` |
| POST | `/projects/<id>/rotate-key` | New public key, old one stops working at once → `Project`. `projects:write` |
| GET | `/projects/<id>/summary` | `{ open_issues, events_24h, events_30d, users_30d, last_event_at }`. `projects:read` |
| DELETE | `/projects/<id>/events` | Purge every event and issue of the project → `{ deleted_events, deleted_issues }`. `events:delete` |

`key` is a slug (`[a-z0-9-]{1,63}`), unique per account, derived from the name
when omitted. `timezone` is an IANA name (default `UTC`) used to bucket days.

### Ingest (project public key; `ingest-api` feature; CORS `*`)

| Method | Path | Notes |
|---|---|---|
| POST | `/ingest`, `/ingest/event` | One event → **202** `{ ok: true, event_id, issue_id, issue_number }` or `{ ok: false, reason }`. |
| POST | `/ingest/batch` | `{ events: [ … ≤ 20 ] }` → 202 `{ ok: true, results: [ per-event result ] }`. |

Event payload (JSON, form-encoded or `text/plain` JSON):

```jsonc
{
  "k": "oops_pub_…",              // or X-Project-Key header
  "type": "TypeError",             // exception class / error name; required unless message is set
  "message": "x is not a function",// required unless type is set
  "level": "error",                // fatal | error | warning | info
  "stack": "TypeError: …\n at …",  // raw stack string, parsed server-side when frames is absent
  "frames": [{ "filename": "https://app/x.js", "function": "init", "lineno": 12, "colno": 4, "in_app": true }],
  "url": "https://app.example/checkout?x=1", // query and fragment dropped on storage
  "release": "1.4.2", "environment": "production", "platform": "javascript", "sdk": "oops-js/0.1.0",
  "user": { "id": "u_42", "email": "…", "name": "…" },
  "tags": { "page": "checkout" }, "extra": { "cart": 3 },
  "breadcrumbs": [{ "ts": "2026-10-16T10:00:00Z", "category": "click", "message": "button#pay", "level": "info", "data": {} }],
  "fingerprint": ["checkout", "pay-failed"],
  "ts": "2026-10-16T10:00:01Z"     // optional client timestamp; server time if missing or > 5 min skew
}
```

Frames are ordered **top of the stack first** (the frame that threw is
`frames[0]`). Stack strings in V8 (`at fn (file:line:col)`), Firefox / Safari
(`fn@file:line:col`) and Python traceback (`File "x", line N, in fn`) formats
are parsed best-effort; unparseable lines are kept in `stack_raw` only.

Drop reasons (always 202): `paused` (`ingest_enabled` false), `origin`
(`allowed_origins` set and the page / `Origin` host is not in it), `limit`
(over the monthly budget). Malformed payloads (neither `type` nor `message`,
bad JSON) are **400** `invalid_event`; a bad key is **401**
`invalid_project_key`; `ingest-api` OFF is **503**.

Ingesting an event upserts its issue in one transaction: new fingerprint →
new issue (`status=open`, `number` = project's next); existing → bump
`event_count`, `last_seen`, `user_count` (recomputed cheaply via
`INSERT … ON CONFLICT` on `issue_users(issue_id, user_hash)`), merge
`environment` / `release` into the issue's `environments` / `releases` (last
10 releases kept). A **resolved** issue that receives a new event
**reopens** (`status=open`, `resolved_at=null`) and sets `regressed_at`.
An **ignored** issue stays ignored but still counts.

### Issues and events (`issues:*`, under `/projects/<id>`)

| Method | Path | Notes |
|---|---|---|
| GET | `/issues` | Paged list. Query: `status` (`open` default, `resolved`, `ignored`, `all`), `level`, `environment`, `release`, `q` (ILIKE on title / culprit / type), `period` (`24h`, `7d`, `30d` default, `90d`, `all`; by `last_seen`), `sort` (`last_seen` default, `first_seen`, `events`, `users`), `page`, `per_page` (≤ 100). → `{ items: Issue[], page, per_page, total }`. `issues:read` |
| GET | `/issues/<issue_id>` | `Issue` with `latest_event: Event`. `<issue_id>` is the uuid or the project number (`12`). `issues:read` |
| PATCH | `/issues/<issue_id>` | `{ status }` → `Issue`. Audit `issue.update`. `issues:write` |
| POST | `/issues/bulk` | `{ ids: [≤ 100], status }` → `{ updated }`. Audit `issues.bulk_update`. `issues:write` |
| GET | `/issues/<issue_id>/events` | Paged occurrences, newest first: `{ items: Event[], page, per_page, total }`. `issues:read` |
| GET | `/events` | Paged events across the project; filters `level`, `environment`, `release`, `q` (message), `issue`, `period`. `issues:read` |
| GET | `/events/<event_id>` | One `Event`. `issues:read` |
| GET | `/stats` | `{ range, totals, previous, series, breakdowns }` (below). `issues:read` |
| GET | `/live` | `{ events: n, window_min }`: events in the last `LIVE_WINDOW_MIN` minutes. `issues:read` |

`GET /stats` query: `period` (`today`, `yesterday`, `24h`, `7d` default,
`30d`, `90d`, `12mo`) or `from` / `to` (dates in the project time zone),
`interval` (`hour` | `day` | `month`, auto by range), filters `level`,
`environment`, `release`.

```jsonc
{
  "range": { "from": "…", "to": "…", "tz": "Europe/Madrid", "interval": "day" },
  "totals":   { "events": 120, "users": 38, "issues_new": 4, "issues_open": 9 },
  "previous": { "events": 90,  "users": 30, "issues_new": 2 },
  "series": [{ "ts": "2026-10-10T00:00:00+02:00", "events": 10, "users": 4 }],
  "breakdowns": {
    "level": [{ "value": "error", "events": 100, "users": 30 }],
    "environment": [...], "release": [...], "browser": [...], "os": [...], "device": [...], "type": [...]
  }
}
```

Each breakdown holds the top 10 values by events.

### Account, keys, features, billing

| Method | Path | Notes |
|---|---|---|
| GET | `/account/usage` | `{ period_start, period_end, events, events_dropped, counts: { projects, api_keys }, limits }`. `usage:read` |
| GET | `/account/audit` | `{ items: AuditEvent[], page, per_page, total }`; filters `action`, `actor_type`, `outcome`, `since`. `audit:read` |
| GET | `/apikeys` | `{ items: ApiKey[] }` (prefix + role, never the secret). JWT only. |
| GET | `/apikeys/roles` | Roles → scopes from `api_key_roles.json`. |
| POST | `/apikeys` | `{ name, role? }` → 201 `{ key: ApiKey, secret }`. 402 past the plan. JWT only. |
| DELETE | `/apikeys/<id>` | Revoke → 204. JWT only. |
| GET | `/apikeys/me` | The calling key: `{ id, name, role, prefix, scopes, account }`. |
| GET | `/features` | `{ features: { key: bool } }` for the caller (anonymous allowed). |
| GET | `/billing/offerings`, POST `/billing/webhook` | Unchanged from the sibling apps (RevenueCat). Hidden while `early-access` is ON. |
| GET | `/healthz` | `{ "status": "ok" }` |

## Objects

```ts
Project {
  id, key, name, description?, url?,
  public_key, public_key_prefix,          // oops_pub_…
  timezone,                               // IANA, default "UTC"
  allowed_origins: string[],              // hostnames, empty = any
  ingest_enabled: boolean,                // pause without touching the snippet
  store_ip: boolean,                      // keep raw IPs on events (default false)
  counts: { open_issues, events_24h, events_30d, users_30d, last_event_at? },
  created_at, updated_at
}
Issue {
  id, project_id, number,                 // #number is per project, starts at 1
  fingerprint, title,                     // "TypeError: x is not a function"
  culprit?,                               // "init in https://app/x.js"
  type?, level, status,                   // open | resolved | ignored
  first_seen, last_seen, resolved_at?, regressed_at?,
  event_count, user_count,
  environments: string[], releases: string[],   // releases: last 10 seen
  latest_event_id?, latest_event?: Event,       // latest_event only on GET /issues/<id>
  created_at, updated_at
}
Event {
  id: string,                             // bigint as string
  project_id, issue_id, issue_number, ts, level,
  type?, message, frames: Frame[], stack_raw?,
  url?, path?, hostname?, release?, environment, platform?, sdk?,
  user?: { id?, email?, name? }, user_hash,
  browser?, os?, device?,                 // from the (discarded) user agent
  ip?,                                    // only with store_ip
  tags: Record<string,string>, extra: object, breadcrumbs: Breadcrumb[],
  source                                  // sdk | api
}
Frame { filename?, function?, lineno?, colno?, in_app: boolean }
Breadcrumb { ts?, category, message?, level?, data? }
ApiKey { id, name, role, prefix, created_at, last_used_at?, revoked_at? }
AuditEvent { id, ts, actor_type, actor_id?, actor_label?, action, target_type?, target_id?, outcome, meta }
```

## Browser SDK (`/o.js`, also `/o/v1.js`)

```html
<script defer src="https://oops.3m4.net/o.js" data-key="oops_pub_…" data-env="production" data-release="1.4.2"></script>
```

- Zero dependencies, **≤ 4 KB gzipped** (build fails over budget). Never
  throws into the host page.
- Captures `window.onerror` (`ErrorEvent`) and `unhandledrejection`, and
  `console.error` calls when `data-console="true"`.
- Keeps a ring buffer of the last 30 **breadcrumbs**: clicks (tag, id, class,
  text ≤ 60), navigation (SPA route changes via History API and `popstate`),
  failed `fetch` / `XMLHttpRequest` (status ≥ 400 or network error, method +
  URL without query), and `console.warn` / `console.error` when enabled.
- Posts `text/plain` JSON to `/api/ingest` (derived from the script `src`, or
  `data-api`) with `navigator.sendBeacon`, falling back to `fetch` with
  `keepalive`. `source: "sdk"`, `platform: "javascript"`, `sdk: "oops-js/<version>"`.
- Client-side hygiene: identical events (type + message + top frame) within
  2 s are dropped; at most 30 events per minute per page; skips
  localhost / IP / `file:` pages unless `data-local="true"`; honours
  `data-sample="0.5"` (fraction of error events sent; captured messages and
  explicit `capture` calls always go through).
- Public API (`window.oops`, calls queued in `window.oops.q` before load are
  replayed):
  - `oops.capture(error, { level?, tags?, extra?, fingerprint? })`
  - `oops.message(text, level = "info", { tags?, extra? })`
  - `oops.setUser({ id?, email?, name? } | null)`
  - `oops.setTag(key, value)` / `oops.setTags({...})`
  - `oops.setContext(key, object)` → merged into `extra`
  - `oops.breadcrumb({ category, message?, level?, data? })`
  - `oops.flush()` (no-op placeholder for API symmetry)
- Attributes: `data-key` (required), `data-api`, `data-env`, `data-release`,
  `data-console`, `data-local`, `data-sample`, `data-user` (JSON, initial
  user).

## Server-side reporting

Backends call the ingest API directly with the public key (see README for
curl, Python and Node snippets). `platform` should name the runtime
(`python`, `node`, `go`, …) and `source` is forced to `api` server-side for
anything that is not the SDK (`sdk` is only trusted as a label).

## MCP server (`packages/mcp-server`, npm `oops-errors-mcp`)

stdio (`dist/stdio.js`) and Streamable HTTP (`dist/http.js`, `/mcp`). Auth =
an API key; tools the key's role cannot use are hidden and re-checked on call.

| Tool | Scope | Notes |
|---|---|---|
| `list_projects`, `get_project` | `projects:read` | |
| `create_project`, `update_project`, `rotate_public_key` | `projects:write` | |
| `delete_project` | `projects:delete` | elicitation or `confirm: true` |
| `list_issues`, `get_issue`, `list_issue_events`, `get_event`, `search_events` | `issues:read` | `get_issue` accepts the uuid or `#number` |
| `update_issue` (status), `bulk_update_issues` | `issues:write` | `resolve`, `ignore`, `reopen` convenience via `status` |
| `get_stats`, `get_live` | `issues:read` | same shape as the REST endpoints |
| `purge_events` | `events:delete` | elicitation or `confirm: true` |
| `get_usage` | `usage:read` | |
| `get_audit_log` | `audit:read` | |
| `report_error` | `projects:read` | Posts an event to `/ingest` with the project's public key, so an agent can report its own failures into a project it can see. |

Prompt `triage` (`project`, `period?`): summarise the open issues of a
project (new vs regressed, most users affected, by environment) and propose
what to fix, resolve or ignore first.

## Features (`packages/shared/feature_flags.json`)

`site-building` (inverse polarity curtain), `signups`, `early-access`,
`public-api`, `ingest-api` (kill switch: OFF → 503 on every ingest route),
`billing`. PostHog keys are prefixed `oops-`.

## PostHog product events (server-side)

`signup`, `project_created`, `issue_resolved`, `limit_reached {which}`,
`api_key_created`. Account id is the distinct id; groups `{ account }`.
