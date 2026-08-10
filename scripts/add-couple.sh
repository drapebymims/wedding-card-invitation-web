#!/usr/bin/env bash
# add-couple.sh — bootstrap a new couple site from the template config.
#
# Usage:
#   scripts/add-couple.sh <slug>
#
#   <slug>  e.g. "adam-eve" (lowercase letters, numbers, dashes). Becomes
#           the URL path: <site>/w/<slug> and the config file
#           apps/web/config/couples/<slug>.json.
#
# Then: fill in the config, rebuild + redeploy the frontend (one Amplify build
# serves every couple). The backend needs no changes — it is multi-tenant by
# couple_slug.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_DIR="$ROOT/apps/web/config/couples"

SLUG="${1:-}"
if [[ -z "$SLUG" ]]; then
  echo "usage: scripts/add-couple.sh <slug>" >&2
  exit 1
fi

case "$SLUG" in
  *[!a-z0-9-]* | -* | *-)
    echo "error: slug must be lowercase letters/numbers/dashes, and not start/end with a dash." >&2
    exit 1
    ;;
esac

if [[ -e "$CONFIG_DIR/$SLUG.json" ]]; then
  echo "error: $CONFIG_DIR/$SLUG.json already exists." >&2
  exit 1
fi

if [[ ! -e "$CONFIG_DIR/_template.json" ]]; then
  echo "error: template not found at $CONFIG_DIR/_template.json" >&2
  exit 1
fi

cp "$CONFIG_DIR/_template.json" "$CONFIG_DIR/$SLUG.json"
chmod 644 "$CONFIG_DIR/$SLUG.json"

echo "==> Created $CONFIG_DIR/$SLUG.json"
echo
echo "Next steps:"
echo "  1. Fill in the config (names, date, events, gallery, theme, language...)."
echo "  2. Rebuild + deploy the frontend (git add/commit/push → Amplify rebuilds;"
echo "     every couple is served from the one app — no backend changes needed)."
echo "  3. Your couple's site will be live at  <site>/w/$SLUG"
