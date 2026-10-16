#!/usr/bin/env sh
# Smoke test for a running oops stack: health, tracker headers, collect round-trip.
#   BASE_URL=http://localhost:8084 sh deploy/smoke.sh
# Creates a throwaway account + project through the API, so it needs signups ON.
set -eu
BASE_URL="${BASE_URL:-http://localhost:8084}"
API="$BASE_URL/api"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 smoke"

say() { printf '\033[36m▸ %s\033[0m\n' "$1"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; exit 1; }; }
need curl; need python3

say "health"
curl -fsS "$API/healthz" | grep -q '"ok"' && echo "  api ok"

say "tracker headers"
curl -fsS -o /dev/null -D - "$BASE_URL/m.js" | tr -d '\r' | grep -iE '^(content-type|cache-control|access-control-allow-origin):' | sed 's/^/  /'

say "register + project"
EMAIL="smoke+$(date +%s)@example.com"
TOKEN=$(curl -fsS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Smoke-Passw0rd!\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
PROJECT=$(curl -fsS -X POST "$API/projects" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Smoke project","url":"https://smoke.example"}')
PID=$(printf '%s' "$PROJECT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
PUB=$(printf '%s' "$PROJECT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["public_key"])')
echo "  project $PID ($PUB)"

say "collect (JSON + header)"
curl -fsS -X POST "$API/collect" -H "X-Project-Key: $PUB" -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  -d '{"u":"https://smoke.example/docs?utm_source=smoke","r":"https://news.ycombinator.com/","t":"Docs","w":1440,"h":900,"l":"es-MX"}' | sed 's/^/  /'; echo

say "collect (text/plain, like the tracker)"
curl -fsS -X POST "$API/collect" -H 'Content-Type: text/plain' -H "User-Agent: $UA" \
  --data-raw "{\"k\":\"$PUB\",\"n\":\"signup\",\"u\":\"https://smoke.example/pricing\",\"p\":{\"plan\":\"pro\"}}" | sed 's/^/  /'; echo

say "pixel"
curl -fsS -o /dev/null -w "  %{http_code} %{content_type}\n" "$API/collect/pixel.gif?k=$PUB&u=/newsletter" -H "User-Agent: $UA"

say "stats"
curl -fsS "$API/projects/$PID/stats?period=today" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d["totals"]; print("  %d page views, %d visitors, %d events; pages: %s" % (t["pageviews"], t["visitors"], t["events"], ", ".join(r["value"] for r in d["breakdowns"]["path"])))'

say "cleanup"
curl -fsS -X DELETE "$API/projects/$PID" -H "Authorization: Bearer $TOKEN" && echo "  project deleted"
echo "smoke ok"
