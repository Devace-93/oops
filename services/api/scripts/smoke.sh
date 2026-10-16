#!/usr/bin/env bash
# Walk the CONTRACT.md happy path with curl against a RUNNING stack.
#
#   services/api/scripts/smoke.sh                     # http://localhost:8084
#   BASE_URL=https://oops.3m4.net services/api/scripts/smoke.sh
#
# Registers a throwaway account (or logs in when it already exists), creates a
# project, ingests events (two of one fingerprint, one of another, a batch),
# checks the issues list and counters, resolves an issue and sees it reopen on
# the next event, reads events / stats / live / summary, rotates the public key,
# purges, and prints the audit trail. Needs curl + python3.
set -euo pipefail

BASE_URL="${BASE_URL:-${BASE:-http://localhost:8084}}"
API="$BASE_URL/api"
EMAIL="${SMOKE_EMAIL:-smoke+$(date +%s)@example.com}"
PASSWORD="${SMOKE_PASSWORD:-Smoke-Passw0rd!}"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 smoke"

step() { printf '\n\033[35m▶ %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || fail "missing: $1"; }
need curl; need python3
# jq-ish helpers on top of python3: jget JSON EXPR (EXPR sees the parsed body as d)
jget() { printf '%s' "$1" | python3 -c 'import json,sys; d=json.load(sys.stdin); print('"$2"')'; }
jshow() { printf '%s' "$1" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  " + json.dumps('"$2"', separators=(",", ":")))'; }

step "health"
curl -fsS "$API/healthz" | sed 's/^/  /'; echo

step "sdk headers (/o.js)"
HEADERS=$(curl -fsS -o /dev/null -D - "$BASE_URL/o.js" | tr -d '\r')
printf '%s\n' "$HEADERS" | grep -iE '^(content-type|cache-control|access-control-allow-origin):' | sed 's/^/  /'
printf '%s\n' "$HEADERS" | grep -qi '^access-control-allow-origin: \*' || fail "/o.js must send Access-Control-Allow-Origin: *"

step "register $EMAIL (falls back to login)"
AUTH=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"account_name\":\"Smoke\"}")
if [ "$(jget "$AUTH" 'd.get("error", {}).get("code", "")')" = "email_taken" ]; then
  AUTH=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
fi
TOKEN=$(jget "$AUTH" 'd.get("access_token", "")')
[ -n "$TOKEN" ] || { echo "$AUTH"; fail "no access token"; }
H=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')

step "create project"
PROJECT=$(curl -fsS -X POST "$API/projects" "${H[@]}" \
  -d "{\"name\":\"Smoke app $(date +%H%M%S)\",\"url\":\"https://smoke.example\",\"timezone\":\"Europe/Madrid\"}")
jshow "$PROJECT" '{k: d[k] for k in ("id","key","public_key_prefix","timezone","ingest_enabled","counts")}'
PID=$(jget "$PROJECT" 'd["id"]'); PK=$(jget "$PROJECT" 'd["public_key"]')

step "ingest #1 + #2: same fingerprint (JSON + X-Project-Key; text/plain with k, like the SDK)"
R1=$(curl -fsS -X POST "$API/ingest" -H "X-Project-Key: $PK" -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  -d '{"type":"TypeError","message":"User 42 not found","stack":"TypeError: User 42 not found\n    at load (https://smoke.example/app.js:12:4)\n    at https://smoke.example/vendor/node_modules/x.js:1:1","url":"https://smoke.example/users/42?tab=1","release":"1.0.0","environment":"production","user":{"id":"u_1","email":"a@example.com"},"tags":{"page":"users","password":"hunter2"},"breadcrumbs":[{"category":"click","message":"button#load"}]}')
echo "  $R1"
R2=$(curl -fsS -X POST "$API/ingest" -H 'Content-Type: text/plain' -H "User-Agent: $UA" \
  --data-raw "{\"k\":\"$PK\",\"type\":\"TypeError\",\"message\":\"User 43 not found\",\"stack\":\"TypeError: User 43 not found\\n    at load (https://smoke.example/app.js:12:4)\",\"url\":\"https://smoke.example/users/43\",\"release\":\"1.0.1\",\"user\":{\"id\":\"u_2\"},\"sdk\":\"oops-js/0.1.0\",\"platform\":\"javascript\"}")
echo "  $R2"
[ "$(jget "$R1" 'd["issue_id"]')" = "$(jget "$R2" 'd["issue_id"]')" ] || fail "same fingerprint must land in one issue"
ISSUE_A=$(jget "$R1" 'd["issue_number"]')

step "ingest #3: another error, as a batch of one (+ one malformed item reported in place)"
R3=$(curl -fsS -X POST "$API/ingest/batch" -H "X-Project-Key: $PK" -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  -d '{"events":[{"type":"ReferenceError","message":"foo is not defined","level":"fatal","platform":"node","frames":[{"filename":"/srv/app/x.js","function":"init","lineno":1,"colno":2,"in_app":true}]},{"level":"error"}]}')
echo "  $R3"
ISSUE_B=$(jget "$R3" 'd["results"][0]["issue_number"]')
[ "$(jget "$R3" 'd["results"][1]["ok"]')" = "False" ] || fail "malformed batch item must be reported"

step "ingest: wrong key → 401, missing type+message → 400"
curl -sS -o /dev/null -w '  bad key -> HTTP %{http_code} (expect 401)\n' -X POST "$API/ingest" -H "X-Project-Key: oops_pub_nope" -H 'Content-Type: application/json' -d '{"message":"x"}'
curl -sS -o /dev/null -w '  empty event -> HTTP %{http_code} (expect 400)\n' -X POST "$API/ingest" -H "X-Project-Key: $PK" -H 'Content-Type: application/json' -d '{"level":"error"}'

step "issues list: 2 open, counts 2 and 1"
ISSUES=$(curl -fsS "$API/projects/$PID/issues?sort=events" "${H[@]}")
jshow "$ISSUES" '{"total": d["total"], "items": [{k: i[k] for k in ("number","title","culprit","level","status","event_count","user_count","environments","releases")} for i in d["items"]]}'
jget "$ISSUES" '"ok" if d["total"] == 2 and [i["event_count"] for i in d["items"]] == [2, 1] and [i["user_count"] for i in d["items"]] == [2, 1] else sys.exit("bad counts")' >/dev/null || fail "unexpected issue counts"

step "issue detail (#$ISSUE_A by number) with latest_event; scrubbing + query stripping"
DETAIL=$(curl -fsS "$API/projects/$PID/issues/$ISSUE_A" "${H[@]}")
jshow "$DETAIL" '{"number": d["number"], "latest": {k: d["latest_event"][k] for k in ("id","message","url","path","release","source","tags")}, "frames": d["latest_event"]["frames"]}'
[ "$(jget "$DETAIL" 'd["latest_event"]["source"]')" = "sdk" ] || fail "oops-js sdk label must yield source=sdk"
EVENT_ID=$(jget "$DETAIL" 'd["latest_event"]["id"]')
FIRST=$(curl -fsS "$API/projects/$PID/issues/$ISSUE_A/events?per_page=1&page=2" "${H[@]}")
jshow "$FIRST" '{"total": d["total"], "tags": d["items"][0]["tags"], "url": d["items"][0]["url"]}'
[ "$(jget "$FIRST" 'd["items"][0]["tags"]["password"]')" = "[Filtered]" ] || fail "secret tag must be scrubbed"
[ "$(jget "$FIRST" 'd["items"][0]["url"]')" = "https://smoke.example/users/42" ] || fail "query string must be dropped"

step "resolve #$ISSUE_A → a new event reopens it (regressed_at set)"
curl -fsS -X PATCH "$API/projects/$PID/issues/$ISSUE_A" "${H[@]}" -d '{"status":"resolved"}' \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  status=%s resolved_at=%s" % (d["status"], d["resolved_at"]))'
curl -fsS -X POST "$API/ingest" -H "X-Project-Key: $PK" -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  -d '{"type":"TypeError","message":"User 44 not found","stack":"TypeError: User 44 not found\n    at load (https://smoke.example/app.js:12:4)","user":{"id":"u_1"}}' >/dev/null
REOPENED=$(curl -fsS "$API/projects/$PID/issues/$ISSUE_A" "${H[@]}")
jshow "$REOPENED" '{k: d[k] for k in ("number","status","resolved_at","regressed_at","event_count","user_count")}'
[ "$(jget "$REOPENED" 'd["status"]')" = "open" ] || fail "resolved issue must reopen"
[ "$(jget "$REOPENED" 'd["user_count"]')" = "2" ] || fail "a returning user must not bump user_count"

step "ignore #$ISSUE_B via bulk, then it stays ignored on a new event"
curl -fsS -X POST "$API/projects/$PID/issues/bulk" "${H[@]}" -d "{\"ids\":[\"$ISSUE_B\"],\"status\":\"ignored\"}" | sed 's/^/  /'; echo
curl -fsS -X POST "$API/ingest" -H "X-Project-Key: $PK" -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  -d '{"type":"ReferenceError","message":"foo is not defined","frames":[{"filename":"/srv/app/x.js","function":"init","lineno":1,"colno":2,"in_app":true}]}' >/dev/null
curl -fsS "$API/projects/$PID/issues/$ISSUE_B" "${H[@]}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  #%d status=%s events=%d" % (d["number"], d["status"], d["event_count"])); sys.exit(0 if d["status"] == "ignored" else "ignored issue must stay ignored")'
curl -fsS "$API/projects/$PID/issues?status=ignored" "${H[@]}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  ignored list total=%d" % d["total"])'

