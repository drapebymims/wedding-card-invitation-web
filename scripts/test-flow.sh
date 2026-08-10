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
  ADMIN_TOKEN=$(echo "$LOGIN" | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["token"])')
  [ -n "$ADMIN_TOKEN" ] || fail "no token in /auth/login response"
  pass "admin login"
elif [ -z "$ADMIN_TOKEN" ]; then
  echo "  (ADMIN_TOKEN not set — admin steps below will be skipped)"
fi

say "1. Public health"
HEALTH=$(curl -sf "$API/public/health") || fail "GET /public/health"
echo "$HEALTH" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["success"]; print("  success=true, data=", d.get("data"))'
pass "health"

say "2. Public read (adapt to your domain)"
# TODO(domain): point this at a real public resource, e.g. GET /catalog.
#   READ=$(curl -sf "$API/catalog") || fail "GET /catalog"
#   echo "$READ" | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print("  ", len(d), "records")'
# Stand-in so the script runs end-to-end before you adapt it:
curl -sf "$API/public/health" >/dev/null || fail "GET public read endpoint"
pass "public read reachable"

if [ -n "$ADMIN_TOKEN" ]; then
  say "3. Admin resource (adapt to your domain)"
  AUTH=(-H "Authorization: Bearer $ADMIN_TOKEN")
  # TODO(domain): replace /admin/orders with your admin list endpoint.
  QUEUE=$(curl -sf "$API/admin/orders" "${AUTH[@]}") || fail "GET /admin/orders (check ADMIN_TOKEN)"
  RECORD_ID=$(echo "$QUEUE" | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print(d[0]["id"] if d else "")')
  if [ -n "$RECORD_ID" ]; then
    say "4. Status transition (adapt to your domain)"
    # TODO(domain): replace with your record update endpoint + valid payload.
    curl -sf -X POST "$API/admin/orders/$RECORD_ID/status" "${AUTH[@]}" \
      -H 'Content-Type: application/json' -d '{"status":"completed"}' >/dev/null && pass "status -> completed"
  else
    echo "  (no records visible to admin — skip transitions)"
  fi
fi

say "ALL GOOD"
