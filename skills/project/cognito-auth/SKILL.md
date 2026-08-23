---
name: cognito-auth
description: Cognito authentication patterns and traps for foundation-derived projects — token handling, callback URLs, hosted UI, pool hygiene, and CLI pitfalls. Use when login/signup/callbacks/tokens break, or when touching user pools from CLI or Terraform. Trigger words: "login broken", "Cognito", "token", "callback URL", "hosted UI", "401", "signup", "user pool".
---

# Cognito Auth — Tokens, Callbacks, Pool Hygiene

## Token rules

- Send the **IdToken** (not AccessToken) in the `Authorization` header — API Gateway's
  authorizer rejects AccessToken with a bare 401 lacking CORS headers, which browsers
  surface as "Network Error" even though curl gets 200 (#28).
- Login returns the nested shape — `data.tokens.{IdToken, AccessToken, RefreshToken,
  ExpiresIn}` — one shape across ALL services and test-flow scripts; flat variants
  broke sibling tooling (travel-pelangi had to adapt its script).
- Store tokens in localStorage (`<repo>-auth-tokens`); renaming that storage key logs
  every user out — do it deliberately, announce it (sinar).
- On 401: clear tokens → set expired flag → redirect to sign-in (deduplicated refresh
  interceptor; logout if refresh fails).

## Callback URLs (exact-match landmines)

- Include BOTH local dev AND deployed URLs from day one:
  `http://localhost:3000/auth/callback` + the live callback — first local auth test
  fails otherwise (glass-house).
- Use the BRANCH-qualified domain: `main.<appId>.amplifyapp.com`, not the bare domain (#37).
- Matching is EXACT including trailing slash — `/admin/login/` ≠ `/admin/login`;
  change Terraform and frontend together (#60).
- Hosted-UI implicit flow: `/auth/callback` reads tokens from the URL fragment.

## Pool & client hygiene

- NEVER reuse another project's user pool — restores silently fail auth when the
  borrowed pool no longer exists (#56). Template always ships `cognito.tf`.
- `aws cognito-idp update-user-pool-client` SILENTLY resets ExplicitAuthFlows — re-pass
  `--explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_USER_SRP_AUTH
  ALLOW_REFRESH_TOKEN_AUTH` on every update, or password logins break (#25).
- Hosted-UI domain prefixes are GLOBALLY unique — account rebuilds pick a NEW suffix;
  the old one is unrecoverable cross-account (#52).
- Default password policy requires lower+upper+number+symbol — generate admin/user
  passwords accordingly or AdminCreateUser fails.
- Staff management needs `cognito-idp:AdminCreateUser`/`AdminSetUserPassword` in the
  service role; temp passwords display once — surface them immediately.

## App-side rules

- Roles come from `cognito:groups`, verified IN-APP via the layer's `auth.py` — never
  trust API Gateway claims alone (wander/salesmen pattern).
- Single-owner/admin apps: no signup; forgot-password returns the generic
  "If the account exists…" message (no user enumeration).
- Google SSO via hosted UI; callback handles both token sources.
- Non-Cognito variant (cookie sessions): browsers DROP `Secure` cookies on http://localhost
  — derive the cookie `secure` flag from `x-forwarded-proto`, and clearing must use the
  same flag as setting (#65).

## Anti-patterns

- AccessToken "because it says access".
- Flat token payloads "just this once".
- Editing callback paths without checking trailing slashes (#60).
- Sharing a pool across projects to save setup time (#56).
- Skipping --explicit-auth-flows on a client tweak (#25).

## Related

pain-points #25, 28, 37, 52, 55–56, 60, 65 · pairs with `static-frontend`,
`serverless-backend`, `commit-discipline`.
