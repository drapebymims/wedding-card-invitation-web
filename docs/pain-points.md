# Pain Points — Every Trap We've Hit (and How to Avoid It)

The distilled tribal knowledge from Bees, drape-by-mims, BGAM, and sinar-automotif.
**Read this before starting any project, and before every deploy.** When a new trap
surfaces in a live project, add a row here (rule 9 in AGENTS.md).

## The table

| # | Pain point | Prevention |
|---|---|---|
| 1 | `get_connection()` takes 0 positional args but handlers pass one | Define `get_connection(secret_name=None)` from day one |
| 2 | Lambda 250MB limit exceeded | Prune old layer versions (`serverless-prune-plugin`, delete old `python-requirements` layers) |
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
| 14 | External service missing from layer (`No module named 'requests'`) | Install ALL runtime deps (requests, Pillow…) into the layer |
| 15 | `max_connections` exhaustion under load | Thread-local connection caching in `connection.py` |
| 16 | Hardcoded API URLs/domain/Cognito IDs in frontend source | Env vars are mandatory; no real fallbacks in code |
| 17 | Lambda timeout on cold start w/ heavy deps | Keep layer lean; Prune plugin; consider warmers only if needed |
| 18 | Amplify build failures silently bake error pages | Debug the exact build locally first (`npm run build:web`); never guess — paste full logs |
| 19 | Committed binary wheels bloat repo / `git push` hangs | Gitignore vendored layer `python/`; install in CI/pre-deploy |
| 20 | `npx serverless` resolves the wrong version | Use the global `serverless` CLI (v3) — document the version |
| 21 | SPA route 404 on refresh (Amplify) | `customRules` rewrite non-asset paths → `/index.html` (status 200) |
| 22 | CORS blocks the browser from reading 401/403 | `apiGateway.gatewayResponses` for `UNAUTHORIZED`/`ACCESS_DENIED`/`DEFAULT_4XX` |
| 23 | CloudFront serves stale content after deploy | Invalidate the distribution or confirm the new ETag is served (`s-maxage=31536000`) |
| 24 | Session transcripts / scratch files committed to the repo | Gitignore them (`out.txt`, `newsinarproject.md`-style); keep the repo clean |
| 25 | `update-user-pool-client` silently resets `ExplicitAuthFlows` | Re-pass `--explicit-auth-flows` (ALLOW_USER_PASSWORD_AUTH, ALLOW_USER_SRP_AUTH, ALLOW_REFRESH_TOKEN_AUTH) on every client update — the default set lacks USER_PASSWORD_AUTH and API password login breaks |
| 26 | Amplify build "succeeds" but errors `Artifact directory doesn't exist` | In the `applications:` multi-app format, phases MUST use `commands:` sub-keys (`build: commands: [npm run ...]`) — bare-list phases are silently ignored and NO command runs |
| 27 | SPA deep links 404 (301 → 404) on CLI-created Amplify apps | Set the rewrite at the APP level: `aws amplify update-app --custom-rules` with the regex non-asset → `/index.html` (status 200) — build-spec `customRules` don't take effect on CLI-created apps |
| 28 | Admin calls fail in the browser with axios `Network Error` (server returns 200 via curl) | API Gateway's Cognito authorizer rejects the **AccessToken** with a bare 401 that lacks `Access-Control-Allow-Origin` — browsers surface that as CORS/"Network Error". Send the **IdToken** in the `Authorization` header (the proven sibling pattern) |

## Why this file exists

Every row above cost real debugging time in a live project. The template repo itself
(`templates/`, `docs/sop.md`) already encodes most preventions — this table is the
human-readable index of *why* those rules exist. When you hit something new:

1. Fix it in the project.
2. Add a row here (symptom → prevention).
3. If the fix changes a template, update `templates/` too.

## Related

- `docs/sop.md` — the runbook that applies these preventions step by step.
- `docs/conventions.md` — the rules that avoid most of these traps by construction.
