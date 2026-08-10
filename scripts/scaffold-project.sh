#!/usr/bin/env bash
# scaffold-project.sh — bootstrap a new project from the foundation starter repo.
#
# Usage:
#   ./scripts/scaffold-project.sh <new-project-name> [target-dir] [options]
#
#   <new-project-name>  e.g. "my-app"  (letters, numbers, dashes, underscores)
#   [target-dir]        where to create it (default: ../<new-project-name>)
#
# Options:
#   --services <a,b,c>      Materialize a service per name from templates/backend/service
#                           (e.g. --services weddings,catalog -> services/weddings-service, ...)
#   --frontend <next|vite>  Scaffold apps/web non-interactively (create-next-app / create-vite).
#                           Omit for no frontend (add it later per templates/frontend/README.md).
#   --no-git                Do not git init + initial commit after scaffolding.
#   --no-materialize        Copy the foundation as-is; do not auto-materialize infra/layer/services.
#   --dry-run               Print what would be done without copying anything.
#   -h | --help             Show this help.
#
# What it does:
#   1. Copies the entire foundation repo into the target (minus .git, node_modules).
#   2. Renames the placeholders across every copied file:
#   wedding-card-invitation-web        -> <new-project-name>          (resource names)
#        wedding_card_invitation_web_common -> <slug>_common              (shared-layer python module, dash-safe)
#        WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN -> <SLUG>_COMMON_LAYER_ARN   (env var, uppercase)
#        wedding-card-invitation-web      -> <new-project-name>          (paths in docs / layer dirs)
#   3. Materializes the generic templates into the canonical layout:
#      infra/terraform/  <- templates/backend/terraform
#      layers/shared-layers/<project>-common-layer/ <- templates/backend/layer
#      services/<name>-service/ <- templates/backend/service (per --services)
#   4. Validates that no placeholder tokens (wedding-card-invitation-web, wedding_card_invitation_web_common, wedding-card-invitation-web, <name>)
#      remain anywhere outside templates/, skills/, docs/.
#   5. Optionally git init + initial commit (unless --no-git).
#   6. chmod +x every script so they run out of the box.
#   7. Prints the next-steps checklist (see docs/sop.md, Phase A/B/C).
#
# The target must not exist yet (use OVERWRITE=1 to force a copy-over; nothing
# is ever deleted). Readable by hand — this is a teaching script.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FOUNDATION_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  sed -n '3,33p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

# --- argument parsing -------------------------------------------------------
PROJECT_NAME=""
TARGET_DIR=""
SERVICES=""
FRONTEND=""
DO_GIT=1
MATERIALIZE=1
DRY_RUN=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --services)
      SERVICES="${2:?--services requires a comma-separated list, e.g. weddings,catalog}"
      shift 2 ;;
    --frontend)
      FRONTEND="${2:?--frontend requires 'next' or 'vite'}"
      case "$FRONTEND" in
        next|vite) ;;
        *) echo "error: --frontend must be 'next' or 'vite' (got '$FRONTEND')" >&2; exit 1 ;;
      esac
      shift 2 ;;
    --no-git) DO_GIT=0; shift ;;
    --no-materialize) MATERIALIZE=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage ;;
    *)
      if [[ -z "$PROJECT_NAME" ]]; then
        PROJECT_NAME="$1"
      elif [[ -z "$TARGET_DIR" ]]; then
        TARGET_DIR="$1"
      else
        echo "error: unexpected argument: $1" >&2
        usage 1>&2
      fi
      shift ;;
  esac
done

if [[ -z "$PROJECT_NAME" ]]; then
  echo "error: missing project name" >&2
  usage 1>&2
fi

# --- derive a python-safe module slug (dashes are invalid in python imports) ---
#   papawan-garage -> module papawan_garage_common, env PAPAWAN_GARAGE_COMMON_LAYER_ARN
PROJECT_SLUG="${PROJECT_NAME//-/_}"
PROJECT_SLUG_UP="$(printf '%s' "$PROJECT_SLUG" | tr '[:lower:]' '[:upper:]')"

