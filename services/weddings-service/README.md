# Wedding Service — `wedding-card-invitation-web-weddings-service`

Backend for the resellable wedding invitation platform. One Serverless Framework
service exposing three Lambda functions behind one API Gateway stage:

| Function | Mount path | Auth |
|---|---|---|
| `publicHandler` | `/public/{proxy+}` | none — storefront, health, RSVPs, wishes, gifts |
| `authHandler` | `/auth/{proxy+}` | none — Cognito login/signup |
| `weddingsHandler` | `/admin/{proxy+}` | `COGNITO_USER_POOLS` authorizer — moderation/admin |

Runtime: Python 3.12, Postgres 16 (`public.rsvps`, `public.wishes`, `public.gifts`).
Shared code (envelope helpers, DB connection, validation) lives in the
`wedding-card-invitation-web-common-layer` Lambda layer.

## Endpoint reference

Every response uses the envelope contract — see `docs/conventions.md`:

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "..." } }
```

Paginated endpoints return `pagination: {page, items_per_page, total, total_pages}`.

### Public (no auth)

| Method | Path | Description |
|---|---|---|
| GET  | `/public/health` | Liveness probe → `{status: 'ok'}` |
| POST | `/public/rsvps` | Submit RSVP. Body `{coupleSlug, guestName, attendance: 'yes'\|'no', guestsCount?, dietary?, phone?, message?}`. `coupleSlug`/`guestName`/`attendance` required, `guestsCount >= 1` (default 1) → `201 {id}` |
| GET  | `/public/wishes?coupleSlug=&page=&perPage=` | Paginated **approved** wishes, `created_at DESC` |
| POST | `/public/wishes` | Submit wish. Body `{coupleSlug, name, message}` → `201 {id}` (stored `approved = FALSE`) |
| GET  | `/public/gifts?coupleSlug=` | List of **approved** gifts |
| POST | `/public/gifts` | Submit gift message. Body `{coupleSlug, name, message, item?}` → `201 {id}` (stored `approved = FALSE`) |

> Moderation: wishes/gifts are created unapproved and only surface on the public
> GET endpoints after an admin approves them via `/admin/wishes/{id}`.

### Admin (`COGNITO_USER_POOLS` authorizer)

| Method | Path | Description |
|---|---|---|
| GET   | `/admin/health` | Authenticated liveness probe → `{status: 'ok'}` |
| GET   | `/admin/rsvps?coupleSlug=&page=&perPage=&attendance=` | Paginated RSVPs, `created_at DESC`; optional `attendance` filter (`yes`/`no`) |
| GET   | `/admin/rsvps/stats?coupleSlug=` | `{total, confirmed, declined, guests, pending_wishes}` — counts by attendance, `SUM(guests_count)` for confirmed, plus unapproved wishes |
| GET   | `/admin/wishes?coupleSlug=&status=` | Paginated wishes; `status` ∈ `pending` (default) \| `approved` \| `all` |
| PATCH | `/admin/wishes/{id}` | Approve/reject. Body `{approved: bool}` → `{id, approved}`; `404` if missing |
| DELETE| `/admin/wishes/{id}` | Delete a wish → `{id}`; `404` if missing |
| GET   | `/admin/gifts?coupleSlug=&page=&perPage=` | Paginated gifts |
| DELETE| `/admin/gifts/{id}` | Delete a gift → `{id}`; `404` if missing |

Path parsing tolerates a trailing slash (`/admin/wishes/123/`). All SQL is
parameterized (`%(name)s` placeholders) — never f-strings with user input.

## Running tests (local, no AWS)

Tests are pure unit tests: the layer's `get_connection`/`get_cursor`/
`close_connection` are monkeypatched with an in-memory fake cursor that records
`execute` calls and returns canned results, so nothing touches AWS or the DB.

```bash
# from the repo root
python3 -m pytest services/weddings-service/tests -q
python3 -m compileall services/weddings-service/weddings_module   # smoke check
```

`tests/conftest.py` puts both `services/weddings-service` and the layer's
`python/python` directory on `sys.path` so the handlers import cleanly. Dev-only
deps live in `requirements-dev.txt` (install with
`pip install -r services/weddings-service/requirements-dev.txt`).

## Deploy

1. Env block from `.env.example` (`GETDB_CONNECTION`, `COGNITO_*`,
   `WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN`, buckets, SES).
2. Migrations applied (see `infra/terraform/migrations/`).
3. `serverless deploy --stage dev` — use the **global** `serverless` CLI (v3).

## Layout

```
serverless.yml          # 3 functions, gateway CORS, IAM, env block
weddings_module/
  handler.py            # admin routes   (/admin/{proxy+})
  public_handler.py     # public routes  (/public/{proxy+})
  auth_handler.py       # Cognito login/signup (/auth/{proxy+})
tests/                  # pytest unit tests (fake cursor/connection)
requirements.txt        # runtime deps (psycopg2-binary, boto3)
requirements-dev.txt    # test-only deps (pytest)
README.md               # this file
```
