# Standard Operating Procedure — Standing Up a New AWS Project

Ordered steps to go from an empty AWS account to a deployed project, using the proven
setup (drape-by-mims / BGAM / sinar-automotif / Bees). **Follow this order.** Steps 1–5 are
one-time; steps 6–12 repeat on every change.

## Phase A — Foundation (one-time)

### 1. AWS account + IAM user
- Sign in as root, create an IAM user for the project (e.g. `<project>-ai`) with
  programmatic access.
- Attach `AdministratorAccess` (or a scoped policy: `AmazonRDSFullAccess`,
  `AmazonCognitoPowerUser`, `AmazonS3FullAccess`, `AmazonAPIGatewayAdministrator`,
  `AWSLambda_FullAccess`, `IAMFullAccess`, `SecretsManagerReadWrite`, `AmazonSESFullAccess`,
  `AWSAmplifyDeployments`, `CloudFrontFullAccess`).
- `aws configure` with that user; note the account ID (`aws sts get-caller-identity`).

### 2. Region + DB conventions
- Pick a region (e.g. `ap-southeast-1`). RDS `db.t4g.micro` Postgres 16, 20GB gp3,
  **publicly accessible** (so Lambda outside a VPC can reach it), deletion protection only
  on prod.
- DB name `<project>`, username `<project>_admin`.

### 3. Terraform (persistent infra)
Copy from `templates/backend/terraform/`: `main.tf`, `variables.tf`, `database.tf`,
`cognito.tf`, `storage.tf`, `iam.tf`, `outputs.tf`. Fill in per-project values in
`terraform.tfvars.<stage>`:
- `stage`, `aws_region`, `bucket_suffix` (globally unique per account),
  `cognito_domain_prefix`, `db_name`, `db_username`, `admin_email`, `frontend_url`,
  Google IdP creds (optional).
- **BEFORE `terraform apply`**: run `terraform plan` and confirm **0 to destroy** (state
  must match live — a stale state from a previous account can wipe the DB). Back up any
  stale `terraform.tfstate` to `*.stale-backup` first.
- Apply. Capture outputs: `db_endpoint`, `db_secret_arn`, `cognito_user_pool_id/arn/
  client_id/domain`, `assets_bucket`, `assets_cdn_domain`.

### 4. Shared Lambda layer
Copy `templates/backend/layer/` (response, connection, serializer, validator, auth,
logger). Install deps **Linux-compatible only**:
```bash
pip install --platform manylinux2014_x86_64 --target python/python \
  --python-version 3.12 --only-binary=:all: --no-cache-dir psycopg2-binary Pillow requests
# keep EVERY .so in *.libs/ — never strip them
```
Deploy: `npx serverless deploy --stage dev` → note the new layer ARN
(`arn:aws:lambda:<region>:<acct>:layer:wedding-card-invitation-web-common:N`).

### 5. GitHub repo + CI/CD
- Create the monorepo with the layout in `docs/architecture.md` (use
  `scripts/scaffold-project.sh`).
- Add `.env.example` files (never commit `.env.local`).
- Amplify app (frontend): connect repo, `appRoot: apps/web`, root `amplify.yml`, branches
  `dev` + `main`. Set env vars: `NEXT_PUBLIC_*`, `NEXT_PUBLIC_API_BASE_URL`,
  `NEXT_PUBLIC_SITE_URL`.
- (Optional, Bees-style) GitHub Actions: layer deploy + service deploy with
  `dorny/paths-filter` matrix, pytest + lint in CI.

## Phase B — Backend (repeat per service)

### 6. Database migrations
- Add numbered `NNN_*.sql` under `infra/terraform/migrations/` (idempotent:
  `IF NOT EXISTS`, `ON CONFLICT DO UPDATE`).
- Apply **before** deploying code that uses them. From a machine with the DB secret:
  - local: `psql -h localhost -U <user> -d <db>`
  - live: read the secret from Secrets Manager, then
    `psql -h <host> -p 5432 -U <user> -d <db> -f migration.sql`
- Verify tables with `\dt public.*`.

### 7. Service code
Copy the service skeleton from `templates/backend/service/` (`serverless.yml`,
`requirements.txt`, `package/<name>_module/`). Follow the handler pattern + API envelope
from `docs/architecture.md`. Add routes for: public (no auth), authenticated (Cognito),
admin (role-gated), auth (login/signup/SSO).

