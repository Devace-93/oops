#!/usr/bin/env sh
# Smoke test for a running oops stack: health, SDK headers, ingest → issues round-trip.
#   BASE_URL=http://localhost:8084 sh deploy/smoke.sh
# Creates a throwaway account + project through the API, so it needs signups ON.
# Needs curl + python3 (JSON parsing).
set -eu
BASE_URL="${BASE_URL:-http://localhost:8084}"
API="$BASE_URL/api"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 smoke"

say() { printf '\033[35m▸ %s\033[0m\n' "$1"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "missing: $1"; }
need curl; need python3
# jget '<json>' <python expression over d>
jget() { printf '%s' "$1" | python3 -c 'import json,sys; d=json.load(sys.stdin); print('"$2"')'; }

say "health"
curl -fsS "$API/healthz" | grep -q '"ok"' && echo "  api ok"

say "sdk headers (/o.js, served by web, CORS *)"
HEADERS=$(curl -fsS -o /dev/null -D - "$BASE_URL/o.js" | tr -d '\r')
printf '%s\n' "$HEADERS" | grep -iE '^(content-type|cache-control|access-control-allow-origin):' | sed 's/^/  /'
printf '%s\n' "$HEADERS" | grep -qi '^access-control-allow-origin: \*' || fail "/o.js must send Access-Control-Allow-Origin: *"

say "register + project"
EMAIL="smoke+$(date +%s)@example.com"
TOKEN=$(curl -fsS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Smoke-Passw0rd!\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
PROJECT=$(curl -fsS -X POST "$API/projects" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"Smoke project","url":"https://smoke.example"}')
PID=$(jget "$PROJECT" 'd["id"]')
PUB=$(jget "$PROJECT" 'd["public_key"]')
echo "  project $PID ($PUB)"

say "ingest: two events with the same fingerprint (JSON + header, text/plain like the SDK)"
R1=$(curl -fsS -X POST "$API/ingest" -H "X-Project-Key: $PUB" -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  -d '{"type":"TypeError","message":"User 42 not found","stack":"TypeError: User 42 not found\n    at load (https://smoke.example/app.js:12:4)","url":"https://smoke.example/users/42?tab=1","release":"1.0.0","environment":"production","user":{"id":"u_1"}}')
echo "  $R1"
R2=$(curl -fsS -X POST "$API/ingest" -H 'Content-Type: text/plain' -H "User-Agent: $UA" \
  --data-raw "{\"k\":\"$PUB\",\"type\":\"TypeError\",\"message\":\"User 43 not found\",\"stack\":\"TypeError: User 43 not found\\n    at load (https://smoke.example/app.js:12:4)\",\"url\":\"https://smoke.example/users/43\",\"release\":\"1.0.0\",\"user\":{\"id\":\"u_2\"},\"sdk\":\"oops-js/0.1.0\"}")
echo "  $R2"
[ "$(jget "$R1" 'd["issue_id"]')" = "$(jget "$R2" 'd["issue_id"]')" ] || fail "same fingerprint must land in one issue"
ISSUE_A=$(jget "$R1" 'd["issue_number"]')

say "ingest: a different error"
R3=$(curl -fsS -X POST "$API/ingest/event" -H "X-Project-Key: $PUB" -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  -d '{"type":"ReferenceError","message":"foo is not defined","level":"fatal","frames":[{"filename":"https://smoke.example/x.js","function":"init","lineno":1,"colno":2,"in_app":true}]}')
echo "  $R3"
ISSUE_B=$(jget "$R3" 'd["issue_number"]')

say "issues: 2 open, counts 2 and 1"
ISSUES=$(curl -fsS "$API/projects/$PID/issues" -H "Authorization: Bearer $TOKEN")
jget "$ISSUES" '"  total=%d  " % d["total"] + "  ".join("#%d %s events=%d users=%d" % (i["number"], i["title"], i["event_count"], i["user_count"]) for i in d["items"])'
jget "$ISSUES" '"ok" if d["total"] == 2 and sorted(i["event_count"] for i in d["items"]) == [1, 2] and sorted(i["user_count"] for i in d["items"]) == [1, 2] else sys.exit("bad counts")' >/dev/null || fail "unexpected issue counts"

say "resolve #$ISSUE_A, then a new event reopens it"
curl -fsS -X PATCH "$API/projects/$PID/issues/$ISSUE_A" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"resolved"}' | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  #%d status=%s resolved_at=%s" % (d["number"], d["status"], d["resolved_at"]))'
curl -fsS -X POST "$API/ingest" -H "X-Project-Key: $PUB" -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  -d '{"type":"TypeError","message":"User 44 not found","stack":"TypeError: User 44 not found\n    at load (https://smoke.example/app.js:12:4)"}' >/dev/null
REOPENED=$(curl -fsS "$API/projects/$PID/issues/$ISSUE_A" -H "Authorization: Bearer $TOKEN")
jget "$REOPENED" '"  #%d status=%s regressed_at=%s events=%d latest=%s" % (d["number"], d["status"], d["regressed_at"], d["event_count"], d["latest_event"]["message"])'
[ "$(jget "$REOPENED" 'd["status"]')" = "open" ] || fail "resolved issue must reopen"

say "stats (today)"
curl -fsS "$API/projects/$PID/stats?period=today" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d["totals"]; print("  %d events, %d users, %d new issues, %d open; levels: %s" % (t["events"], t["users"], t["issues_new"], t["issues_open"], ", ".join("%s=%d" % (r["value"], r["events"]) for r in d["breakdowns"]["level"])))'

say "purge"
curl -fsS -X DELETE "$API/projects/$PID/events" -H "Authorization: Bearer $TOKEN" | sed 's/^/  /'; echo

say "cleanup"
curl -fsS -X DELETE "$API/projects/$PID" -H "Authorization: Bearer $TOKEN" && echo "  project deleted"
echo "smoke ok (issues #$ISSUE_A and #$ISSUE_B exercised)"
