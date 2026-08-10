#!/usr/bin/env bash
# wait-amplify.sh — poll an Amplify branch build until it SUCCEEDS or FAILS.
#
# Usage:
#   scripts/wait-amplify.sh <app-id> <branch> [previous-job-id]
#
#   <app-id>           Amplify app id (from the Amplify console)
#   <branch>           branch name to watch (e.g. dev)
#   [previous-job-id]  optional — skip builds that were already running before
#                      your push, i.e. wait specifically for the NEW build.
#
# Requires the AWS CLI with credentials that can read the Amplify app.
# Exits 0 on SUCCEED, 1 on FAILED or timeout (CI-friendly).
set -euo pipefail

APP_ID="${1:?usage: wait-amplify.sh <app-id> <branch> [prev-job-id]}"
BRANCH="${2:?usage: wait-amplify.sh <app-id> <branch> [prev-job-id]}"
PREV="${3:-}"
REGION="${AWS_REGION:-ap-southeast-1}"   # override via AWS_REGION

for i in $(seq 1 40); do
  JOB=$(aws amplify list-jobs --app-id "$APP_ID" --branch-name "$BRANCH" --region "$REGION" \
    --max-results 1 2>/dev/null \
    | python3 -c "import json,sys; d=json.load(sys.stdin); j=d['jobSummaries'][0]; print(j['jobId']+'|'+j['status'])" 2>/dev/null \
    || echo "?|?")
  JID="${JOB%%|*}"
  STATUS="${JOB##*|}"
  echo "check $i: job $JID status $STATUS"

  if [ -n "$PREV" ] && [ "$JID" = "$PREV" ]; then
    sleep 20
    continue
  fi

  case "$STATUS" in
    SUCCEED)
      echo "BUILD SUCCEED (job $JID)"
      exit 0
      ;;
    FAILED)
      echo "BUILD FAILED (job $JID)" >&2
      exit 1
      ;;
  esac
  sleep 30
done

echo "Timed out waiting for build." >&2
exit 1
