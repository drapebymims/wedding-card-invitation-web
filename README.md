# Wedding Card Invitation Web

A **resellable digital wedding invitation platform**. One codebase + one backend,
many couples: each couple gets their own beautiful invitation site at
`/w/<slug>` by adding a single config file and rebuilding once.

Built from the foundation monorepo template: Next.js static export frontend,
Serverless Python backend, RDS Postgres, Cognito admin auth, Amplify hosting.

## The product model (how you sell it)

| Step | What you do |
|---|---|
| 1. Sell a couple an invitation site | — |
| 2. Add them | `scripts/add-couple.sh adam-eve` |
| 3. Fill in `apps/web/config/couples/adam-eve.json` | names, date, venue, gallery, theme… |
| 4. Deploy | commit + push → one Amplify build serves every couple |
| 5. Hand over | send them `https://yourdomain.com/w/adam-eve` + the admin login |

The backend is multi-tenant by `couple_slug` — **no backend changes per couple**.
Cost per couple is effectively zero (static files + a few DB rows).

## Features (per couple site)

- Envelope "Open Invitation" screen + optional confetti
- Hero with couple names, date, venue, tagline + photo
- Live countdown to the big day
- Story / timeline section
- Event cards (ceremony / reception) with map links, dress code, add-to-calendar (.ics)
- Photo gallery with lightbox
- RSVP form (attendance, guest count, dietary, message) → stored in the backend
- Guestbook wishes (submitted → moderated → shown)
- Gift registry (bank accounts + gift messages)
- Background music toggle
- WhatsApp / Telegram share + copy-link
- SEO metadata + Open Graph per couple
- Malay + English UI (config-driven per couple)
- **3 themes**: `refined` (classic luxury), `minimal` (modern clean), `vibrant` (tropical fun)

## Admin dashboard (`/admin`)

Platform-owner dashboard (Cognito sign-in): RSVP list with attendance filter + CSV
export, wish moderation (approve/delete), gift list, attendance stats.

## Architecture

```
apps/web                              Next.js 16 static export (output: 'export')
├── app/w/[slug]/page.tsx             per-couple page (generateStaticParams from config)
├── app/admin/page.tsx                client-only admin dashboard
├── app/couples/route.ts              build-time /couples.json manifest
├── config/couples/<slug>.json        THE per-couple source of truth
├── src/themes/{refined,minimal,vibrant}/   3 themes (CSS-variable tokenized)
└── src/components/wedding/           shared client components (RSVP, wishes, gallery…)
services/weddings-service             Serverless Python 3.12 — public + admin APIs
infra/terraform/migrations/           001_rsvps, 002_wishes, 003_gifts (tenant = couple_slug)
```

Live data (RSVP / wishes / gifts) flows: client component → `src/lib/api.ts` →
API Gateway → Lambda → Postgres. Everything else bakes at build time.

## Quick start (local dev)

```bash
# frontend (mock mode on by default — no backend needed)
cd apps/web && npm install && npm run dev
# open http://localhost:3000/w/adam-eve  (or /w/sarah-daniel, /w/maya-arif)

# backend tests
python -m pytest services/weddings-service/tests -q
```

## Deploy (see docs/sop.md for the full walkthrough)

1. **Backend**: migrations first (`infra/terraform/migrations/`), then layer deploy →
   bump `WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN` → `serverless deploy --stage dev`
   in `services/weddings-service/` with the `.env.example` block.
2. **Frontend**: wire Amplify (root `amplify.yml`, `appRoot: apps/web`), set
   `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_USE_MOCK=false` +
   Cognito vars. Push `dev` → poll `scripts/wait-amplify.sh <app-id> dev`.
3. **Add a couple**: `scripts/add-couple.sh <slug>` → fill config → rebuild.

## Reference docs

- `docs/IMPLEMENTATION_PLAN.md` — architecture + API contract for this project
- `docs/architecture.md`, `docs/conventions.md`, `docs/pain-points.md`, `docs/sop.md`
- `skills/design-system/` — vendored design languages (themes load `refined`/`minimal`/`vibrant`)
