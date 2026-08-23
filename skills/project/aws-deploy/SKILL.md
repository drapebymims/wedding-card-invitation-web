---
name: aws-deploy
description: Deploy playbook for foundation-derived projects — Serverless deploys, Terraform safety rails, Amplify builds, CloudFront caching, CI/CD traps. Use when deploying anything or debugging a failed/stuck deploy. Trigger words: "deploy", "serverless deploy", "terraform", "Amplify build", "CloudFront", "502", "rollback", "CI".
---

# AWS Deploy — Order, Rails, Recovery

## Deploy order is law

1. **Migrations** applied before code that queries them.
2. **Shared layer** first → note new layer ARN.
3. **Each service** with the new ARN + full env block from `.env.example`.
4. **Frontend** push to `dev` (for static export a merge IS the deploy).
5. Confirm stage root returns `{"success": true}` before moving on.

## Terraform safety rails

- `terraform plan` MUST show **0 to destroy** — stale state can wipe the live DB.
  Back up stale state as `*.stale-backup` first (#11).
- Wait for ALL CI/CD deploys before Terraform, or Lambda-permission refs break (#10).
- Stuck `UPDATE_ROLLBACK_FAILED`: FIRST try
  `aws cloudformation continue-update-rollback --resources-to-skip <logical-id>`;
  only then delete stack + empty S3 + recreate (#8).
- 502 after stack recreation → `terraform apply -target=...aws_lambda_permission...` (#3).
- HCL forbids `${...}` in variable `description` strings (#58). API Gateway is owned by
  Serverless Framework, never Terraform. `*.tfvars` never committed (#33/#62).

## Serverless deploys

- Global v3 CLI, never `npx serverless` — the prune plugin peer-installs local
  `serverless@4`; if hijacked: `rm -rf node_modules/serverless` (#20/#54).
- Long project names overflow auto IAM role name at 64 chars → explicit short
  `provider.iam.role.name` (#30).
- CI: deployment bucket name truncates at S3's 63-char limit — IAM wildcard must be
  `<repo>-*-serverlessdeploymentbuck*`; grant the FULL upfront IAM set in one pass:
  lambda versions/aliases, CFN Describe*, iam:GetRole, s3 tagging, events DescribeRule (#48).
- GitHub Actions exports EVERY `${env:*}` referenced by serverless.yml (#51); OIDC trust
  needs `StringLike repo:owner@*/repo@*:*` — workflow_dispatch subs carry numeric IDs
  (#47); IAM policies cap at 5 versions — rebuild from the current default doc (#49).

## Amplify

- `applications:` phases REQUIRE `commands:` sub-keys — bare lists silently run NOTHING
  while the build still "succeeds" (#26). Phases SHARE cwd: `cd` in preBuild persists
  into build (#50).
- Artifact baseDirectory `out` (Next export) / `dist` (Vite); root amplify.yml with
  `appRoot: apps/web`. Blank site after green build = missing `output:'export'` or wrong
  baseDirectory — reproduce the exact build locally first (#18).
- CLI-created app without the spec → `aws amplify update-app --build-spec file://amplify.yml`
  (#35). Apps answer on the BRANCH-qualified domain (`main.<appId>.amplifyapp.com`, #37).
  Link repos via console OAuth — no PAT needed; forced PAT needs Contents:Read AND
  Webhooks:R/W (#41).
- SPA rewrite matrix: Vite gets `customRules` → `/index.html` (#21); Next static export
  gets NONE (#29); CLI-created apps need app-level `update-app --custom-rules` (#27).
- Admin "rebuild" endpoints need `amplify:StartJob` in service IAM.

## CORS for authorizer 4xx

Configure `apiGateway.gatewayResponses` for UNAUTHORIZED/ACCESS_DENIED/DEFAULT_4XX (#22).
If deploy warns "unrecognized property": `aws apigateway put-gateway-response --response-type DEFAULT_4XX`
with LOWERCASE `gatewayresponse.header.*` keys + `create-deployment`; verify
`access-control-allow-origin` on the 401 body (#36).

## CloudFront

Caches `s-maxage=31536000` — invalidate or confirm new ETag after deploys that must
appear immediately (#23). Replaced assets get RENAMED, not overwritten (#61).

## Post-deploy verification

`scripts/test-flow.sh` all green · browser smoke routes 200/no pageerror · poll builds
with `scripts/wait-amplify.sh <app-id> <branch>`.

Handy commands:

```bash
aws secretsmanager get-secret-value --secret-id <name> --region <region> \
  --query SecretString --output text
aws apigateway put-gateway-response --rest-api-id <id> --response-type DEFAULT_4XX \
  --response-parameters '{"gatewayresponse.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --status-code 400 && aws apigateway create-deployment --rest-api-id <id> --stage-name <stage>
aws amplify update-app --build-spec file://amplify.yml
aws cloudformation continue-update-rollback --stack-name <stack> --resources-to-skip <LogicalId>
aws amplify update-app --custom-rules file://rewrite-rules.json
```

## Anti-patterns

- Applying terraform with any planned destroys.
- `npx serverless` on autopilot.
- Trusting a green Amplify build (check artifacts exist).
- Continuing failed rollbacks blindly.
- Redeploying services before bumping the layer ARN everywhere.
- Skipping test-flow after backend deploys.

## Related

`docs/sop.md`, `docs/pain-points.md` rows 2–11, 18–23, 25–27, 29, 35–37, 41, 47–54,
58, 61 · pairs with `commit-discipline`, `cognito-auth`.
