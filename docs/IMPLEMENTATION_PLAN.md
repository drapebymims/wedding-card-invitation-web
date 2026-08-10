# Implementation Plan — Wedding Card Invitation Web

Resellable digital wedding invitation platform. One codebase, many couples:
each couple = one config file + a unique URL. 3 themes. Malay + English.

## Architecture

```
apps/web (Next.js 16 static export, Tailwind v4)
├── app/w/[slug]/page.tsx       per-couple page (generateStaticParams from config)
├── app/couples/route.ts        build-time manifest of couple slugs (for admin picker)
├── app/admin/page.tsx          client-only couple dashboard (Cognito login → RSVP/wishes/gifts)
├── app/page.tsx                platform landing + couple directory
├── config/couples/<slug>.json  THE per-couple source of truth
├── src/themes/{refined,minimal,vibrant}/   3 theme implementations
└── src/components/wedding/     shared headless client components (token-styled)

services/weddings-service       Serverless Python 3.12 — public RSVP/wishes/gifts + admin CRUD
infra/terraform/migrations/    001_rsvps.sql, 002_wishes.sql, 003_gifts.sql (tenant = couple_slug)
```

## Config → site flow

1. Copy `config/couples/_template.json` → `config/couples/<slug>.json`, fill it in
   (`scripts/add-couple.sh` automates this).
2. Rebuild — the page renders at `/w/<slug>` with the config's `theme`.
3. RSVP / wishes / gifts are LIVE (client components → API); everything else is baked.

## API contract (envelope `{success, data, error}` — see docs/conventions.md)

Public (no auth):
- `GET  /public/health`
- `POST /public/rsvps`   {coupleSlug, guestName, attendance, guestsCount, dietary?, phone?, message?}
- `GET  /public/wishes?coupleSlug=&page=&perPage=`  (approved only, paginated)
- `POST /public/wishes`  {coupleSlug, name, message}
- `GET  /public/gifts?coupleSlug=`  (approved only)
- `POST /public/gifts`   {coupleSlug, name, message, item?}

Admin (COGNITO_USER_POOLS authorizer, Bearer IdToken — never AccessToken):
- `GET  /admin/rsvps?coupleSlug=&page=&attendance=`
- `GET  /admin/rsvps/stats?coupleSlug=`   total / confirmed / declined / guests
- `GET  /admin/wishes?coupleSlug=&status=` (all/pending/approved)
- `PATCH /admin/wishes/{id}` {approved}
- `DELETE /admin/wishes/{id}`
- `GET  /admin/gifts?coupleSlug=`
- `DELETE /admin/gifts/{id}`

Error codes: VALIDATION_ERROR / NOT_FOUND / UNAUTHORIZED / FORBIDDEN / CONFLICT / INTERNAL_ERROR.

## Theme tokens

Each theme root sets CSS custom properties consumed by shared components:
`--c-primary --c-secondary --c-accent --c-bg --c-surface --c-text --c-muted
--font-display --font-body --radius --shadow` — scoped to the theme wrapper.

## Deploy model

- Frontend: one Amplify app; every couple is a path under it. Add couple → rebuild.
- Backend: one `weddings-service`, multi-tenant by `couple_slug`. Deploy once.
- Admin: platform owner manages all couples (v1 — no per-couple role scoping).

## Phases

1. ✅ Scaffold (done)
2. Contract: types, i18n, config loader, api client, sample configs, routing (this doc's author)
3. Parallel lanes: designer (3 themes + admin UI) · fixer-B (backend) · fixer-C (shared components)
4. Reconcile → build verify → scripts (`add-couple.sh`) → project docs
