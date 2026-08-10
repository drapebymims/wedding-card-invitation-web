# Reference Map — What Each Project Demonstrates

This foundation was synthesized from four live projects. When you need a real, working
example of a pattern, consult the project that demonstrates it best. Keep this map updated
as the projects evolve (rule 9 in AGENTS.md).

| Pattern | Best reference | Where |
|---|---|---|
| Monorepo skeleton (apps/services/layers/infra/scripts/docs) | all four | repo root |
| **Most evolved template revision** | sinar-automotif | whole repo |
| Next.js **static export** storefront | drape-by-mims / sinar-automotif | `apps/web/` |
| Vue 3 + Vite SPA + **mock-first** frontend | BGAM | `apps/web/` (`VITE_USE_MOCK`) |
| React Native / Expo mobile app | Bees | `mobile/`, `web-portal/` |
| Shared Lambda layer (6 modules) | sinar-automotif (most evolved) | `layers/shared-layers/sinar-common-layer/python/python/sinar_common/` |
| Thread-local connection caching | sinar-automotif | `.../connection.py` |
| Validator (require_params / pagination / safe_sort) | sinar-automotif | `.../validator.py` |
| Service with public + auth + admin handlers | sinar-automotif | `services/core-service/core_module/` |
| Fully implemented e2e `test-flow.sh` | BGAM | `scripts/test-flow.sh` |
| Seed script (local/live via Secrets Manager) | BGAM | `scripts/seed_menu.py` |
| Amplify build poller | sinar-automotif | `scripts/wait-amplify.sh` |
| Terraform: RDS + Cognito + S3 + IAM | BGAM (has cognito.tf) | `infra/terraform/` |
| Terraform: S3 + **CloudFront OAC** + dual-region alias | sinar-automotif | `infra/terraform/storage.tf` |
| Idempotent numbered migrations | all four | `infra/terraform/migrations/NNN_*.sql` |
| GitHub Actions CI/CD (OIDC, path-filter matrix) | Bees | `.github/workflows/` |
| Agent playbook (AGENTS.md) | sinar-automotif (best) | root `AGENTS.md` |
| Agent workflow skills (plan-first, todo, test…) | Bees | `.opencode/skills/bees-*` |
| External skills lock/pinning | Bees | `skills-lock.json` |
| Sanity CMS + studio structure + seed/backfill scripts | drape-by-mims | `studio/`, `scripts/seed_cms_from_sanity.py`, `backfill_images_to_s3.py` |
| Master implementation reference doc | drape-by-mims | `CODEX_REFERENCE_V1.md` (V1-era — historical) |
| Root `amplify.yml` monorepo spec | all four | root `amplify.yml` |
| Admin "trigger rebuild" endpoint (static-export workaround) | drape-by-mims | `services/order-service` → Amplify `start_job` |

## Project lineage (read before copying anything)

- **drape-by-mims** — oldest sibling. Next.js + Serverless + RDS + Sanity CMS. Started as a
  simple V1 (per `CODEX_REFERENCE_V1.md`) and evolved into a full ecommerce system
  (cart/checkout, Cognito + Google SSO, admin dashboard, ToyyibPay, shipping). Home of the
  original `docs/project-bootstrap/architecture.md` + `sop.md` that this foundation is
  based on. Sanity has been retired from runtime and replaced by a self-hosted CMS.
- **Bees** — most divergent. React Native kids learning app with **10 microservices**,
  GitHub Actions CI/CD, `bees_common` layer + `subscription.py`, skills-lock.json, 11 local
  `bees-*` agent skills. Region `ap-southeast-1` in infra (AGENTS.md says `ap-southeast-5`
  — the region inconsistency is a known debt). Also has stray root dirs (`idea to start`,
  `research on learning`, dead `src/`) — don't replicate.
- **BGAM** — cleanest small template. Vue/Vite SPA + single `order-service` + workspaces +
  fully-implemented `test-flow.sh` + mock-first frontend. Single `main` branch.
- **sinar-automotif** — the evolved revision. Next.js 16 static export, `core-service`
  with public/auth/core handlers, thread-local connection caching, validator +
  pagination helpers, CloudFront OAC, `dev`/`main` + `improvement-*` flow, best AGENTS.md.

## Known debt in the siblings (do NOT copy)

| Debt | Where | This foundation's stance |
|---|---|---|
| Committed live DB password in a script | drape-by-mims `scripts/seed_cms_from_sanity.py` | Secrets Manager at runtime only (pain point #13) |
| Orphan committed scaffold dir | drape-by-mims `studio-drapebymims/` | Delete; don't commit scratch |
| Hardcoded API URLs / Cognito IDs in frontend fallbacks | drape-by-mims `lib/api.ts` | Env vars mandatory (pain point #16) |
| Committed binary wheels (31MB) breaking `git push` | sinar / drapeby layers | Gitignore vendored `python/`; install in CI (pain point #19) |
| Session transcripts committed | sinar `newsinarproject.md`, `out.txt` | Gitignore; keep repo clean (pain point #24) |
| Region inconsistency (`ap-southeast-5` vs `-1`) | Bees AGENTS.md vs infra | Pick one region per project, document it |
| ESLint ignores TS yet CI lints TS | Bees | Lint what CI lints |
| Env var name mismatch (`DB_SECRET_NAME` vs `GETDB_CONNECTION`) | BGAM | One canonical block in `.env.example` |
| Stub `test-flow.sh` | sinar | Ship the implemented version (BGAM's) |
| Reusing another project's Cognito pool | sinar (deferred phase 3) | Template always includes `cognito.tf` |

## How to keep this repo alive

Every live project will hit something this repo doesn't cover yet. The loop:

1. Hit a new trap → add a row to `docs/pain-points.md` (+ prevention).
2. Find a better pattern → update `templates/` and `docs/architecture.md`.
3. Discover a new reference → add a row above and a note in `skills/` README.
4. Review this file when starting a new project — it's the fastest way to re-absorb
   everything we already learned.