step "events log + one event"
curl -fsS "$API/projects/$PID/events?per_page=3&level=error" "${H[@]}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  total=%d  first=%s" % (d["total"], [(e["issue_number"], e["message"]) for e in d["items"]]))'
curl -fsS "$API/projects/$PID/events/$EVENT_ID" "${H[@]}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  event %s issue #%d %s/%s on %s" % (d["id"], d["issue_number"], d["browser"], d["os"], d["device"]))'

step "stats (7d, project tz) + live + summary"
curl -fsS "$API/projects/$PID/stats?period=7d" "${H[@]}" | python3 -c 'import json,sys; d=json.load(sys.stdin); t=d["totals"]; print("  range %s..%s %s/%s; events=%d users=%d issues_new=%d issues_open=%d; prev events=%d; points=%d; release=%s" % (d["range"]["from"][:10], d["range"]["to"][:10], d["range"]["tz"], d["range"]["interval"], t["events"], t["users"], t["issues_new"], t["issues_open"], d["previous"]["events"], len(d["series"]), [(r["value"], r["events"]) for r in d["breakdowns"]["release"]]))'
curl -fsS "$API/projects/$PID/live" "${H[@]}" | sed 's/^/  /'; echo
curl -fsS "$API/projects/$PID/summary" "${H[@]}" | sed 's/^/  /'; echo

