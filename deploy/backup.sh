#!/usr/bin/env bash
# Nightly Postgres dump for the oops stack. Keeps 14 days.
set -euo pipefail
DIR=/opt/backups/oops
mkdir -p "$DIR"
cd /opt/oops/deploy
docker compose --env-file ../.env -f docker-compose.yml -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U oops -d oops | gzip > "$DIR/oops-$(date +%F).sql.gz"
find "$DIR" -name 'oops-*.sql.gz' -mtime +14 -delete
