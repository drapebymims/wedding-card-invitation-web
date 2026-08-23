---
name: serverless-backend
description: Backend rules for foundation-derived Lambda services — shared layer layout, DB connections that don't lose writes, JSONB/webhook traps, and the handler skeleton. Use when writing or reviewing any service, handler, or layer code. Trigger words: "handler", "Lambda", "layer", "psycopg2", "JSONB", "webhook", "service".
---

# Serverless Backend — Layer, Connections, Handlers

## Shared layer (`<repo>_common`)

- Layout is sacred: `layers/shared-layers/<repo>-common-layer/python/python/<repo>_common/`
  — the NESTED `python/python` is what makes Lambda imports resolve (#4).
- Keep ALL `*.libs/` `.so` files — never strip (#5). Install Linux-only wheels:
  `pip install --platform manylinux2014_x86_64 --target python/python --python-version
  3.12 --only-binary=:all:`; include requests, Pillow, cryptography for webhook sigs (#14).
- Keep layers lean (cold start #17); layer serverless.yml sets `retain: false` so old
  versions auto-delete — the real 250MB relief with the prune plugin (#2).
- Gitignore vendored wheels WITH the negation `!layers/**/python/python/*_common/`, or
  the ignore pattern swallows the layer's own source (#19/#57).

## Connections & transactions

- `get_connection(secret_name=None)` — the default arg is mandatory from day one (#1).
- Cache connections THREAD-LOCAL, or you exhaust `max_connections` under load (#15).
- **Writes need an explicit commit**: the shared `close_connection()` rolls back in its
  `finally`. Every POST/PUT/PATCH/DELETE route must call `conn.commit()` on 2xx before
  returning — otherwise production silently loses every write (#43).
- Reads use `RealDictCursor`; `close_connection(conn, cursor)` in `finally`.

## SQL rules

- Parameterized only: `%(name)s` named params — never f-string user input.
- Sort/order via whitelist (`safe_sort`/`safe_order`) — never interpolate user keys.
- **JSONB: `json.dumps()` Python lists/dicts BEFORE binding** — psycopg2 otherwise emits
  a Postgres ARRAY literal that corrupts the value (#32).
- Images: never bare `convert('RGB')` on RGBA/P images (transparent → black); flatten
  onto a WHITE background first, scale-to-fit, center on white canvas (#59).

## Handler skeleton (copy from templates/backend/service/)

1. Top-level try/except → `logger.exception` + `internal_error()` — never leak traces.
2. Route dispatch on `httpMethod`+`path`.
3. `conn = get_connection(); cursor = get_cursor(conn)` inside try/finally.
4. Return envelope helpers from `response.py` — never hand-build dicts (see api-contract).

## Webhooks & paid integrations

- Body may be multipart/form-data OR raw JSON — parse with a JSON-safe try/except.
- Verify signatures over RAW body bytes, cache the gateway public key, ship a
  `*_DISABLE_SIG_VERIFY=true` escape hatch (#34).
- ALWAYS ack 200 — even for rejected/failed verification — or the gateway retries
  forever (#46).
- Feature-flag seams: `*_ENABLED` toggles + `is_configured()` guards + fallback path so
  deploys precede client keys.
- Meta webhooks (WhatsApp-style): dedupe by message id via UNIQUE constraint, enqueue to
  SQS+DLQ, return 200 immediately.
- ToyyibPay specifics: amounts in SEN (cents); form-encoded POST (`data=...`, NOT
  `json=`); `billName`/`billDescription` allow alphanumeric+space+underscore only;
  callbacks can't reach localhost (test against deployed stage); hash is MD5 (theirs);
  bills expire (`billExpiryDays`); no native recurring billing — track
  `subscription_end_date` yourself (#69).

## Deploys & tests

- Global `serverless` CLI v3, not npx (#20/#54) — see aws-deploy skill.
- Explicit short `provider.iam.role.name` for long project names (#30).
- Never regex-edit `serverless.yml` — exact-string edits only (#6).
- Unit tests with FakeCursor/FakeConnection monkeypatches — no AWS/Postgres needed;
  assert the envelope, parameterized SQL (`'%' not in query`), and `commits == 1` on
  write routes (#43).

## Anti-patterns

- Flattening the layer to `python/<module>/`.
- Hand-built response dicts.
- Write route without commit "because local worked" (#43 is exactly this bug).
- f-string SQL "just for one sort field".
- Stripping `.libs` to shrink the zip.

## Related

`docs/conventions.md`, `docs/architecture.md`, `docs/pain-points.md` rows 1–6, 14–17,
20, 30, 32, 34, 43–46, 54, 57, 59 · pairs with `api-contract`, `data-migrations`,
`aws-deploy`.
