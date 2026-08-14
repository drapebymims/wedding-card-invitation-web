# Restore — wedding-card-invitation-web (re-deploy into any AWS account)

Backup taken 2026-08-15. Everything needed to bring this project back lives in
`backup/` and this repo. The procedure below is account-agnostic — it works for
re-deploying into the same account or a **new AWS account**.

## What was backed up (backup/)

| What | Where |
|---|---|
| Postgres dump (custom format, `pg_restore`) | `backup/db/wedding_card_invitation_web.dump` |
| RDS final snapshot (region ap-southeast-1) | `wedding-card-invitation-web-pre-teardown-20260815` |
| S3 web bucket (CloudFront hosting) | `backup/s3/wedding-card-invitation-web-dev-web/` |
| S3 assets bucket | `backup/s3/wedding-card-invitation-web-dev-assets/` |
| S3 receipts bucket | `backup/s3/wedding-card-invitation-web-dev-receipts/` |
| Terraform state (the exact live resources) | `backup/tf/terraform.tfstate` |

## Live resources that were deleted

- RDS: `wedding-card-invitation-web-dev-pg` (db `wedding`, user `wedding_admin`)
- S3: `wedding-card-invitation-web-dev-web` / `-assets` / `-receipts`
- CloudFront: `E1L3IOU8UYTQVG`, `EMZEB9UU4C84G` (+ OAC + CloudFront Function)
- Cognito pool + client + domain (`wedding-card-invitation-web-auth-dev`)
- Secret: `wedding-card-invitation-web-dev-db-credentials`
- Lambda/API GW: `weddings-service` (`serverless remove`)
- Amplify app (dev)

## Restore procedure

```bash
# 1. Fresh infra (new account: empty state; same account: restored state)
cd infra/terraform
cp ../backup/tf/terraform.tfstate .   # only if restoring into the SAME account
terraform init && terraform plan      # must show 0 to destroy
terraform apply                        # recreates RDS/S3/Cognito/CloudFront/web.tf/secrets

# 2. Restore the database (after RDS is up; wait for endpoint)
aws secretsmanager get-secret-value --secret-id wedding-card-invitation-web-dev-db-credentials \
  --query SecretString --output text    # -> host/user/password
pg_restore --clean --no-owner -h <host> -U wedding_admin -d wedding backup/db/wedding_card_invitation_web.dump
#   (or restore from the RDS snapshot instead)

# 3. Deploy the layer first, capture the new layer ARN, then the service
cd layers/shared-layers/wedding-card-invitation-web-common-layer && serverless deploy --stage dev
cd services/weddings-service && serverless deploy --stage dev   # with full env block from .env.example

# 4. Restore hosting content + assets
aws s3 sync backup/s3/wedding-card-invitation-web-dev-web s3://wedding-card-invitation-web-dev-web
aws s3 sync backup/s3/wedding-card-invitation-web-dev-assets s3://wedding-card-invitation-web-dev-assets

# 5. Frontend: re-link Amplify (or use the web.tf CloudFront hosting) pointing at the
#    new API; rebuild. Re-create admin Cognito users after the pool is up.
```

> IMPORTANT: the repo's `amplify.yml` still contains the broken SPA `customRules`
> rewrite that makes every deep link serve the home page on static export. If you
> re-host on Amplify, remove that block first (or prefer the `web.tf` CloudFront path).
