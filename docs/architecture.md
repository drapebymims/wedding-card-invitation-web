# Architecture Blueprint — Canonical AWS Project Setup

The canonical starting architecture for a new AWS project. Synthesized from four
production projects: **drape-by-mims** (Next.js storefront + Serverless + RDS + Sanity),
**Bees** (mobile learning platform, 10 microservices + React Native + Vite + GitHub
Actions), **BGAM** (Vue/Vite F&B ordering app), and **sinar-automotif** (Next.js static
export, the most evolved revision). Start here; diverge only with a documented reason.

## System diagram (generic)

```
Client (Next.js static export  |  Vite SPA  |  React Native/Expo)
                        │
                        ▼
              Amplify / CloudFront  (frontend hosting)
                        │
                        ▼
                  API Gateway  (REST, /dev and /prod stages)
                        │
              ┌─────────┴──────────┐
              │  Lambda functions  │   ← Serverless Framework, Python 3.12
              │  (public / auth /  │
              │   admin handlers)  │
              └─────────┬──────────┘
                        │   shared Lambda layer
                        │   (wedding-card-invitation-web_common)
                        ▼
         ┌──────────────┼───────────────┐
         ▼              ▼               ▼
  RDS Postgres    S3 buckets       AWS SES / SNS / external APIs
  (Secrets Mgr)   (assets + OAC +  (email, payments, AI gateway…)
                  CloudFront)
```

## Monorepo layout

```
<project>/
├── apps/
│   └── web/                  # Next.js static export (or Vite SPA)
├── services/
│   └── <name>-service/       # Serverless service: serverless.yml + package/
│       └── <name>_module/
│           ├── handler.py           # authenticated + admin routes
│           ├── public_handler.py    # unauthenticated routes (public data, webhooks)
│           └── auth_handler.py      # Cognito login/signup/SSO
├── layers/
│   └── shared-layers/
│       └── wedding-card-invitation-web-common-layer/
│           ├── serverless.yml
│           └── python/
│               └── python/          # ← NESTED (critical for Lambda imports)
│                   └── wedding-card-invitation-web_common/
│                       ├── __init__.py      # re-export everything
│                       ├── response.py      # success/created/paginated/error helpers
│                       ├── connection.py    # get_connection(secret_name=None), thread-local
│                       ├── serializer.py    # JSONEncoder (datetime/Decimal)
│                       ├── validator.py     # require_params, pagination, safe_sort/order
│                       ├── auth.py          # Cognito JWT verify, get_user_sub/groups/role
│                       └── logger.py        # get_logger
├── infra/
│   └── terraform/
│       ├── main.tf, variables.tf, terraform.tfvars.<stage>
│       ├── database.tf      # RDS Postgres + Secrets Manager + SG (public, 5432)
│       ├── cognito.tf       # user pool + client + domain (+ optional Google IdP)
│       ├── storage.tf       # private S3 (assets + OAC + CloudFront)
│       ├── iam.tf           # Amplify service role
│       ├── outputs.tf
│       └── migrations/      # numbered SQL: 001_*, 002_* ...
├── docs/
│   ├── architecture.md      # this file (copy per project)
│   ├── sop.md               # the runbook
│   ├── ROADMAP.md / IMPROVEMENT_PLAN.md
│   └── (plans, UAT checklists)
├── scripts/
│   ├── seed.py              # data seeding (local|live via Secrets Manager)
│   ├── test-flow.sh         # end-to-end API verification suite
│   └── wait-amplify.sh      # poll an Amplify build
├── amplify.yml              # frontend build spec (appRoot: apps/web)
├── package.json             # root workspace scripts (dev/build/lint/test)
├── .env.example             # canonical env block (placeholders only)
└── README.md                # env vars, URLs, how-to-run
```

## Backend conventions (Python + Serverless)

**serverless.yml** essentials:
- `frameworkVersion: '3'` (global `serverless` CLI — npx may resolve the wrong version),
  `runtime: python3.12`, region per project, `stage: ${opt:stage, 'dev'}`
