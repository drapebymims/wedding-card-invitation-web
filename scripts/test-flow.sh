#!/usr/bin/env bash
# test-flow.sh — post-deploy verification suite for a wedding-card-invitation-web project.
#
# Runs an end-to-end smoke flow against a deployed API and asserts the API
# envelope contract ({success, data, error}) after every call. Run it from the
# repo root after each backend deploy to prove the stage is healthy.
#
# Usage:
#   API_BASE_URL=https://<api-gateway-id>.execute-api.<region>.amazonaws.com/<stage> \
#   ADMIN_TOKEN=<cognito-id-token> \
#   scripts/test-flow.sh
#
#   (or authenticate interactively by also setting ADMIN_EMAIL + ADMIN_PASSWORD,
#    which triggers a POST /auth/login first).
#
# Covers: public health -> public read -> admin resource -> status transition.
# Each section is a placeholder — adapt the endpoints to your service.
#
# Requires: bash, curl, python3. No other dependencies.
set -euo pipefail

API="${API_BASE_URL:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

# --- helpers (shared style across all project scripts) ---
say()  { printf '\n\033[1;34m== %s ==\033[0m\n' "$1"; }
fail() { printf '\033[1;31mFAIL: %s\033[0m\n' "$1"; exit 1; }
pass() { printf '\033[1;32mok: %s\033[0m\n' "$1"; }

# --- preconditions ---
if [ -z "$API" ]; then
  echo "error: API_BASE_URL is required — e.g. https://<api-gateway-id>.execute-api.<region>.amazonaws.com/<stage>" >&2
  exit 1
fi

# --- 0. admin login (skipped when ADMIN_TOKEN is already provided) ---
if [ -z "$ADMIN_TOKEN" ] && [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  say "0. Admin login"
  LOGIN=$(curl -sf -X POST "$API/auth/login" -H 'Content-Type: application/json' \
    -d "$(python3 - "$ADMIN_EMAIL" "$ADMIN_PASSWORD" <<'PY'
import json, sys
email, password = sys.argv[1], sys.argv[2]
print(json.dumps({"email": email, "password": password}))
PY
    )") || fail "POST /auth/login (check ADMIN_EMAIL / ADMIN_PASSWORD)"
  ADMIN_TOKEN=$(echo "$LOGIN" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["IdToken"])')
  [ -n "$ADMIN_TOKEN" ] || fail "no token in /auth/login response"
  pass "admin login"
elif [ -z "$ADMIN_TOKEN" ]; then
  echo "  (ADMIN_TOKEN not set — admin steps below will be skipped)"
fi

say "1. Public health"
HEALTH=$(curl -sf "$API/public/health") || fail "GET /public/health"
echo "$HEALTH" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["success"]; print("  success=true, data=", d.get("data"))'
pass "health"

say "2. Public RSVP flow"
COUPLE="${COUPLE_SLUG:-adam-eve}"
RSVP_NAME="Test $(date +%s)"
RSVP=$(curl -sf -X POST "$API/public/rsvps" -H 'Content-Type: application/json' \
  -d "$(python3 - "$COUPLE" "$RSVP_NAME" <<'PY'
import json, sys
print(json.dumps({
  "coupleSlug": sys.argv[1],
  "guestName": sys.argv[2],
  "attendance": "yes",
  "guestsCount": 2,
  "phone": "6012-000 0000",
}))
PY
  )") || fail "POST /public/rsvps"
echo "$RSVP" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["success"]; print("  rsvp id =", d["data"]["id"])'
pass "rsvp created"

say "3. Public wishes (post + list)"
curl -sf -X POST "$API/public/wishes" -H 'Content-Type: application/json' \
  -d "$(python3 - "$COUPLE" "$RSVP_NAME" <<'PY'
import json, sys
print(json.dumps({"coupleSlug": sys.argv[1], "name": sys.argv[2], "message": "Test wish from test-flow.sh"}))
PY
  )" >/dev/null || fail "POST /public/wishes"
WISHES=$(curl -sf "$API/public/wishes?coupleSlug=$COUPLE") || fail "GET /public/wishes"
echo "$WISHES" | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print("  approved wishes:", len(d))'
pass "wishes"

if [ -n "$ADMIN_TOKEN" ]; then
  say "4. Admin reads"
  AUTH=(-H "Authorization: Bearer $ADMIN_TOKEN")
  curl -sf "$API/admin/health" "${AUTH[@]}" >/dev/null || fail "GET /admin/health"
  STATS=$(curl -sf "$API/admin/rsvps/stats?coupleSlug=$COUPLE" "${AUTH[@]}") || fail "GET /admin/rsvps/stats"
  echo "$STATS" | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print("  stats:", d)'
  PENDING=$(curl -sf "$API/admin/wishes?coupleSlug=$COUPLE&status=pending" "${AUTH[@]}") || fail "GET /admin/wishes"
  WISH_ID=$(echo "$PENDING" | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print(d[0]["id"] if d else "")')
  if [ -n "$WISH_ID" ]; then
    curl -sf -X PATCH "$API/admin/wishes/$WISH_ID" "${AUTH[@]}" \
      -H 'Content-Type: application/json' -d '{"approved":true}' >/dev/null && pass "wish $WISH_ID approved"
  else
    echo "  (no pending wishes — skip approval)"
  fi
fi

say "ALL GOOD"
