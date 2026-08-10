# Foundation — Agent Guide

Working playbook for agents operating in this repo and in any project scaffolded from it.
Short on purpose — only the essentials that were repeatedly re-derived and caused real
friction. Derived projects should copy this and add their own specifics (stack, services,
gotchas).

## This project — wedding-card-invitation-web (resellable wedding invitation platform)

- **Product model**: ONE codebase + ONE backend, many couples. Each couple = one config
  file `apps/web/config/couples/<slug>.json` + a unique URL `/w/<slug>`. New couple =
  `scripts/add-couple.sh <slug>` → fill config → rebuild frontend. Backend needs no change
  (multi-tenant by `couple_slug`).
- **Themes**: 3 visual languages in `apps/web/src/themes/{refined,minimal,vibrant}/`,
  picked per config via `theme`. Theme root is a client component owning opening
  animation / music / confetti; it composes shared headless components from
  `apps/web/src/components/wedding/` (contracts in `.../wedding/props.ts`). Themes style
  themselves through CSS custom properties (see `apps/web/src/app/globals.css`) — never
  edit globals.css from a theme.
- **Languages**: configs and UI are bilingual (Malay + English) — UI strings in
  `apps/web/src/lib/i18n.ts` via `t(key, lang)`; couple-authored content in the config.
- **Live data** (RSVP, wishes, gifts) is client-side via `apps/web/src/lib/api.ts`
  (mock-first: `NEXT_PUBLIC_USE_MOCK=true` until the backend deploys). Everything else
  bakes at build time.
- **Admin**: `/admin` (client-only) — platform owner manages all couples: RSVP list +
  CSV, wish moderation, gift list. Signs in via Cognito `USER_PASSWORD_AUTH` directly from
  the browser and sends the **IdToken** as Bearer (pain point #28).
- **Couple manifest**: `apps/web/src/app/couples/route.ts` emits `/couples.json` at build
  time (slug list for the admin couple picker).


## Architecture (30-second map)

- **Backend**: Serverless Framework (Python 3.12) in `services/<name>-service/`. Shared
  Lambda layer in `layers/shared-layers/wedding-card-invitation-web-common-layer/python/python/wedding-card-invitation-web_common/`
  (note the **nested** `python/python` — critical for Lambda import resolution).
- **DB**: RDS Postgres 16 (`db.t4g.micro`, publicly accessible, no VPC). Credentials only
  via Secrets Manager at runtime — **never hardcode** (see the committed-secret pain point).
- **Frontend**: `apps/web/` — Next.js static export (`output: 'export'`) or Vite SPA, hosted
  on Amplify via root `amplify.yml` (`appRoot: apps/web`).
- **Deploy**: backend via `serverless deploy --stage dev` (layer first → bump ARN → redeploy
  services); frontend auto-builds on push to `dev`/`main` via Amplify.

## Static export → content bakes at build time

If the project uses Next.js static export, these consequences are permanent:

- **New/changed data doesn't appear until a rebuild.** After seeding or editing, push a
  rebuild commit — Amplify regenerates the static pages.
- **Filters must be client-side.** A server component bakes the unfiltered list; filtering
  must live in a client component that fetches live.
- **Build-time API fetches need retries.** A transient API blip during `next build` bakes a
  permanent error page. Use a `fetchRetry` helper (6 attempts, backoff) in `lib/api.ts`.
- **CloudFront caches aggressively** (`s-maxage=31536000`). After deploys, fixes may not
  appear until you invalidate the distribution or confirm a new build's ETag is served.
- **No `cache: 'no-store'` on static pages** — it's silently skipped and fallback data
  renders instead.

## Rules for agents working here

1. **Plan first (hard gate).** For any multi-file change (2+ files) or anything risky: load
   `@skill plan-first`, audit the current state, draft a plan, ask questions, get approval,
   then execute. Never jump into edits.
2. **Never run AI-generated code.** The Experience-Engine-style rule applies: if a feature
   lets AI produce executable content, that content is data, never code. Verify the pattern
   before building it.
3. **Follow the API contract.** All lambdas return `{success, data, error}` (see
   `docs/conventions.md`). Frontends read `data.data.field`. Error codes are part of the
   contract (`VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT`,
   `INTERNAL_ERROR`).
4. **Layer layout is sacred.** `layers/shared-layers/wedding-card-invitation-web-common-layer/python/python/`.
   Never strip `*.libs`; install Linux-only wheels (`manylinux2014_x86_64`).
5. **Migrations before code.** Apply `infra/terraform/migrations/NNN_*.sql` **before**
   deploying the Lambda code that queries the new columns. Keep them idempotent
   (`IF NOT EXISTS`, `ON CONFLICT`).
6. **Never touch Terraform state blindly.** `terraform plan` must show **0 to destroy**
   before apply (stale state can wipe the live DB). Back up stale state as `*.stale-backup`.
7. **Secrets.** No credentials, ARNs, account IDs, or live URLs in code or committed files.
   Use the env block from `.env.example` with placeholders. Scripts read Secrets Manager at
   runtime.
8. **Build-verify frontend changes.** For Next.js: `tsc --noEmit` + `next build` clean. For
   Vite: `vue-tsc --noEmit && vite build`. Never commit a broken bundle.
9. **Log learnings.** New pain points or patterns that surface belong back in this repo:
   add to `docs/pain-points.md` and update `docs/reference-map.md`. This repo only stays
   useful if it keeps absorbing the hard-won lessons.
10. **Design skills are vendored.** UI work should load a design language from
    `skills/design-system/` (per project nature) — don't invent a new look per task.

## Deploy workflow

- **Layer**: `layers/shared-layers/wedding-card-invitation-web-common-layer/` → `serverless deploy --stage dev`,
  note the new layer ARN, then redeploy every service with `WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN` set to it.
- **Service**: from `services/<name>-service/`, `serverless deploy --stage dev` with the env
  block from `.env.example` (GETDB_CONNECTION, COGNITO_*, buckets, SES, WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN).
  Use the **global `serverless`** CLI (v3) — `npx serverless` may resolve the wrong version.
- **Frontend**: commit → push `dev` → poll `scripts/wait-amplify.sh <app-id> dev` → verify on
  the dev URL.
- **Promotion**: merge `dev` → `main` only deliberately, after user sign-off. Never
  force-push to shared branches.

## Recurring gotchas (full table in docs/pain-points.md)

- `get_connection()` signature: define `get_connection(secret_name=None)` from day one.
- 502 after stack recreation → `terraform apply -target=...aws_lambda_permission...`.
- Module not found in layer → the nested `python/python/` structure.
- Frontend reads `data.field` but backend returns `success({data: ...})` → read
  `data.data.field` (define the contract first).
- `UPDATE_ROLLBACK_FAILED` → delete stack, empty S3, recreate — never continue a failed rollback.
