# Pain Points — Every Trap We've Hit (and How to Avoid It)

The distilled tribal knowledge from Bees, drape-by-mims, BGAM, sinar-automotif,
glass-house-event, wedding-card-invitation-web, iqbar-proton, papawan-garage,
mabellabs-web-app, and zahid-syuqri.
**Read this before starting any project, and before every deploy.** When a new trap
surfaces in a live project, add a row here (rule 9 in AGENTS.md).

## The table

| # | Pain point | Prevention |
|---|---|---|
| 1 | `get_connection()` takes 0 positional args but handlers pass one | Define `get_connection(secret_name=None)` from day one |
| 2 | Lambda 250MB limit exceeded | Prune old layer versions (`serverless-prune-plugin`, delete old `python-requirements` layers). Layers also set `retain: false` so superseded layer versions auto-delete |
| 3 | 502 Bad Gateway after stack recreation | `terraform apply -target=...aws_lambda_permission...` (or redeploy services) |
| 4 | Module not found in layer | Nested `python/python/{module}/` structure — never flatten |
| 5 | psycopg2 fails with missing `.so` files | Keep ALL `*.libs` — never strip |
| 6 | YAML corruption from regex | Never regex-edit `serverless.yml`; remove exact strings only |
| 7 | Frontend reads `data.field`, backend returns `success({data: …})` | Define API contract first; read `data.data.field` |
| 8 | Stuck `UPDATE_ROLLBACK_FAILED` | Delete stack, empty S3, recreate — never continue a failed rollback |
| 9 | Devs blocked by force-push | `improvement-{name}` branches; never push directly to shared `dev` |
| 10 | Terraform fails: Lambda doesn't exist | Wait for ALL CI/CD deploys before running Terraform |
| 11 | Stale Terraform state → destroys live DB | `terraform plan` must show 0 destroys; backup stale state as `*.stale-backup` |
| 12 | Static export renders fallback data | No `cache: 'no-store'` on static pages; fetch at build time |
| 13 | DB password hardcoded in scripts | Read Secrets Manager at runtime; never commit credentials |
| 14 | External service missing from layer (`No module named 'requests'`) | Install ALL runtime deps into the layer (requests, Pillow, **cryptography** for webhook sig-verify…) |
| 15 | `max_connections` exhaustion under load | Thread-local connection caching in `connection.py` |
| 16 | Hardcoded API URLs/domain/Cognito IDs in frontend source | Env vars are mandatory; no real fallbacks in code |
| 17 | Lambda timeout on cold start w/ heavy deps | Keep layer lean; Prune plugin; consider warmers only if needed |
| 18 | Amplify build failures silently bake error pages | Debug the exact build locally first (`npm run build:web`); never guess — paste full logs |
| 19 | Committed binary wheels bloat repo / `git push` hangs | Gitignore vendored layer `python/`; install in CI/pre-deploy |
| 20 | `npx serverless` resolves the wrong version | Use the global `serverless` CLI (v3) — document the version |
| 21 | SPA route 404 on refresh (Amplify) | `customRules` rewrite non-asset paths → `/index.html` (status 200) — **Vite only** |
| 22 | CORS blocks the browser from reading 401/403 | `apiGateway.gatewayResponses` for `UNAUTHORIZED`/`ACCESS_DENIED`/`DEFAULT_4XX` |
| 23 | CloudFront serves stale content after deploy | Invalidate the distribution or confirm the new ETag is served (`s-maxage=31536000`) |
| 24 | Session transcripts / scratch files committed to the repo | Gitignore them (`out.txt`, `newsinarproject.md`-style); keep the repo clean |
| 25 | `update-user-pool-client` silently resets `ExplicitAuthFlows` | Re-pass `--explicit-auth-flows` (ALLOW_USER_PASSWORD_AUTH, ALLOW_USER_SRP_AUTH, ALLOW_REFRESH_TOKEN_AUTH) on every client update — the default set lacks USER_PASSWORD_AUTH and API password login breaks |
| 26 | Amplify build "succeeds" but errors `Artifact directory doesn't exist` | In the `applications:` multi-app format, phases MUST use `commands:` sub-keys (`build: commands: [npm run ...]`) — bare-list phases are silently ignored and NO command runs |
| 27 | SPA deep links 404 (301 → 404) on CLI-created Amplify apps | Set the rewrite at the APP level: `aws amplify update-app --custom-rules` with the regex non-asset → `/index.html` (status 200) — build-spec `customRules` don't take effect on CLI-created apps |
| 28 | Admin calls fail in the browser with axios `Network Error` (server returns 200 via curl) | API Gateway's Cognito authorizer rejects the **AccessToken** with a bare 401 that lacks `Access-Control-Allow-Origin` — browsers surface that as CORS/"Network Error". Send the **IdToken** in the `Authorization` header (the proven sibling pattern) |
| 29 | Amplify `customRules` SPA rewrite makes EVERY route serve the home page on Next.js static export | `output: 'export'` + `trailingSlash` writes a real `index.html` per directory — the rewrite is wrong there. Only Vite SPAs get `customRules` (see #21); static-export `amplify.yml` must NOT include it (glass-house-event fix `c836974`) |
| 30 | `serverless deploy` fails: auto-generated IAM role name exceeds 64 chars for long project names | Set an explicit short `provider.iam.role.name` (e.g. `<repo>-<service>-${opt:stage}-role`) — the auto-generated one is `<service>-<stage>-<region>-lambdaRole` and overflows (wedding-card-invitation-web) |
| 31 | Client retried a POST → duplicate booking/RSVP/wish | **Retry GETs only**; POSTs are one-shot (or carry idempotency keys). A retried `POST` double-books — glass-house-event's `apiPost` never retries |
| 32 | psycopg2 adapts Python lists to Postgres `ARRAY` literals, not JSON | When writing JSONB from a Python list, `json.dumps(...)` FIRST — psycopg2 otherwise produces an array literal that corrupts the JSONB value (glass-house-event `_normalize_value`) |
| 33 | `terraform.tfvars` committed (real domain prefixes/emails) | Gitignore `*.tfvars` (keep `*.tfvars.example`); a committed tfvars leaks per-stage values (papawan `0e19eab`) |
| 34 | Webhook signature verification fails over re-encoded JSON | Verify over the **raw request body bytes** — `X-Signature` covers the exact bytes received (CHIP). Cache the gateway public key in-container; ship a `*_DISABLE_SIG_VERIFY=true` escape hatch for first-time setup (mabellabs) |
| 35 | Amplify DEPLOY step shows no file count + every file 404 | `app.buildSpec` is null (app created before the file existed) — fix with `aws amplify update-app --build-spec file://amplify.yml` (mabellabs) |
| 36 | Authorizer 401/403 still lack CORS even with `gatewayResponses` configured | Deploy log warns "unrecognized property" — the Serverless shorthand didn't apply. Fix with `aws apigateway put-gateway-response` using **lowercase** `gatewayresponse.header.*` keys, then `create-deployment`; verify `access-control-allow-origin` on the 401 body (mabellabs) |
| 37 | Amplify serves on the **branch-qualified** domain, not the bare one | CLI-created apps answer at `main.<appId>.amplifyapp.com` (not `<appId>.amplifyapp.com`) — use the branch URL for Cognito callbacks and `NEXT_PUBLIC_SITE_URL` (mabellabs) |
| 38 | Local seed fails: `No module named 'psycopg2._psycopg'` on macOS | The layer's **Linux** wheel can't import on a Mac — run seeds with `SEED_TARGET=local` + DB env + macOS `psycopg2-binary`; never `--target live` from a Mac (mabellabs). And `seed.py` must `sys.path.append` (not `insert`) the layer path so the layer wheel doesn't shadow the local one (glass-house-event) |
| 39 | Settings keys are a CONTRACT between frontend getters, admin panel, and seed | `siteSettings`/`shippingRates`/`orderSettings` key mismatch → 404 → null → prerender crash. Null-guard every getter and run `npm run build` against the live API before shipping (mabellabs) |
| 40 | Seed fails `UndefinedColumn` | Keep seed column lists in sync with `001_schema.sql` — seeds written before a migration drift silently (mabellabs) |
| 41 | Amplify app has no repo / confusion over needing a GitHub PAT | Terraform only creates the Amplify **IAM role** (`iam.tf`) — it never creates the app or links the repo. Link the repo via **Amplify console → Connect repository → GitHub OAuth** (Amplify's own GitHub app, authorized once per account → **no PAT, no extra credential**). A CLI-made app (`aws amplify create-app` without `--repository`) has no repo attached and there's no CLI to add one to an existing app — reconnect via the console, or create with `--repository <url> --access-token`. A **fine-grained** PAT works if it has BOTH **Contents: Read** and **Webhooks: Read and write** for the repo (missing either → `create-app`/build fails silently at clone or webhook). Don't ask the client for a token when console OAuth suffices (wander-nomad-my) |
| 42 | Admin auth gate falsely bounces a valid session on static export | `useSyncExternalStore(getServerSnapshot: ()=>false)` + a `useEffect(()=>{ if(!authed) redirect })` fires on the FIRST client render while `authed` is still the server snapshot (`false`), before React's re-check — kicks authenticated users straight back to login. Fix: `useState<boolean|null>(null)` + `useEffect(()=>setAuthed(isAuthenticated()))`, redirect only on `authed === false`, render a guard while `null`. Verified live via Playwright (login → `/admin/dashboard/` → `/admin/packages` 200) (wander-nomad-my) |
| 43 | Writes silently lost in production — inserts/updates "work" locally, nothing persists | The layer's `close_connection()` calls `connection.rollback()` in its `finally`; any write route that never commits loses everything when the connection closes/reuses. Lambda entry point must call `conn.commit()` for 2xx responses to POST/PUT/PATCH/DELETE; unit-test asserts FakeCursor `commits == 1` (salesmen-listing-template) |
| 44 | Flipping `VITE_USE_MOCK=false` breaks rendering — lists blank / lookups 404 | Mock seeds string ids (`'seller-1'`) while backend returns integers, and the `Api` interface types both as `string`, so TS can't catch it. Fix ONE id type at contract time and mirror it in the mock; add a mock-parity lint/test (salesmen-listing-template, travel-pelangi) |
| 45 | Image uploads fail silently — phone photos (5–10MB) die at the API Gateway 10MB payload cap, base64 inflates +33% | Compress client-side BEFORE upload: canvas-resize (max ~1800px dim, JPEG q0.85 → ~200–600KB) or presigned PUT direct-to-S3 (no base64 through the gateway at all) (drape-by-mims) |
| 46 | Payment-gateway webhook retry storm | Returning non-200 makes ToyyibPay/Meta redeliver forever. ALWAYS acknowledge 200 — even for rejected/failed verification — log-and-ignore instead (`{'status': 'ignored'}`) (drape-by-mims, ai-revenue-engine §7) |
| 47 | GitHub Actions OIDC assume-role fails for `workflow_dispatch` runs | The sub claim uses NUMERIC IDs: `repo:owner@OWNER_ID/repo@REPO_ID:ref:refs/heads/main`. Trust policies need `StringLike` with `repo:owner@*/repo@*:*`; diagnose by printing decoded JWT claims in a debug step (Bees) |
| 48 | Serverless deploy IAM fails in CI: deployment-bucket statements don't match | The serverless deployment bucket name truncates at S3's 63-char limit — IAM wildcard must be `<repo>-*-serverlessdeploymentbuck*` (missing the `e`). Also: give CI deploys a comprehensive UPFRONT IAM policy (lambda aliases/versions, CFN Describe*, iam GetRole, s3 tagging, events DescribeRule) — discovering gaps one-per-run costs 10+ iterations (Bees) |
| 49 | Managed IAM policy updates revert after infra rebuild | AWS managed/customer policies cap at 5 versions; rebuilding from an old snapshot silently reverts newer statements. Always build from the CURRENT default version document and delete old versions first (Bees) |
| 50 | Amplify build behaves oddly after preBuild | Build phases SHARE cwd — a `cd` in `preBuild` persists into `build`. Don't cd twice (Bees) |
| 51 | Serverless deploy in GitHub Actions hard-fails on empty env vars | Every `${env:VAR}` referenced by serverless.yml must be exported as a step env in the workflow (use `, ''` defaults); one missing secret kills the whole deploy. Also `gh auth refresh -s workflow` is needed to push workflow-file changes (Bees) |
| 52 | Cognito hosted-UI domain can't be recreated after account teardown | The `cognito_domain_prefix`/suffix is GLOBALLY unique — an account rebuild must pick a NEW suffix; the old one is unrecoverable cross-account (BGAM) |
| 53 | Deploy works with documented env names but service misbehaves / confuses setup | `.env.example` drifted from code: docs said `DB_SECRET_NAME`, code reads `GETDB_CONNECTION`. One canonical env block; `.env.example` is generated FROM the code's `${env:}` references, never hand-guessed (BGAM) |
| 54 | `npx serverless` resolves v4 even though nothing installed it (root cause of #20) | `serverless-prune-plugin` peer-installs a local `serverless@4` into `node_modules/`. Fix: global CLI binary, or `rm -rf node_modules/serverless` (BGAM) |
| 55 | RBAC/tenancy gate fails CLOSED after deploy — every non-admin gets 500/locked out | A gated handler queries a table/column its migration creates (`roles`, `orders`) — deploying code before the migration fails-closed for everyone. Migrations-before-code is LOAD-BEARING, not hygiene. Bootstrap escape hatch: `SUPERADMIN_EMAILS` env grants superadmin before any DB row exists (sinar-automotif, wedding-card-invitation-web) |
| 56 | Auth silently fails after account restore — credentials correct, every login 500s | Service authenticates against ANOTHER project's Cognito pool (deliberately kept during teardown); fresh account has no such pool. Template always includes `cognito.tf`; never reuse a sibling's user pool (sinar-automotif) |
| 57 | Gitignore for vendored wheels swallows the layer's OWN source — scaffold can't see its layer code | Generic `python/` ignore is wrong. Use inversion: `layers/**/python/python/*` + `!layers/**/python/python/*_common/` so wheels are ignored but the `_common` package source is tracked (papawan-garage) |
| 58 | Terraform plan/validate rejects config: "Variables not allowed" | HCL forbids `${...}` interpolation inside variable `description` strings — keep descriptions plain text (papawan-garage) |
| 59 | Pillow image normalization blackens product photos | Never bare `convert('RGB')` on RGBA/LA/P images — transparent areas turn black. Flatten onto a WHITE background first, scale-to-fit (no crop), center on white square canvas, overwrite in place so stored `image_url`s survive; make the backfill idempotent (mabellabs-web-app) |
| 60 | Hosted-UI redirect breaks after "harmless" URL tweak | Cognito callback URLs match EXACTLY, including trailing slash — `/admin/login/` ≠ `/admin/login`. Change both Terraform and the frontend together (wander-nomad-my) |
| 61 | Replaced logo serves stale cached version under the same filename | CloudFront/CDN caches by URL. Brand/content asset changes RENAME the file (`logo-v2.png`), never overwrite in place (wander-nomad-my, complements #23) |
| 62 | `*.tfvars.*` gitignore pattern doesn't do what was intended | Final form: ignore `*.tfvars` + negate `!terraform.tfvars.example` so the example stays versioned. Same intent, three different broken spellings existed across siblings (wander-nomad-my, papawan-garage) |
| 63 | Post-launch content pass blocked: CHECK constraint rejects new status values | Value sets evolve. Widen idempotently: `DROP CONSTRAINT IF EXISTS ... ; ADD CONSTRAINT ... CHECK (status IN (...))` in a numbered migration (travel-pelangi) |
| 64 | JS arithmetic/UI breaks on DB numbers — prices concatenate as strings | node-postgres returns NUMERIC as strings. Global fix at pool creation: `pg.types.setTypeParser(1700, parseFloat)` (anan-deco) |
| 65 | Login works in prod, silently fails on localhost (last commit: "fix: localhost admin login") | Browsers DROP `Secure` cookies over http. Derive cookie `secure` flag from `x-forwarded-proto`/request protocol; clearing must use the SAME flag used at set time (anan-deco) |
| 66 | Client-computed totals persisted to the DB — tampering client can create an order at RM0.01 | Money values computed in the browser and written to Firestore/DB are advisory only; rules validate types, not correctness. Server (webhook callback / Admin SDK) must RE-VERIFY amount against the bill/cart before marking paid (Mabellabs-website-main) |
| 67 | Foundation lessons vanish from derived repos over time | Derived repos EDIT rows in place (one replaced upstream rows 41–42, erasing them) or freeze on old snapshots (most sit at 28–40 rows). Rule: derived repos APPEND new rows at the end (43+, next free number), never rewrite; re-sync from foundation after big updates (salesmen-listing-template, ai-revenue-engine) |
| 68 | Scaffold renames produce broken artifacts: docs spell the Python module with a hyphen (`travel-pelangi_common` — invalid identifier), `.env.example` notes garbled by double substitution, stray empty dirs left behind | `scripts/scaffold-project.sh` placeholder replacement needs: hyphen→underscore conversion for module/package identifiers, single-pass token replacement, and misfire cleanup. Verify a scaffold by importing the layer module before first commit (travel-pelangi, ai-revenue-engine) |
| 69 | ToyyibPay integration surprises | Amounts are in SEN (cents); API is form-encoded (`requests.post(data=...)` NOT `json=`); `billName`/`billDescription` allow alphanumeric+space+underscore only; callbacks can't reach localhost (test against deployed stage/tunnel); hash scheme is MD5 (theirs, required); bills expire (`billExpiryDays`); no native recurring billing — track `subscription_end_date` manually (drape-by-mims, Bees, mabellabs) |
| 70 | Mobile store submission irreversibles | Android package names are PERMANENT/unreuseable; Apple "Made for Kids" designation is PERMANENT; Google Play personal accounts need a closed test with 12 opted-in testers for 14 consecutive days before production access; open AI chat + Kids category = high rejection risk — hide the chat (Bees) |
| 71 | Cloud architecture cost corrections (planning-stage estimates were wrong) | Aurora estimate was ~2× off ($45–55/mo real); Aurora needs PostgreSQL 16.3+ for pgvector AND auto-pause together; **RDS Proxy breaks Aurora auto-pause** (per-invocation connections forever); Cognito free tier is 10K MAU (not 50K, since Nov 2024); SES in ap-southeast-5 is API-only (no SMTP); VPC endpoints ~$15/mo each are unavoidable for private subnets; LLM-calling services must sit OUTSIDE the VPC (internet egress) (Bees) |

## Why this file exists

Every row above cost real debugging time in a live project. The template repo itself
(`templates/`, `docs/sop.md`) already encodes most preventions — this table is the
human-readable index of *why* those rules exist. When you hit something new:

1. Fix it in the project.
2. Add a row here (symptom → prevention).
3. If the fix changes a template, update `templates/` too.

## Keeping derived projects in sync

Derived projects copy this file at scaffold time and then drift. Rules of engagement:

1. **APPEND, never overwrite** (#67): when a derived project logs a new trap, add it at
   the NEXT FREE number — one sibling rewrote rows 41–42 in place and permanently erased
   two upstream lessons from its copy.
2. If you add rows here, re-sync the siblings that have their own copies
   (`scripts/share-skills.sh` pushes this file + the workflow skills), merging back any
   project-local rows they added. papawan-garage drifted behind rows 25–28, several
   siblings froze at old snapshot counts — check them after a big update (rule 9 in
   AGENTS.md).
3. Project-local rows promoted into this canonical table keep their content here;
   derived copies may then be safely refreshed from this file.

## Related

- `docs/sop.md` — the runbook that applies these preventions step by step.
- `docs/conventions.md` — the rules that avoid most of these traps by construction.
