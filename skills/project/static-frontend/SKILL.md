---
name: static-frontend
description: Frontend rules for foundation-derived projects — Next.js static export consequences, build-time data fetching, Vite SPA patterns, upload paths, and the hydration/auth-gate traps. Use when building or debugging apps/web, especially static export pages, filters, uploads, or admin gates. Trigger words: "static export", "next build", "fallback data", "filters not working", "Vite", "upload", "blank page".
---

# Static Frontend — Content Bakes at Build Time

## The permanent consequences

New/changed data appears ONLY after a rebuild — after seeding or content edits, push a
rebuild commit (or trigger the admin deploy endpoint). Filters/categories MUST be
client-side: a server component bakes the unfiltered list forever.

## Build-time fetching

- NO `cache: 'no-store'` on static pages — silently skipped; fallback data renders (#12).
- Use `fetchRetry` (6 attempts, backoff) in `lib/api.ts` — a transient blip during build
  bakes a PERMANENT error page.
- The fallback is SILENT and the build still reports SUCCEED (#77): a 5xx while prerendering
  swaps in mock/fixture content — or an empty shell for `[slug]` pages — and ships it to real
  traffic. Never deploy the BACKEND while a frontend build is running; grep the build log for
  the fallback warning (any hit = a page is fake), and verify page BODY (title, image count,
  byte size), never HTTP status, because an empty shell still answers 200.
- Fallback-content merge `{...fallback, ...data}` so empty API/CMS never crashes prerender;
  NULL-GUARD admin-settings getters (missing key → 404 → null → crash, #39).
- Metadata routes (`sitemap.ts`, `robots.ts`, JSON) need `export const dynamic =
  "force-static"` or static export breaks them silently.
- next.config.ts: `output:'export'`, `trailingSlash:true`, `images.unoptimized` +
  remotePatterns for `*.cloudfront.net`.
- Debug builds LOCALLY (`npm run build:web`) before pushing — never guess from CI logs (#18).

## Consuming the API

- Axios wrapper unwraps `data` ONCE — components read the inner object. LIST endpoints:
  read fields directly off the result (`res.bikes`), NOT another `.data` — the double-
  unwrap left admin lists blank once (papawan). Contract details: api-contract skill.
- RETRY GETs only, NEVER POSTs — a retried POST double-books orders/RSVPs (#31).
- Env vars mandatory (`NEXT_PUBLIC_*`/`VITE_*`) with NO real values as fallbacks (#16).
- node-postgres APIs return NUMERIC as JS strings — coerce on arrival or arithmetic
  concatenates prices (#64).

## Uploads

- API Gateway caps payloads at 10MB and base64 adds ~33% — phone photos die SILENTLY.
  Compress client-side (canvas, max ~1800px, JPEG q0.85 → 200–600KB) or presigned PUT
  direct to S3 (#45).
- SPA-preferred path: browser canvas resize (full+thumb) → one presign POST → direct
  PUTs to S3/CloudFront. Pillow-in-Lambda stays for build-time pipelines.
- Anything signed into the presign `Params` (`ContentType`, `CacheControl`) MUST be echoed by
  the browser as a request header or S3 rejects the PUT with a signature error — change both
  ends in one commit. Objects uploaded without `CacheControl` are re-downloaded by EVERY
  visitor on every visit (CloudFront caches them; the browser does not), which on a photo-heavy
  listing is seconds of blank cards on mobile. Keys are fresh UUIDs, so
  `public, max-age=31536000, immutable` is safe.

## Client-side filters & back navigation

The listing filters over a fully-baked list, so the filter is the ONLY state the user has —
and component state dies the moment they open a card. Two separate things have to be right
or "press back and the filter is gone" (#76):

- **Mirror the filter into the URL** (`?q=`) so back/forward, reload and shared links all
  survive. Write with `router.replace`, never `push` — one history entry per keystroke makes
  the back button useless; the listing keeps ONE entry holding the final query.
- **Adopt the URL after hydration**, not in `useState`'s initializer: the static export
  prerenders that markup with no query, so a first-render mismatch breaks hydration.
- **Back must not guess.** `history.state.idx` is null in current App Router versions and
  `document.referrer` never updates on client-side navigation, so inferring the destination
  silently sends everyone to `/`. Carry the listing URL on the card link (`?from=`) and follow
  it, validating it is an internal path (`startsWith("/") && !startsWith("//")`) so a shared
  link cannot smuggle a redirect. A deep link arrives with no `from` and correctly falls back
  to the full listing.

## Hosting matrix

- Static export amplify.yml must NOT contain the SPA `customRules` rewrite — every route
  would serve the home page (#29). The rewrite is Vite-only (#21/#27).
- Artifact dirs: `out` (Next export) / `dist` (Vite); blank site = missing
  `output:'export'` or wrong baseDirectory (#18/#26).
- CloudFront caches ~forever — invalidate after deploys; RENAME replaced assets (#23/#61).

## Client-side traps

- Admin auth gate hydration bug: redirecting while `authed` still holds the server
  snapshot kicks valid sessions back to login. Pattern: `useState<boolean|null>(null)` +
  `useEffect(setAuthed(isAuthenticated()))`; redirect only when explicitly `false`;
  render a guard while `null` (#42).
- Motion animations live in CLIENT components only (static export renders no animation
  server-side); always honor `prefers-reduced-motion`.
- A reveal driven by the PARENT's `whileInView` + `viewport={{ once: true }}` never
  re-propagates to children that mount LATER. Filtering a grid swaps the cards without the
  group leaving the viewport, so the replacements mount at `hidden` (opacity 0) and stay
  invisible while the DOM reports them loaded and clickable (#78). Track the in-view state
  with `useInView` and drive the group with `animate` instead of `whileInView`.
- Test VISIBILITY, not presence: a card inside an `opacity: 0` wrapper passes every
  "element exists / image loaded" assertion. Assert on computed `opacity`, and check page
  BODY (title, image count, size) after a deploy rather than the HTTP status (#77/#78).
- Multi-tenant/theme sites: tenants = validated JSON config; themes style via CSS-token
  contract only — never edit globals.css from a theme.

## Anti-patterns

- Server-side filtering "because it's cleaner".
- `cache:'no-store'` hoping to dodge staleness.
- Retrying POSTs on flaky networks.
- Real API URLs as source fallbacks.
- Overwriting logo.png and wondering why the old one shows (#61).
- Asserting on DOM presence — content inside an `opacity: 0` wrapper looks perfectly present (#78).
- Trusting a green build over a real body check (#77).

## Related

pain-points #7, 12, 16, 18, 21, 23, 26, 29, 31, 39, 42, 44–45, 61, 64, 76–78 ·
pairs with `api-contract`, `cognito-auth`, `aws-deploy`.
