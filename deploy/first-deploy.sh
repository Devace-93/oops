#!/usr/bin/env bash
# First production deploy of oops on the 3m4 box. Run ON THE SERVER as root:
#   bash /opt/oops/deploy/first-deploy.sh
# or from your machine:
#   ssh root@<server> 'bash -s' < deploy/first-deploy.sh
#
# Idempotent: re-running keeps an existing .env and just rebuilds/restarts.
# Prerequisites (already true on the 3m4 box): `edge` network created, 3m4's
# Caddyfile.prod has the oops.3m4.net block, /opt/3m4/deploy/geoip holds
# GeoLite2-City.mmdb, DNS A record oops -> this server.
set -euo pipefail

if [ ! -d /opt/oops/.git ]; then
  git clone -q git@github.com:Devace-93/oops.git /opt/oops
  echo "✓ cloned /opt/oops"
fi
cd /opt/oops
git pull -q --ff-only

if [ ! -f .env ]; then
  cp .env.example .env
  set_var() { sed -i "s|^$1=.*|$1=$2|" .env; grep -q "^$1=" .env || echo "$1=$2" >> .env; }
  # Reuse a value from the 3m4 stack's env (same PostHog project; oops prefixes its flag keys).
  from3m4() { v=$(grep -E "^$1=" /opt/3m4/.env | head -1 | cut -d= -f2-); set_var "$2" "$v"; }
  secret() { python3 -c "import secrets; print(secrets.token_urlsafe($1))"; }

  PG_PASS=$(secret 24)
  set_var POSTGRES_PASSWORD "$PG_PASS"
  set_var DATABASE_URL "postgresql+psycopg://oops:$PG_PASS@postgres:5432/oops"
  set_var JWT_SECRET_KEY "$(secret 48)"
  set_var IP_HASH_SECRET "$(secret 32)"
  set_var REVENUECAT_WEBHOOK_AUTH_TOKEN "$(secret 32)"
  set_var APP_BASE_URL https://oops.3m4.net
  set_var DASHBOARD_URL https://oops.3m4.net
  # Billing stays off until oops has its own RevenueCat products; early access hides it anyway.
  set_var BILLING_ENABLED false
  set_var VITE_BILLING_ENABLED false
  set_var VITE_API_URL /api
  set_var VITE_APP_URL https://oops.3m4.net
  from3m4 POSTHOG_API_KEY POSTHOG_API_KEY
  from3m4 POSTHOG_PERSONAL_API_KEY POSTHOG_PERSONAL_API_KEY
  from3m4 POSTHOG_HOST POSTHOG_HOST
  from3m4 VITE_POSTHOG_KEY VITE_POSTHOG_KEY
  from3m4 VITE_POSTHOG_HOST VITE_POSTHOG_HOST
  chmod 600 .env
  echo "✓ .env written"
fi

cd deploy
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml up -d --build --remove-orphans
docker image prune -f >/dev/null

# Nightly backup + retention prune (PRODUCTION.md steps 7 and 8), added once.
CRON=$(crontab -l 2>/dev/null || true)
grep -q '/opt/oops/deploy/backup.sh' <<<"$CRON" || CRON+=$'\n20 3 * * * /opt/oops/deploy/backup.sh'
grep -q 'oops-prune.log' <<<"$CRON" || CRON+=$'\n30 4 * * * cd /opt/oops/deploy && docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml run --rm migrate python -m dbcore.cli prune-events >> /var/log/oops-prune.log 2>&1'
printf '%s\n' "$CRON" | sed '/^$/d' | crontab -

echo "--- status"
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml ps --format '{{.Name}} {{.Status}}'
# Health through the edge Caddy (TLS needs DNS; this hits it by Host header over the docker network).
docker exec 3m4-caddy-1 wget -qO- --header 'Host: oops.3m4.net' http://localhost/api/healthz 2>/dev/null || \
  docker run --rm --network edge curlimages/curl -s http://oops-api-1:5000/api/healthz
echo
