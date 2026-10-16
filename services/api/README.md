# oops — API service (Flask)

JSON REST API for oops, the web-analytics service. Auth, projects (one per
tracked site) with their public keys, the public collect API (tracker / pixel /
curl), the stats endpoints, account usage, API keys, and (optionally)
RevenueCat billing. Mounted at `/api` behind Caddy.
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
│   └── blueprints/         # auth, projects, stats, collect, account, apikeys, billing
├── scripts/smoke.sh        # curl walk through the contract against a running stack
├── requirements.txt
└── Dockerfile
```

Shared logic (config, models, plans, RBAC, key validation, hit normalisation and
enrichment, stats queries, IP hashing, usage, audit, PostHog) lives in the
repo-root `dbcore/` package and is imported, never re-implemented.

## Auth

- **Dashboard:** `Authorization: Bearer <JWT>` (HS256, TTL `ACCESS_TOKEN_TTL_MIN`).
  Refresh tokens are opaque and stored **hashed** (sha256). Passwords: argon2.
- **Management API:** `X-API-Key: oops_live_...` (or as a bearer token); the
  key's role decides its scopes (`packages/shared/api_key_roles.json`).
- **Collect API:** `X-Project-Key: oops_pub_...` (or bearer token, or the
  `k` / `project_key` body/query field). Identifies one project; no role,
  collect routes only. Public by design (it ships in the tracker snippet).

## Endpoints (all under `/api`)

- `auth`: `register`, `login`, `refresh`, `logout`, `me`
- `projects`: list/create/get/patch/delete, `:id/rotate-key`, `:id/summary`, `DELETE :id/events` (purge)
- `projects/:id/stats`, `stats/breakdown`, `stats/series`, `events`, `live` (stats:read)
- `collect` (POST, metered, project public key, CORS `*`), `collect/pixel.gif`
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
```

Configuration is entirely env-driven (`dbcore.config`); see the repo `.env.example`.

## Limits

- Hard (402 `limit_reached`, `which`): projects, active API keys.
- Soft-drop: events per month. The collect API always answers 202; past the
  budget hits are counted but not stored, `GET /account/usage` reports
  `events_dropped` and one PostHog event fires per period.
- Retention: `python -m dbcore.cli prune-events` deletes events older than each
  plan's `retention_days`.

## Privacy

Raw IPs and user agents are never stored. `dbcore.privacy` keeps a daily-salted
sha256 of the IP (`IP_HASH_SECRET`) for rate limits, and a daily per-project
visitor hash of (IP, UA) for unique-visitor counts; `dbcore.events` turns the UA
into device / browser / OS and the IP into country / region / city (GeoLite2,
optional) and drops both. Page URLs lose their query string before storage.
