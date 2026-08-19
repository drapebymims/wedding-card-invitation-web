#!/usr/bin/env bash
# trigger-build.sh — trigger an on-demand Amplify build (RELEASE) for the
# production branch. This is the "build-on-demand" trigger that a paid-order
# path (or an operator) calls to publish new/changed cards into the static
# export (a new card appears at /w/<slug> after the build succeeds).
#
# Usage:
#   scripts/trigger-build.sh
#
# Env contract (placeholders only — never commit real values, AGENTS.md rule 7):
#   AMPLIFY_APP_ID   Amplify app id (required)
#   AMPLIFY_BRANCH   branch to build (default: main)
#   AWS_REGION       AWS region (default: ap-southeast-1)
#
# Requires the AWS CLI with credentials that can start a job on the app.
# Exits 0 on success (job started, job id printed), non-zero on missing
# app-id or on AWS/credentials failure — config mistakes are NOT hidden.
set -euo pipefail

APP_ID="${AMPLIFY_APP_ID:-}"
BRANCH="${AMPLIFY_BRANCH:-main}"
REGION="${AWS_REGION:-ap-southeast-1}"

if [[ -z "$APP_ID" ]]; then
  echo "error: AMPLIFY_APP_ID is not set. Set it in your env (see .env.example)." >&2
  exit 1
fi

echo "==> Starting Amplify build for app '$APP_ID' branch '$BRANCH' (region $REGION)"

JOB_JSON="$(aws amplify start-job \
  --app-id "$APP_ID" \
  --branch-name "$BRANCH" \
  --job-type RELEASE \
  --region "$REGION")"

JOB_ID="$(printf '%s' "$JOB_JSON" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['job']['summary']['jobId'])")"

echo "==> Build triggered: job id $JOB_ID"
echo "$JOB_ID"
