#!/usr/bin/env bash
# Walk the CONTRACT.md happy path with curl against a RUNNING stack.
#
#   services/api/scripts/smoke.sh                 # http://localhost:8084
#   BASE=https://oops.3m4.net services/api/scripts/smoke.sh
#
# Registers a throwaway account (or logs in when it already exists), creates a
# project, posts feedback through the ingest API (JSON with the header, then a
# form-encoded body with project_key), enables the board, votes, promotes a
# feedback item to the roadmap and prints the project summary. Needs curl + jq.
set -euo pipefail

BASE="${BASE:-http://localhost:8084}"
API="$BASE/api"
EMAIL="${SMOKE_EMAIL:-smoke+$(date +%s)@example.com}"
PASSWORD="${SMOKE_PASSWORD:-password123}"

step() { printf '\n\033[36m▶ %s\033[0m\n' "$*"; }
need() { command -v "$1" >/dev/null || { echo "missing: $1" >&2; exit 1; }; }
need curl; need jq

step "health"
curl -fsS "$API/healthz" | jq -c .

step "register $EMAIL (falls back to login)"
AUTH=$(curl -sS -X POST "$API/auth/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"account_name\":\"Smoke\"}")
if [ "$(jq -r '.error.code // empty' <<<"$AUTH")" = "email_taken" ]; then
  AUTH=$(curl -sS -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
fi
TOKEN=$(jq -r .access_token <<<"$AUTH")
[ -n "$TOKEN" ] && [ "$TOKEN" != null ] || { echo "$AUTH" | jq .; exit 1; }
H=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')

step "create project"
PROJECT=$(curl -sS -X POST "$API/projects" "${H[@]}" \
  -d "{\"name\":\"Smoke app $(date +%H%M%S)\",\"url\":\"https://example.com\"}")
jq -c '{id,key,board_slug,public_key_prefix,board_enabled}' <<<"$PROJECT"
PID=$(jq -r .id <<<"$PROJECT"); PK=$(jq -r .public_key <<<"$PROJECT"); SLUG=$(jq -r .board_slug <<<"$PROJECT")

step "widget config (public key header)"
curl -fsS "$API/ingest/config" -H "X-Project-Key: $PK" | jq -c .

step "ingest #1: JSON + X-Project-Key header (+ tiny PNG screenshot)"
PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
curl -fsS -X POST "$API/ingest/feedback" -H "X-Project-Key: $PK" -H 'X-Oops-Source: widget' \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"bug\",\"message\":\"Export button does nothing\\nSteps: click export\",\"email\":\"user@example.com\",\"page_url\":\"https://example.com/editor\",\"metadata\":{\"browser\":\"Firefox 131\"},\"screenshot\":\"data:image/png;base64,$PNG\"}" | jq -c .

step "ingest #2: form-encoded with project_key in the body (plain <form> / curl -d)"
curl -fsS -X POST "$API/ingest/feedback" \
  -d "project_key=$PK" -d "type=feedback" -d "sentiment=positive" -d "message=Love the new editor" | jq -c .

step "ingest honeypot (website filled): fake 201, nothing stored"
curl -fsS -X POST "$API/ingest/feedback" -H "X-Project-Key: $PK" -H 'Content-Type: application/json' \
  -d '{"type":"feature","message":"buy stuff","website":"http://spam"}' | jq -c .

step "inbox list"
curl -fsS "$API/projects/$PID/feedback" "${H[@]}" | jq -c '{total, items: [.items[] | {number,type,status,title,has_screenshot}]}'

step "triage #1 (status/priority/tags) + note"
curl -fsS -X PATCH "$API/projects/$PID/feedback/1" "${H[@]}" \
  -d '{"status":"triaged","priority":"high","tags":["export","ui"]}' | jq -c '{number,status,priority,tags}'
curl -fsS -X POST "$API/projects/$PID/feedback/1/notes" "${H[@]}" -d '{"body":"Reproduced on Firefox"}' | jq -c .

step "promote #1 to the roadmap"
PROMOTED=$(curl -fsS -X POST "$API/projects/$PID/feedback/1/promote" "${H[@]}" -d '{}')
jq -c '{item: {number: .item.number, status: .item.status}, roadmap_item: {id: .roadmap_item.id, status: .roadmap_item.status}}' <<<"$PROMOTED"
RID=$(jq -r .roadmap_item.id <<<"$PROMOTED")

step "enable the public board"
curl -fsS -X PATCH "$API/projects/$PID" "${H[@]}" -d '{"board_enabled":true,"board_intro":"Vote for what matters to you."}' | jq -c '{board_enabled,board_url}'

step "public board (no key)"
curl -fsS "$API/boards/$SLUG" | jq -c '{project: .project.board_title, planned: (.roadmap.planned|length), can_vote, can_submit}'

step "vote (idempotent per voter_id) + board submission"
curl -fsS -X POST "$API/boards/$SLUG/items/$RID/vote" -H 'Content-Type: application/json' -d '{"voter_id":"smoke-voter-0001"}' | jq -c .
curl -fsS -X POST "$API/boards/$SLUG/items/$RID/vote" -H 'Content-Type: application/json' -d '{"voter_id":"smoke-voter-0001"}' | jq -c .
curl -fsS -X POST "$API/boards/$SLUG/feedback" -H 'Content-Type: application/json' -d '{"message":"Please add PDF export"}' | jq -c .

step "changelog: draft then publish"
ENTRY=$(curl -fsS -X POST "$API/projects/$PID/changelog" "${H[@]}" -d '{"title":"Export fixed","body":"- Export works again","version":"1.0.1"}')
CID=$(jq -r .id <<<"$ENTRY")
curl -fsS -X PATCH "$API/projects/$PID/changelog/$CID" "${H[@]}" -d '{"published":true}' | jq -c '{title,version,published_at}'
curl -fsS "$API/boards/$SLUG/changelog" | jq -c '{total}'

step "summary + usage"
curl -fsS "$API/projects/$PID/summary" "${H[@]}" | jq -c .
curl -fsS "$API/account/usage" "${H[@]}" | jq -c '{feedback, attachment_bytes, counts}'

step "rotate public key: old key must die"
NEWKEY=$(curl -fsS -X POST "$API/projects/$PID/rotate-key" "${H[@]}" -d '{}' | jq -r .public_key)
curl -sS -o /dev/null -w 'old key -> HTTP %{http_code} (expect 401)\n' "$API/ingest/config" -H "X-Project-Key: $PK"
curl -sS -o /dev/null -w 'new key -> HTTP %{http_code} (expect 200)\n' "$API/ingest/config" -H "X-Project-Key: $NEWKEY"

step "audit (last actions)"
curl -fsS "$API/account/audit?limit=20" "${H[@]}" | jq -c '[.items[].action] | unique'

if [ "${KEEP:-0}" != 1 ]; then
  step "cleanup (KEEP=1 to skip)"
  curl -fsS -X DELETE "$API/projects/$PID" "${H[@]}" -o /dev/null -w 'delete project -> HTTP %{http_code}\n'
fi
printf '\n\033[32m✓ smoke complete\033[0m\n'