### 8. Deploy backend
- Env block (set at deploy time): `GETDB_CONNECTION`, `COGNITO_USER_POOL_ID`,
  `COGNITO_APP_CLIENT_ID`, `COGNITO_DOMAIN`, `COGNITO_USER_POOL_ARN`, `ASSETS_BUCKET`,
  `ASSETS_CDN_URL`, `SES_SOURCE`, `ADMIN_NOTIFY_EMAIL`, `FRONTEND_URL`,
  `SENDER_NAME/PHONE/ADDRESS`, external API keys, `API_BASE_URL`, `WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN`.
- Deploy: `npx serverless deploy --stage dev`.
- Confirm the API is live: hit `https://<api-gw>/<stage>/` → expect `{"success": true, ...}`.

## Phase C — Frontend (repeat per release)

### 9. Frontend app
- Next.js static export: `output: 'export'`, `trailingSlash`, `images.unoptimized +
  remotePatterns`, read data at build time from the public API, no `no-store`.
  See `templates/frontend/README.md`.
- Or Vite/RN: axios wrapper unwrapping `data`, env base URL.
- Wire auth: localStorage tokens, 401 → clear + redirect to sign-in.
- Pick a design language from `skills/design-system/` per project nature
  (see `skills/project/design-style`).

### 10. Deploy frontend
- Push to `dev` → Amplify auto-builds → verify on `https://dev.<app>.amplifyapp.com`.
- Seed content/data (e.g. `scripts/seed.py`) so pages render real data.

### 11. Verification (every change)
- `tsc --noEmit` + lint + `next build` (or `vite build`) clean.
- API flow script (`scripts/test-flow.sh`): all green.
- Browser smoke: all routes 200, no page errors.

### 12. Promote to live
- Merge `dev` → `main`, push, Amplify builds the prod branch.
- Add the prod URL to CORS / callback URLs if applicable.
- Verify on the production domain; update the ROADMAP/IMPROVEMENT_PLAN.
- Log any new pain point back into `docs/pain-points.md`.

---

## Known pain points (read before you start — from Bees + drape-by-mims + BGAM + sinar)

| # | Pain point | Prevention |
|---|---|---|
| 1 | `get_connection()` takes 0 positional args but handlers pass one | Define `get_connection(secret_name=None)` from day one |
| 2 | Lambda 250MB limit exceeded | Prune old layer versions (`serverless-prune-plugin`, delete old `python-requirements` layers) |
| 3 | 502 Bad Gateway after stack recreation | `terraform apply -target=...aws_lambda_permission...` (or redeploy services) |
| 4 | Module not found in layer | Nested `python/python/{module}/` structure |
| 5 | psycopg2 fails with missing `.so` files | Keep ALL `*.libs` — never strip |
| 6 | YAML corruption from regex | Never regex-edit `serverless.yml`; remove exact strings only |
| 7 | Frontend reads `data.field`, backend returns `success({data: …})` | Define API contract first; read `data.data.field` |
| 8 | Stuck `UPDATE_ROLLBACK_FAILED` | Delete stack, empty S3, recreate — never continue a failed rollback |
| 9 | Devs blocked by force-push | `improvement-{name}` branches; never push directly to shared `dev` |
| 10 | Terraform fails: Lambda doesn't exist | Wait for ALL CI/CD deploys before running Terraform |
| 11 | Stale Terraform state → destroys live DB | `terraform plan` must show 0 destroys; backup stale state as `*.stale-backup` |
| 12 | Static export renders fallback data | No `cache: 'no-store'` on static pages; fetch at build time |
| 13 | DB password hardcoded in scripts | Read Secrets Manager at runtime; never commit credentials |
| 14 | External service missing from layer (`No module named 'requests'`) | Install ALL runtime deps (requests, Pillow…) into the layer in step 4 |
| 15 | `max_connections` exhaustion under load | Thread-local connection caching in `connection.py` |
| 16 | Hardcoded API URLs/domain in frontend source | Env vars are mandatory; no real fallbacks in code |

## Handy commands

```bash
# DB credentials
aws secretsmanager get-secret-value --secret-id <secret-name> --region <region> \
  --query SecretString --output text

# psql to live
PGPASSWORD="$(…)" psql -h <host> -p 5432 -U <user> -d <db>

# Deploy layer / service
npx serverless deploy --stage dev

# Check layer versions
aws lambda list-layer-versions --layer-name wedding-card-invitation-web-common

# CloudFront asset URL pattern
https://<cdn-domain>/products/<slug>-<id>/full.jpg
```