step "usage"
curl -fsS "$API/account/usage" "${H[@]}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  events=%d dropped=%d counts=%s" % (d["events"], d["events_dropped"], d["counts"]))'

step "rotate public key: old key must die"
NEWKEY=$(curl -fsS -X POST "$API/projects/$PID/rotate-key" "${H[@]}" -d '{}' | python3 -c 'import json,sys; print(json.load(sys.stdin)["public_key"])')
curl -sS -o /dev/null -w '  old key -> HTTP %{http_code} (expect 401)\n' -X POST "$API/ingest" -H "X-Project-Key: $PK" -H 'Content-Type: application/json' -d '{"message":"x"}'
curl -sS -o /dev/null -w '  new key -> HTTP %{http_code} (expect 202)\n' -X POST "$API/ingest" -H "X-Project-Key: $NEWKEY" -H 'Content-Type: application/json' -d '{"message":"x"}'

step "purge events + issues"
curl -fsS -X DELETE "$API/projects/$PID/events" "${H[@]}" | sed 's/^/  /'; echo
curl -fsS "$API/projects/$PID/issues?status=all" "${H[@]}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  issues after purge: %d" % d["total"]); sys.exit(0 if d["total"] == 0 else "purge left issues")'

step "audit (actions seen)"
curl -fsS "$API/account/audit?per_page=50" "${H[@]}" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("  total=%d %s" % (d["total"], sorted({i["action"] for i in d["items"]})))'

if [ "${KEEP:-0}" != 1 ]; then
  step "cleanup (KEEP=1 to skip)"
  curl -fsS -X DELETE "$API/projects/$PID" "${H[@]}" -o /dev/null -w '  delete project -> HTTP %{http_code}\n'
fi
printf '\n\033[32m✓ smoke complete\033[0m\n'
