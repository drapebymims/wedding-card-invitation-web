---
name: api-contract
description: The API contract for foundation projects — every Lambda returns {success, data, error} with the shared error-code vocabulary, and frontends read data.data.field. Use when writing or reviewing any Lambda handler, axios service, or API-consuming code. Trigger words: "API", "endpoint", "handler", "envelope", "response format".
---

# API Contract

The contract is the glue between backend and frontend. It is a **hard requirement** — not
a style preference. Define it before building anything that crosses the boundary.

## The envelope

```json
// success
{ "success": true, "data": { ... }, "error": null, "meta": { "page": 1, "per_page": 20, "total": 137 } }
// failure
{ "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "Order not found" } }
```

- `data` is always an object (or array under a key) — never a bare scalar.
- `meta` only on paginated responses (via `paginated()`).
- All responses include `Access-Control-Allow-*` headers.

## Error codes (vocabulary)

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | missing/invalid params (from `require_params` etc.) |
| `NOT_FOUND` | resource doesn't exist |
| `UNAUTHORIZED` | not signed in / bad token |
| `FORBIDDEN` | signed in but not allowed (role gate) |
| `CONFLICT` | state conflict (duplicate, stale) |
| `INTERNAL_ERROR` | unhandled exception (never leak details) |
| `TIMEOUT` | upstream/DB timeout |
| domain codes | sparingly — `STOCK_CONFLICT`, `ORDERING_CLOSED` |

## Backend rules

- Use the layer's `response.py` helpers — never hand-build responses:
  `success(data, meta=None)`, `created(data)`, `paginated(data, page, per_page, total)`,
  `validation_error`, `not_found`, `unauthorized`, `forbidden`, `conflict`,
  `internal_error`, `timeout`.
- Top-level try/except in every handler → `logger.exception` + `internal_error()`.
- Never include Python exception strings or stack traces in the response.
- Public routes = no authorizer; authenticated = `COGNITO_USER_POOLS`; admin = role-gated
  in-app (verify JWT via the layer's `auth.py`, don't trust claims alone).
- New endpoints: keep the envelope identical; document new error codes.

## Frontend rules

- One axios instance per service, shared auth interceptor: adds Bearer token,
  **unwraps `data`**, handles 401 → clear tokens → redirect to sign-in
  (deduplicated refresh for Cognito).
- Components read `data.data.field` **after** the interceptor unwrap — i.e. `res.data`
  in the component is the inner payload object.
- Handle the failure envelope: `res.error.code` drives user-facing errors
  (e.g. `STOCK_CONFLICT` → "Only 2 left").
- Build-time fetches (static export): `fetchRetry` (6 attempts, backoff) + fallback data —
  pages must never crash on a transient blip or empty response.

## Review checklist

- [ ] Response built with `response.py` helpers (not ad-hoc dicts)
- [ ] Envelope shape correct on both success and error paths
- [ ] Error code from the vocabulary; message is user-safe
- [ ] CORS headers present (via gatewayResponses for 4xx too)
- [ ] SQL parameterized, sort fields whitelisted
- [ ] Frontend unwraps `data` once, and only once
- [ ] Contract change → frontend consumers updated in the same change
