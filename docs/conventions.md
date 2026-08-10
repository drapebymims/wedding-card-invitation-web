# Conventions — Naming, Code Style, API Contract, Env Vars

The conventions every project built from this foundation should follow. When in doubt,
check the sibling projects (`docs/reference-map.md`) for real examples.

## Naming

| Thing | Convention | Example |
|---|---|---|
| Repo / project | kebab-case | `sinar-automotif`, `drape-by-mims` |
| App dirs | `apps/<name>` | `apps/web` |
| Service dir | `services/<name>-service` | `services/order-service` |
| Service (serverless) | `wedding-card-invitation-web-<name>-service` | `bgam-order-service` |
| Python module | `<name>_module` | `core_module`, `order_module` |
| Shared layer dir | `layers/shared-layers/wedding-card-invitation-web-common-layer` | `sinar-common-layer` |
| Layer package | `wedding-card-invitation-web_common` | `sinar_common` |
| Layer ARN env | `WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN` | `SINAR_COMMON_LAYER_ARN` |
| Handler files | `handler.py` / `public_handler.py` / `auth_handler.py` | — |
| Lambda functions | `{name}Handler` / `publicHandler` / `authHandler` | — |
| DB instance | `wedding-card-invitation-web-{stage}-pg` | `sinar-dev-pg` |
| DB secret | `wedding-card-invitation-web-{stage}-db-credentials` | `sinar-dev-db-credentials` |
| S3 buckets | `wedding-card-invitation-web-{stage}-<suffix>` | `bgam-dev-assets` |
| Terraform resources | `wedding-card-invitation-web-{stage}-*`, tags `Project=wedding-card-invitation-web` | — |
| Migrations | `infra/terraform/migrations/NNN_*.sql` | `004_documents_roles.sql` |
| Branches | `dev` (integration), `main` (live), `improvement-{name}` | — |

## API contract (hard requirement)

Every Lambda returns the envelope — no exceptions:

```json
{ "success": true, "data": { ... }, "error": null, "meta": { "page": 1, "per_page": 20, "total": 137 } }
{ "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "Order not found" } }
```

- **Error codes**: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`,
  `CONFLICT`, `INTERNAL_ERROR`, `TIMEOUT`. Add domain-specific codes sparingly
  (`STOCK_CONFLICT`, `ORDERING_CLOSED`).
- Helpers live in the layer's `response.py` — use `success()`, `created()`, `paginated()`,
  `validation_error()`, … Never hand-build responses.
- All responses carry `Access-Control-Allow-*` headers.
- **Frontends read `data.data.field`.** The axios wrapper unwraps the outer `data`, so
  components use the inner object directly. Define the contract before wiring the frontend.
- CSV/raw endpoints are the documented exception (raw body + `\ufeff` BOM for Excel).

## Python (backend)

- Python 3.12, Serverless Framework v3 (use the **global** `serverless` CLI).
- `get_connection(secret_name=None)` — the default arg is mandatory.
- Parameterized SQL everywhere: `%(name)s` named params. Never f-string SQL with user input.
- `RealDictCursor` for all reads.
- Sort/order fields via whitelist (`safe_sort`, `safe_order` in `validator.py`).
- Handler skeleton (canonical — copy from `templates/backend/service/`):
  top-level try/except → route dispatch on `httpMethod`+`path` → `get_connection` in
  try/finally → `close_connection` in `finally`.
- Public routes = no authorizer. Authenticated = `COGNITO_USER_POOLS`. Admin =
  role-gated in-app (never rely on API Gateway claims alone).
- Lint: flake8 `--max-line-length=120 --ignore=E501,W503`.

## TypeScript / frontend

- TypeScript strict. `@/*` import alias → `src/*`.
- Env vars: `NEXT_PUBLIC_*` / `VITE_*` / `EXPO_PUBLIC_*` — **no real values as fallbacks
  in source**. Missing env should fail loudly or use a mock layer, not silently point at
  prod (pain point #16).
- State: Zustand stores in `stores/{domain}Store.ts`; API calls in `services/{domain}.ts`.
- Axios wrapper unwraps `data` and handles 401 → clear tokens → redirect to sign-in
  (deduplicated refresh interceptor for Cognito).
- Static export pages: no `cache: 'no-store'`; use `fetchRetry` (6 attempts, backoff) for
  build-time fetches; `{...fallback, ...data}` so pages never crash on empty content.
- Lint/format: ESLint 9 flat config + Prettier (single quotes, 80 cols).
- Verify: `tsc --noEmit` + `next build` / `vite build` clean before commit.

## Terraform / infra

- Files split by resource: `main.tf`, `variables.tf`, `database.tf`, `cognito.tf`,
  `storage.tf`, `iam.tf`, `outputs.tf`.
- API Gateway is owned by **Serverless Framework, never Terraform**.
- `terraform plan` must show **0 to destroy** before apply. Stale state → backup as
  `*.stale-backup`.
- RDS: public, no VPC, `db.t4g.micro`, 20GB gp3, deletion protection on prod,
  `skip_final_snapshot = stage != prod`.
- Secrets Manager for all credentials; `random_password` for DB password.
- S3: private + versioning + full public-access block. Assets served via CloudFront OAC.
- Idempotent numbered migrations, applied **before** deploying dependent code.

## Env vars (canonical block — from `.env.example`)

```
# Deploy-time (serverless / scripts)
GETDB_CONNECTION=wedding-card-invitation-web-{stage}-db-credentials
COGNITO_USER_POOL_ID=...
COGNITO_APP_CLIENT_ID=...
COGNITO_DOMAIN=...
COGNITO_USER_POOL_ARN=...
ASSETS_BUCKET=wedding-card-invitation-web-{stage}-assets
ASSETS_CDN_URL=https://<cdn-domain>
SES_SOURCE=no-reply@<domain>
ADMIN_NOTIFY_EMAIL=admin@<domain>
FRONTEND_URL=https://<app-domain>
SENDER_NAME=...  SENDER_PHONE=...  SENDER_ADDRESS=...
WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN=arn:aws:lambda:...:layer:wedding-card-invitation-web-common:N

# Build-time (frontend)
NEXT_PUBLIC_API_BASE_URL=https://<api-gw>/<stage>
NEXT_PUBLIC_SITE_URL=https://<app-domain>
```

- `.env.example` is committed (placeholders). `.env.local` / real `.env` never.
- Scripts read Secrets Manager at runtime, never hardcoded credentials.

## Git / commits

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Small, reviewable commits (see `docs/git-workflow.md`).
