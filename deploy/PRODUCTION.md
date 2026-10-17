# Production runbook

oops runs on the same Hetzner box as the 3m4 shortener (`/opt/3m4`), exp
(`/opt/exp`), retro (`/opt/retro`) and metrics (`/opt/metrics`). The 3m4
stack's Caddy owns ports 80/443, so oops is deployed as another docker compose
project (`/opt/oops`, compose project `oops`) without its own Caddy, and the
3m4 Caddy routes `oops.3m4.net` to it over the shared `edge` docker network.

## First-time setup

1. **Shared network** (once per server; already there if exp is deployed):
   ```sh
   docker network inspect edge >/dev/null 2>&1 || docker network create edge
   ```
2. **Clone + configure**
   ```sh
   git clone git@github.com:Devace-93/oops.git /opt/oops
   cd /opt/oops && cp .env.example .env && $EDITOR .env
   ```
   Prod `.env` checklist: `APP_BASE_URL=https://oops.3m4.net`,
   `DASHBOARD_URL=https://oops.3m4.net`, `VITE_API_URL=/api`,
   `VITE_APP_URL=https://oops.3m4.net`, fresh `JWT_SECRET_KEY` and
   `IP_HASH_SECRET`, PostHog keys (`POSTHOG_API_KEY`, `POSTHOG_PERSONAL_API_KEY`,
   `VITE_POSTHOG_KEY`; flags are prefixed `oops-` in the shared PostHog
   project), `VITE_METRICS_PROJECT_KEY` (oops' own project in metrics, so the
   marketing pages and dashboard are tracked), `VITE_OOPS_PROJECT_KEY` (oops'
   own project in oops, so the dashboard's front-end errors are reported to
   itself via `/o.js`; unset = no SDK), RevenueCat keys when billing is
   switched on, a fresh Postgres password: set `POSTGRES_PASSWORD` (read by the
   postgres service through `--env-file ../.env`) and use the same value in
   `DATABASE_URL`. `deploy/first-deploy.sh` does all of this (steps 1-3, 6
   and 7) in one go.
3. **Start**
   ```sh
   cd /opt/oops/deploy
   docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build
   ```
   Container names are stable (`oops-api-1`, `oops-web-1`, `oops-mcp-1`):
   compose project `oops`, one replica each. The edge Caddy routes by name.
   There is no geo database to mount: oops does not look up locations.
4. **Edge routing** — in `/opt/3m4` (the 3m4 repo carries this block):
   - `deploy/docker-compose.prod.yml`: the `caddy` service is already attached
     to the external `edge` network (done for exp).
   - `deploy/Caddyfile.prod`: the block, mirroring the metrics one but with
     the SDK paths (`/o.js`, `/o/*`) and the `oops-*-1` container names:
     ```
     # oops (error tracking): /opt/oops, compose project `oops`.
     oops.3m4.net {
     	handle /api/* {
     		reverse_proxy oops-api-1:5000
     	}
     	handle /mcp* {
     		reverse_proxy oops-mcp-1:3333
     	}
     	@sdk path /o.js /o/*
     	handle @sdk {
     		header Cache-Control "public, max-age=3600"
     		header Access-Control-Allow-Origin "*"
     		reverse_proxy oops-web-1:3000
     	}
     	handle {
     		reverse_proxy oops-web-1:3000
     	}
     }
     ```
   - `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --force-recreate caddy`
5. **DNS (Bluehost)**: A record `oops` → the server IP (`46.225.62.18`), same
   as `exp` and `metrics`. Caddy issues the TLS certificate automatically once
   DNS resolves.
6. **Backups**: add `/opt/oops/deploy/backup.sh` to the same crontab as 3m4
   (nightly, keeps 14 days under `/opt/backups/oops`).
7. **Retention**: add a nightly cron that prunes events past each plan's
   retention window (and drops issues left without events):
   ```
   30 4 * * * cd /opt/oops/deploy && docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate python -m dbcore.cli prune-events >> /var/log/oops-prune.log 2>&1
   ```
   (No-op while `early-access` is ON: every account has unlimited retention.)
8. **Deploy-on-push**: in the GitHub repo set secrets `DEPLOY_HOST` and
   `DEPLOY_SSH_KEY`, and repo variable `DEPLOY_ENABLED=true`. After that every
   push to `main` redeploys via `.github/workflows/deploy.yml`.

## Day two

- **Smoke test** after a deploy: `BASE_URL=https://oops.3m4.net sh deploy/smoke.sh`
  (health, SDK headers, ingest → issues round-trip).
- **Kill switches** live in PostHog (`oops-ingest-api` stops every SDK and
  server-side reporter with a 503; `oops-public-api` disables API keys and
  therefore the MCP server; `oops-site-building` shows the building page) or
  in `.env` as `FEATURE_FLAG_OVERRIDES=ingest-api=off` followed by a restart
  of `api`.
- **Logs**: `docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml logs -f --tail=100 api`.
  The MCP container writes its agent-side audit trail (one JSON line per tool
  call) to stderr, so `logs mcp` is the audit log.
- **Restore**: `gunzip -c /opt/backups/oops/oops-YYYY-MM-DD.sql.gz | docker compose … exec -T postgres psql -U oops -d oops`.
