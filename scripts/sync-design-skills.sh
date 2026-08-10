#!/usr/bin/env bash
# sync-design-skills.sh — re-vendor the vendored design skills from upstream.
#
# Usage:
#   ./scripts/sync-design-skills.sh
#
# Clones bergside/awesome-design-skills (depth 1, no history) into a temp dir,
# replaces the contents of skills/design-system/ (skill folders + index.json +
# LICENSE), verifies the result, updates the SHA/date/count lines in
# skills/VENDORED.md, then cleans up the temp clone.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DEST="$ROOT_DIR/skills/design-system"
VENDORED="$ROOT_DIR/skills/VENDORED.md"
UPSTREAM="https://github.com/bergside/awesome-design-skills"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> Cloning $UPSTREAM (depth 1)"
git clone --depth 1 "$UPSTREAM" "$TMP/upstream"

SRC="$TMP/upstream"

# --- sanity: the upstream layout we depend on ---
[ -d "$SRC/skills" ]          || { echo "error: no skills/ directory in upstream" >&2; exit 1; }
[ -f "$SRC/skills/index.json" ] || { echo "error: missing skills/index.json in upstream" >&2; exit 1; }
[ -f "$SRC/LICENSE" ]         || { echo "error: missing LICENSE in upstream" >&2; exit 1; }

echo "==> Replacing $DEST"
rm -rf "$DEST"
mkdir -p "$DEST"
# Skill folders (each holds SKILL.md + DESIGN.md), plus index.json and LICENSE.
find "$SRC/skills" -mindepth 1 -maxdepth 1 -type d -exec cp -R {} "$DEST/" \;
cp "$SRC/skills/index.json" "$DEST/index.json"
cp "$SRC/LICENSE" "$DEST/LICENSE"

# --- verify: every folder must contain both SKILL.md and DESIGN.md ---
COUNT="$(find "$DEST" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
echo "   copied $COUNT skill folders"
BAD=0
for d in "$DEST"/*/; do
  if [ ! -f "$d/SKILL.md" ] || [ ! -f "$d/DESIGN.md" ]; then
    echo "error: incomplete skill folder: $d" >&2
    BAD=1
  fi
done
[ "$BAD" -eq 0 ] || { echo "error: aborting — skill folders incomplete" >&2; exit 1; }

# --- update VENDORED.md header (commit SHA, date, count) ---
SHA="$(git -C "$SRC" rev-parse HEAD)"
DATE="$(git -C "$SRC" log -1 --format=%cs)"
if sed --version 2>/dev/null | grep -q GNU; then
  SED_INPLACE=(-i)
else
  SED_INPLACE=(-i '')   # BSD/macOS sed requires an explicit empty backup suffix
fi
sed "${SED_INPLACE[@]}" \
  -e "s|- \*\*Vendored commit:\*\*.*|- **Vendored commit:** $SHA|" \
  -e "s|- \*\*Vendored date:\*\*.*|- **Vendored date:** $DATE|" \
  -e "s|- \*\*Count:\*\*.*|- **Count:** $COUNT skills|" \
  "$VENDORED"

echo "==> VENDORED.md updated: $SHA ($DATE), $COUNT skills"
echo "==> Done. Verify: ls $DEST | wc -l  (expect $((COUNT + 2)) entries)"
