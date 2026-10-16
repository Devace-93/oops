# oops — API service (Flask)

JSON REST API for oops, the error-tracking service. Auth, projects (one per
app, site or service) with their public keys, the public ingest API (browser
SDK / curl / backends), issues and events, the stats endpoints, account usage,
API keys, and (optionally) RevenueCat billing. Mounted at `/api` behind Caddy.
The spec is the repo-root `CONTRACT.md`.

## Layout

```
services/api/
├── api/
│   ├── app.py              # create_app() factory + error handlers + health
│   ├── extensions.py       # Flask-Limiter (Redis-backed); per-key, per-project and per-IP buckets
│   ├── auth_utils.py       # passwords, JWT, @require_auth / @require_api_key / @require_project_key, @require_scope
│   ├── features.py         # oops's own switches: @require_feature + GET /api/features
│   ├── serializers.py      # ORM -> JSON (CONTRACT.md shapes)
│   ├── errors.py           # ApiError -> {"error": {...}}
│   └── blueprints/         # auth, projects, issues, ingest, account, apikeys, billing
├── scripts/smoke.sh        # curl walk through the contract against a running stack
├── tests/                  # unit tests for the pure dbcore modules (stack parser, grouping, scrubbing)
├── requirements.txt
└── Dockerfile
```

Shared logic (config, models, plans, RBAC, key validation, the ingest pipeline,
grouping, stats queries, hashing, usage, audit, PostHog) lives in the repo-root
`dbcore/` package and is imported, never re-implemented:

- `dbcore/ingest.py` — payload normalisation, caps and scrubbing; user-agent parsing
- `dbcore/stacktrace.py` — V8 / Firefox-Safari / Python stack parsing into frames
- `dbcore/grouping.py` — message normalisation, fingerprint, issue title and culprit
- `dbcore/issues.py` — the issue upsert (one transaction per event, race-safe)
- `dbcore/stats.py` — totals, series, breakdowns, live window, project counts

## Auth

- **Dashboard:** `Authorization: Bearer <JWT>` (HS256, TTL `ACCESS_TOKEN_TTL_MIN`).
  Refresh tokens are opaque, stored **hashed** (sha256) and rotated on every
  refresh. Passwords: argon2.
- **Management API:** `X-API-Key: oops_live_...` (or as a bearer token); the
  key's role decides its scopes (`packages/shared/api_key_roles.json`).
- **Ingest API:** `X-Project-Key: oops_pub_...` (or bearer token, or the
  `k` / `project_key` body field). Identifies one project; no role, ingest
  routes only. Public by design (it ships in the SDK snippet).

## Endpoints (all under `/api`)

- `auth`: `register`, `login`, `refresh`, `logout`, `me`
- `projects`: list/create/get/patch/delete, `:id/rotate-key`, `:id/summary`, `DELETE :id/events` (purge)
- `projects/:id/issues` (list, get, patch, `bulk`, `:issue/events`), `events`, `events/:id`, `stats`, `live` (issues:*)
- `ingest`, `ingest/event`, `ingest/batch` (POST, metered, project public key, CORS `*`, `text/plain` accepted)
- `account/usage`, `account/audit`
- `apikeys`: list/create/delete, `roles`, `me`
- `features`
- `billing` (only if `BILLING_ENABLED=true`): `offerings`, `webhook`
- `healthz` (also at the bare path for container health checks)

## Run

```bash
# From the repo root, via docker compose (recommended):
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build postgres redis migrate api

# Locally (needs Postgres + Redis reachable, deps installed):
pip install -r services/api/requirements.txt
gunicorn -b 0.0.0.0:5000 -w 2 'api.app:create_app()'

# Unit tests (pure Python, no services needed):
python3 -m unittest discover -s services/api/tests
```

Configuration is entirely env-driven (`dbcore.config`); see the repo `.env.example`.

## Limits

- Hard (402 `limit_reached`, `which`): projects, active API keys.
- Soft-drop: events per month. The ingest API always answers 202; past the
  budget events are counted but not stored, `GET /account/usage` reports
  `events_dropped` and one PostHog event fires per period.
- Retention: `python -m dbcore.cli prune-events` deletes events older than each
  plan's `retention_days`, drops issues left empty and recomputes the counters
  of issues that lost events.

## Privacy

Raw user agents are never stored; raw IPs only when a project opts in
(`store_ip`). `dbcore.privacy` keeps a daily-salted sha256 of the IP
(`IP_HASH_SECRET`) for rate limits and the anonymous user hash, and a stable
per-project hash of the client's own `user.id` for affected-user counts.
`dbcore.ingest` turns the UA into browser / OS / device and drops it, strips
query strings and fragments from URLs, and replaces secret-looking values in
`tags`, `extra`, `breadcrumbs[].data` and `user` (and bearer tokens / card
numbers in messages) with `[Filtered]`.
