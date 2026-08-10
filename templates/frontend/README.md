# Frontend Templates — Quickstart

Three proven frontend patterns, chosen by project nature. See `../docs/architecture.md`
(§ Frontend conventions) for the full rules. This file is the how-to-start checklist.

## A. Next.js static export (storefronts, catalogs, content sites)

```bash
npx create-next-app@latest apps/web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Then in `apps/web/next.config.ts`:

```ts
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '*.cloudfront.net' }],
  },
};
export default nextConfig;
```

**Non-negotiables (static export):**
- Read content at build time via fetch to the public API — no `cache: 'no-store'`
  (silently skipped; fallback data renders instead).
- `fetchRetry` helper (6 attempts, backoff) around build-time fetches — a transient blip
  otherwise bakes a permanent error page.
- Filters/categories client-side: a client component fetches live; server components bake
  the unfiltered list.
- Fallback pattern: `{ ...fallback, ...data }` — never crash on empty API/CMS.
- Images: `unoptimized: true`; resize at upload time (Pillow in Lambda → thumb/full →
  S3 → CloudFront), not via `next/image`.
- SEO: `metadata` per page, `sitemap.ts`, `robots.ts`; JSON-LD for Organization/Product.

Verify: `tsc --noEmit && next build` clean.

## B. Vite SPA (web dashboards, interactive apps)

```bash
npm create vite@latest apps/web -- --template vue-ts   # or react-ts
```

- Pinia (Vue) / Zustand (React) stores in `src/stores/{domain}Store.ts`.
- Axios wrapper in `src/services/api.ts` that unwraps `data` and handles 401 →
  clear tokens → redirect to sign-in.
- **Mock-first**: `src/lib/mock.ts` vs `src/lib/real.ts`, switched by `VITE_USE_MOCK` —
  lets the frontend develop before the backend exists (BGAM pattern).
- `VITE_API_BASE_URL` env (mandatory — no real fallbacks in source).
- Amplify rewrites SPA routes to `index.html` via `customRules` (see root `amplify.yml`).

Verify: `vue-tsc --noEmit && vite build` (or `tsc && vite build`) clean.

## C. React Native / Expo (mobile apps)

```bash
npx create-expo-app@latest mobile
```

- expo-router route groups: `(auth)`, `(main)`, per-feature groups.
- Zustand stores; `EXPO_PUBLIC_*` env (with documented fallbacks only in a
  `config.ts`, never secrets).
- One axios instance per service with shared Bearer header + **deduplicated** 401-refresh
  interceptor (Cognito `InitiateAuth` refresh; logout on refresh failure).
- Build-verify: `npx expo export --platform android` (and/or iOS) before committing.

## Env wiring (all patterns)

```
NEXT_PUBLIC_API_BASE_URL=https://<api-gw>/<stage>
NEXT_PUBLIC_SITE_URL=https://<app-domain>
```

Root `package.json` exposes `dev:web` / `build:web` / `lint:web` / `preview:web` via
`npm --workspace apps/web run …`; Amplify runs the root build (see root `amplify.yml`).

## After scaffolding

1. Pick a design language — load `@skill design-style`, copy the chosen
   `skills/design-system/<slug>/` into the project's agent skills dir.
2. Wire auth per `../docs/architecture.md` (§ Auth).
3. Add the verification suite from `scripts/test-flow.sh` and a browser smoke pass before
   the first release.