- `serverless-prune-plugin` (keep last 2 versions) — the Lambda 250MB limit is real
- CORS via `apiGateway.gatewayResponses` for `UNAUTHORIZED`/`ACCESS_DENIED`/`DEFAULT_4XX`
  — critical so the browser can read 401/403 and the frontend can auto-redirect to sign-in
- IAM: `secretsmanager:GetSecretValue`, `cognito-idp:AdminConfirmSignUp`,
  `s3:Put/Get/DeleteObject` on project buckets, `ses:SendEmail/SendRawEmail`
- `environment:` sourced from `${env:...}` with safe defaults (`${env:VAR, 'default'}`)
- Functions: one per handler file; public/guest routes exposed **without** an authorizer,
  everything else behind `COGNITO_USER_POOLS` (with role gate in-app)

**Shared layer** (`wedding-card-invitation-web_common`) — the 6 modules are battle-tested; copy, don't rewrite:
- `response.py`: `success(data, meta=None)`, `created`, `paginated(data, page, per_page,
  total)`, `validation_error`, `not_found`, `unauthorized`, `forbidden`, `conflict`,
  `internal_error`, `timeout`. Always include `Access-Control-Allow-*` headers.
- `connection.py`: `get_connection(secret_name=None)` (default-arg from day one) → reads
  `GETDB_CONNECTION` env → fetches JSON secret from Secrets Manager → `psycopg2.connect`.
  Cache connections **thread-local** (sinar fix for `max_connections` exhaustion).
  `get_cursor` uses `RealDictCursor`. `close_connection`.
- `serializer.py`: `FMSJSONEncoder` handling `datetime/date` → ISO, `Decimal` → float,
  `bytes` → utf-8.
- `validator.py`: `require_params`, `parse_int`, `parse_pagination`, `safe_sort`,
  `safe_order` (whitelist-based — prevents injection).
- `auth.py`: Cognito JWT verification against the pool's JWKS (`jose`) — verify even when
  API Gateway already validated the token (it only checks claims; a second source of
  truth), `get_user_sub`, `get_user_groups`, `get_user_role` (from `cognito:groups`).
- `logger.py`: one handler, INFO level, consistent format.

**Handler pattern** — every Lambda:
1. Parse `httpMethod`, `path`, `queryStringParameters`, `body` (JSON-safe try/except —
   webhooks may be form-urlencoded).
2. Branch on path/method to a per-feature function.
3. `conn = get_connection(); cursor = get_cursor(conn)` inside try/finally;
   `close_connection(conn, cursor)` in `finally`.
4. Return the envelope helpers; wrap everything in a top-level `try/except` →
   `logger.exception` + `internal_error()`.

**Database access**: credentials ONLY via Secrets Manager at runtime. Never hardcode.
Parameterized queries (`%(name)s`) — never f-string SQL with user input. Sort fields in a
whitelist. JSONB for flexible fields.

## Data model conventions