# --- validate the project name (keeps sed and path quoting safe) ---
case "$PROJECT_NAME" in
  "" | *[!a-zA-Z0-9_-]*)
    echo "error: project name must contain only letters, numbers, dashes or underscores." >&2
    exit 1
    ;;
esac

# --- validate service names up front (avoid half-scaffolds) ---
IFS=',' read -r -a SERVICE_LIST <<< "$SERVICES"
for s in "${SERVICE_LIST[@]:-}"; do
  [[ -n "$s" ]] || continue
  case "$s" in
    "" | *[!a-zA-Z0-9_-]*)
      echo "error: service name must contain only letters, numbers, dashes or underscores (got '$s')." >&2
      exit 1
      ;;
  esac
done

# --- resolve the target to a normalized absolute path (handles `/../` too) ---
TARGET_DIR="${TARGET_DIR:-$FOUNDATION_DIR/../$PROJECT_NAME}"
TARGET_DIR="$(cd "$(dirname "$TARGET_DIR")" && pwd)/$(basename "$TARGET_DIR")"

# --- refuse to scaffold into the foundation repo itself ---
case "$TARGET_DIR" in
  "$FOUNDATION_DIR" | "$FOUNDATION_DIR"/*)
    echo "error: target must be outside the foundation repo." >&2
    exit 1
    ;;
esac

# --- refuse to clobber an existing target (unless OVERWRITE=1) ---
if [ -e "$TARGET_DIR" ]; then
  if [ "${OVERWRITE:-0}" != "1" ]; then
    echo "error: target already exists: $TARGET_DIR" >&2
    echo "  Remove it first, or re-run with OVERWRITE=1 to copy over it." >&2
    exit 1
  fi
  echo "==> target exists — OVERWRITE=1 set, copying over it"
fi

echo "==> Scaffolding '$PROJECT_NAME' into $TARGET_DIR"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "    [dry-run] nothing copied; flags: services='${SERVICES:-none}' frontend='${FRONTEND:-none}' git=$([ $DO_GIT == 1 ] && echo yes || echo no) materialize=$([ $MATERIALIZE == 1 ] && echo yes || echo no)"
  exit 0
fi

# --- 1. copy the foundation repo (excluding git internals + deps) ---
mkdir -p "$TARGET_DIR"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --exclude='.git' --exclude='node_modules' --exclude='.DS_Store' \
    "$FOUNDATION_DIR/" "$TARGET_DIR/"
else
  # rsync-less fallback: plain copy, then drop the bits we don't want.
  cp -R "$FOUNDATION_DIR"/. "$TARGET_DIR/"
  rm -rf "$TARGET_DIR/.git" "$TARGET_DIR/node_modules"
fi

# --- 2a. rename files/directories that contain a placeholder token ---
echo "==> Renaming paths: wedding-card-invitation-web / wedding_card_invitation_web_common / wedding-card-invitation-web -> $PROJECT_NAME"
while IFS= read -r -d '' p; do
  d="$(dirname "$p")"
  b="$(basename "$p")"
  nb="${b//wedding-card-invitation-web/$PROJECT_NAME}"
  nb="${nb//wedding_card_invitation_web_common/${PROJECT_SLUG}_common}"
  nb="${nb//wedding-card-invitation-web/$PROJECT_NAME}"
  if [ "$nb" != "$b" ]; then
    mv "$p" "$d/$nb"
  fi
done < <(find "$TARGET_DIR" -depth \( -name '*wedding-card-invitation-web*' -o -name '*wedding_card_invitation_web_common*' -o -name '*wedding-card-invitation-web*' \) -print0)

# --- 2b. replace the tokens inside every text file ---
echo "==> Rewriting placeholders in file contents"
if sed --version 2>/dev/null | grep -q GNU; then
  SED_INPLACE=(-i)
else
  SED_INPLACE=(-i '')   # BSD/macOS sed requires an explicit empty backup suffix
fi
while IFS= read -r -d '' f; do
  # grep -qI skips binary files (design-system images, layer wheels, ...)
  if LC_ALL=C grep -qI . "$f" 2>/dev/null; then
    sed "${SED_INPLACE[@]}" \
      -e "s/WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN/${PROJECT_SLUG_UP}_COMMON_LAYER_ARN/g" \
      -e "s/wedding_card_invitation_web_common/${PROJECT_SLUG}_common/g" \
      -e "s/wedding-card-invitation-web/$PROJECT_NAME/g" \
      -e "s/wedding-card-invitation-web/$PROJECT_NAME/g" \
      "$f"
  fi
done < <(find "$TARGET_DIR" -type f -print0)

# --- 3. materialize the generic templates into the canonical layout ---
if [[ "$MATERIALIZE" == "1" ]]; then
  echo "==> Materializing templates"

  if [[ -d "$TARGET_DIR/templates/backend/terraform" && ! -d "$TARGET_DIR/infra/terraform" ]]; then
    mkdir -p "$TARGET_DIR/infra"
    cp -R "$TARGET_DIR/templates/backend/terraform" "$TARGET_DIR/infra/terraform"
    echo "    infra/terraform/  <- templates/backend/terraform"
  fi

  LAYER_DIR="$TARGET_DIR/layers/shared-layers/$PROJECT_NAME-common-layer"
  if [[ -d "$TARGET_DIR/templates/backend/layer" && ! -d "$LAYER_DIR" ]]; then
    mkdir -p "$(dirname "$LAYER_DIR")"
    cp -R "$TARGET_DIR/templates/backend/layer" "$LAYER_DIR"
    echo "    layers/shared-layers/$PROJECT_NAME-common-layer/  <- templates/backend/layer"
  fi

  for s in "${SERVICE_LIST[@]:-}"; do
    [[ -n "$s" ]] || continue
    SERVICE_DIR="$TARGET_DIR/services/$s-service"
    if [[ -d "$TARGET_DIR/templates/backend/service" && ! -d "$SERVICE_DIR" ]]; then
      mkdir -p "$TARGET_DIR/services"
      cp -R "$TARGET_DIR/templates/backend/service" "$SERVICE_DIR"
      # rename the <name>_module package dir
      if [[ -d "$SERVICE_DIR/<name>_module" ]]; then
        mv "$SERVICE_DIR/<name>_module" "$SERVICE_DIR/${s}_module"
      fi
      # replace remaining <name> tokens inside this service
      while IFS= read -r -d '' f; do
        if LC_ALL=C grep -qI . "$f" 2>/dev/null; then
          sed "${SED_INPLACE[@]}" -e "s/<name>/$s/g" "$f"
        fi
      done < <(find "$SERVICE_DIR" -type f -print0)
      echo "    services/$s-service/  <- templates/backend/service"
    fi
  done

  # Point the root deploy:service script at the first materialized service so the
  # derived project's package.json never references a non-existent service.
  if [[ -n "$SERVICES" && -f "$TARGET_DIR/package.json" ]]; then
    FIRST_SERVICE="${SERVICE_LIST[0]}"
    sed "${SED_INPLACE[@]}" \
      -e "s#services/$PROJECT_NAME-<name>-service#services/$FIRST_SERVICE-service#" \
      "$TARGET_DIR/package.json"
    echo "    package.json deploy:service -> services/$FIRST_SERVICE-service"
  fi

  if [[ -n "$FRONTEND" ]]; then
    echo "    apps/web  <- create-$([ "$FRONTEND" = "next" ] && echo next-app || echo vite)"
  fi
else
  echo "==> Skipping materialization (--no-materialize)"
fi

# --- 4. validate no placeholder tokens remain outside templates/, skills/, docs/ ---
echo "==> Validating placeholders"
# Project-level tokens (wedding-card-invitation-web, wedding_card_invitation_web_common, wedding-card-invitation-web) must be gone everywhere except
# the genericized template/skill sources. The <name> token is legitimate in docs
# (README/AGENTS/seed comments describe the reusable per-service pattern), so it
# is only required gone from operational files (package.json, services/, infra/,
# layers/, amplify.yml, .env.example).
LEFT_wedding-card-invitation-web=$(find "$TARGET_DIR" -type f \
  -not -path "*/templates/*" -not -path "*/skills/*" -not -path "*/docs/*" \
  -not -path "*/.git/*" -not -path "*/node_modules/*" \
  \( -name '*.py' -o -name '*.yml' -o -name '*.yaml' -o -name '*.tf' -o -name '*.sql' \
     -o -name '*.sh' -o -name '*.md' -o -name '*.example' -o -name '*.ts' -o -name '*.tsx' \
     -o -name '*.json' -o -name '*.js' \) -print0 2>/dev/null | \
  xargs -0 grep -l -e 'wedding-card-invitation-web' -e 'wedding_card_invitation_web_common' -e 'wedding-card-invitation-web' 2>/dev/null || true)
LEFT_NAME=$(find "$TARGET_DIR" -type f \
  -not -path "*/templates/*" -not -path "*/skills/*" -not -path "*/docs/*" \
  -not -path "*/.git/*" -not -path "*/node_modules/*" \
  -not -path "*/scripts/*" -not -name '*.md' \
  \( -name '*.py' -o -name '*.yml' -o -name '*.yaml' -o -name '*.tf' -o -name '*.sql' \
     -o -name '*.sh' -o -name '*.example' -o -name '*.ts' -o -name '*.tsx' \
     -o -name '*.json' -o -name '*.js' \) -print0 2>/dev/null | \
  xargs -0 grep -l -e '<name>' 2>/dev/null || true)
if [[ -n "$LEFT_wedding-card-invitation-web$LEFT_NAME" ]]; then
  echo "error: placeholder tokens remain in:" >&2
  printf '%s\n%s\n' "$LEFT_wedding-card-invitation-web" "$LEFT_NAME" | sed '/^$/d' >&2
  echo "  Fix these before committing (they would become real resource names)." >&2
  exit 1
fi
echo "    no placeholder tokens remain"

# --- 5. make scripts executable ---
echo "==> Marking scripts executable"
find "$TARGET_DIR/scripts" -maxdepth 1 -type f \( -name '*.sh' -o -name 'seed.py' \) -exec chmod +x {} \;

# --- 6. optional git init + initial commit ---
if [[ "$DO_GIT" == "1" ]]; then
  if command -v git >/dev/null 2>&1; then
    echo "==> git init + initial commit"
    git -C "$TARGET_DIR" init -q -b main
    git -C "$TARGET_DIR" add -A
    git -C "$TARGET_DIR" commit -q -m "chore: scaffold $PROJECT_NAME from foundation"
    echo "    committed on branch main"
  else
    echo "    git not found — skipping (run: git init && git add -A && git commit)"
  fi
else
  echo "==> Skipping git init (--no-git)"
fi

# --- 7. frontend scaffold (non-interactive) ---
if [[ -n "$FRONTEND" ]]; then
  echo "==> Scaffolding frontend"
  if ! command -v npm >/dev/null 2>&1; then
    echo "    npm not found — skipping. Run the create- command from templates/frontend/README.md later." >&2
  elif [[ "$FRONTEND" == "next" ]]; then
    (cd "$TARGET_DIR" && npx --yes create-next-app@latest apps/web \
      --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes)
  else
    (cd "$TARGET_DIR" && npm create vite@latest apps/web -- --template react-ts --no-interactive)
  fi
fi

# --- 8. next steps ---
echo
echo "================================================================"
echo "  Scaffold complete: '$PROJECT_NAME' created at $TARGET_DIR"
echo "================================================================"
echo
echo "Next steps:"
echo "  1. cd $TARGET_DIR"
echo "  2. Run the bootstrap-project skill (or follow docs/sop.md step by step):"
echo "     Phase A — AWS account + IAM, Terraform apply (0 destroys), layer deploy"
echo "     Phase B — migrations before code, serverless deploy --stage dev"
echo "     Phase C — frontend on Amplify, seed (scripts/seed.py), verify (scripts/test-flow.sh)"
echo "  3. Fill in .env.example and infra/terraform/terraform.tfvars at deploy time — never commit real secrets."
echo
echo "Conventions you scaffolded into (docs/conventions.md):"
echo "  DB secret        $PROJECT_NAME-{stage}-db-credentials"
echo "  Shared layer     layers/shared-layers/$PROJECT_NAME-common-layer"
echo "  Python module    ${PROJECT_SLUG}_common"
echo "  Layer env var    ${PROJECT_SLUG_UP}_COMMON_LAYER_ARN"
echo