- Numbered migrations: `infra/terraform/migrations/NNN_*.sql` (`001_`, `002_`, …).
- Idempotent: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`,
  `ON CONFLICT DO UPDATE` / `DO NOTHING`. Index naming `idx_<table>_<col>`.
- Core tables: `users`, plus per-domain tables. JSONB for flexible fields.
- Apply order: run migrations against the DB **before** deploying the Lambda code that
  queries the new columns.

## Frontend conventions

**Next.js static export** (drape-by-mims / sinar pattern):
- `next.config.ts`: `output: 'export'`, `trailingSlash: true`, `images.unoptimized: true` +
  `remotePatterns` for `*.cloudfront.net` (and `cdn.sanity.io` if CMS images remain).
- Read content at build time via fetch to the public API. **No `cache: 'no-store'`** on
  static-export pages (silently skipped → fallback data renders). Use a `fetchRetry`
  helper (6 attempts, backoff) for build-time fetches.
- Filters/categories **must be client-side** — a server component bakes the unfiltered list.
- Fallback-content pattern: `{...fallback, ...data}` — the site must never crash when the
  API/CMS is empty.
- Images: resize at upload time (Pillow in Lambda → `thumb`/`full` → S3 → CloudFront), not
  via `next/image`.

**Vite SPA** (BGAM pattern): Vue 3 + Vite + TS + Tailwind, Pinia stores, axios wrapper
that unwraps `data`, `VITE_API_BASE_URL` env, **mock-first** (`lib/mock.ts` vs `lib/real.ts`
switched by `VITE_USE_MOCK`). Amplify `customRules` rewrite SPA routes to `index.html`.

**React Native/Expo** (Bees pattern): expo-router groups (`(auth)`, `(main)`), Zustand
stores, one axios instance per service with a shared Bearer header + deduplicated
401-refresh interceptor (Cognito refresh via InitiateAuth; logout on refresh failure).

## API contract

All lambdas return the envelope. This is a hard contract — define it before building:

```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": { "page": 1, "per_page": 20, "total": 137 }
}
```

- Errors: `{"success": false, "data": null, "error": {"code": "...", "message": "..."}}`
- Error code vocabulary: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`,
  `CONFLICT`, `INTERNAL_ERROR`, `TIMEOUT` (+ domain-specific codes like `STOCK_CONFLICT`).
- **Frontends read `data.data.field`** — the axios interceptor unwraps the outer `data`,
  so components use the inner object.

## Auth (Cognito)

- Terraform: user pool + app client + domain (`wedding-card-invitation-web-auth-<project>-<stage>`), optional
  Google IdP. Email/password + SSO; role via `cognito:groups` or a custom attribute.
- Callback URLs must include BOTH local dev (`http://localhost:3000/auth/callback`) and
  deployed URLs (Amplify dev + prod).
- Frontend: `login/signup/forgotPassword/confirmForgotPassword` hit the auth Lambda;
  Google SSO via hosted-UI implicit flow → `/auth/callback` reads tokens from the URL
  fragment. Store tokens in localStorage (`wedding-card-invitation-web-auth-tokens`); on any 401, clear tokens,
  set an "expired" flag, redirect to sign-in.

## Storage

- User uploads/receipts: private S3, presigned PUT (`generate_presigned_url`), store the
  public URL in DB.
- Static assets (images, QR codes): **private** S3 + CloudFront Origin Access Control +
  bucket policy (`s3:GetObject`, `AWS:SourceArn` condition) + `CachingOptimized` cache
  policy. Bucket stays private; CloudFront serves content.
- CloudFront caches aggressively (`s-maxage=31536000`) — invalidate after deploys that
  must appear immediately.

## Deploy (two tracks)

1. **Backend**: shared layer first (bump ARN), then each service with the new layer ARN
   and the full env block from `.env.example`. From the service dir:
   `serverless deploy --stage dev`. Confirm `https://<api-gw>/<stage>/` → `{"success": true}`.
2. **Frontend**: `amplify.yml` at repo root with `appRoot: apps/web`, build
   `npm run build:web`, artifact `out`/`dist`. Amplify auto-builds on push to the
   connected branches (`dev`, `main`). Poll with `scripts/wait-amplify.sh`.

## Verification suite

- `scripts/test-flow.sh`: admin login → public data → admin flow → status lifecycle.
  Target: all green after every backend deploy.
- Browser smoke: all public routes 200, no `pageerror`.
- Before shipping: `tsc --noEmit`, `next lint` (or eslint), `next build` (or `vite build`)
  all clean. Never commit a broken bundle.

## Design decisions worth documenting per project

- **Static export means admin edits require a rebuild.** Accept it, or add an admin
  "deploy" endpoint that triggers an Amplify `start_job` (drape-by-mims does this). If the
  content changes often, prefer a Vite SPA or client-side data fetching.
- **Publicly accessible RDS, no VPC** — deliberately cheap and simple; Lambda connects
  directly. Revisit only when compliance requires a VPC.
- **API Gateway is owned by Serverless Framework, never Terraform.**
- **Mock-first frontends** (BGAM) let the frontend develop before the backend exists.
