# Shared Lambda Layer — `wedding_card_invitation_web_common`

One layer per repo, shared by every service. It holds the six generic utility
modules under `python/python/wedding_card_invitation_web_common/` plus the third-party runtime
dependencies the handlers need (psycopg2, Pillow, requests).

The Lambda execution environment is **Amazon Linux (x86_64)**, so the wheels must
be built for that platform — install them explicitly with `--platform`:

```bash
cd layers/shared-layers/wedding-card-invitation-web-common-layer

pip install \
  --platform manylinux2014_x86_64 \
  --target python/python \
  --python-version 3.12 \
  --only-binary=:all: \
  --no-cache-dir \
  psycopg2-binary Pillow requests
```

> Install with a CPython 3.12 interpreter on the path (or a venv). This command
> has been proven in the sibling projects.

## CRITICAL: the nested `python/python/` layout

Do **not** flatten this. Lambda resolves a layer by merging `python/` (or
`python/lib/python3.12/site-packages/`) into `sys.path`. The proven structure is:

```
python/
└── python/                      # <-- second python/ is intentional
    ├── wedding_card_invitation_web_common/             # our six modules
    ├── psycopg2/
    ├── PIL/
    ├── requests/
    └── ...
```

If you drop to a single `python/` the runtime can't find `wedding_card_invitation_web_common` and every
handler dies with `ModuleNotFoundError`. This is pain point #4 — never flatten.

## Never strip `*.libs`

Wheels like `psycopg2_binary` and `Pillow` ship adjacent `.so` files under
`psycopg2_binary.libs/` / `pillow.libs/`. Those shared libraries are **required at
runtime** — deleting them (to "save space") breaks the import. Keep ALL `*.libs`
(pain point #5). Watch the 250 MB Lambda limit instead via the prune plugin in
`serverless.yml` (pain point #2).

## The six modules

| Module | Purpose |
|---|---|
| `response.py` | API envelope helpers `success()`, `created()`, `paginated()`, `validation_error()`, … |
| `connection.py` | Secrets Manager → psycopg2, thread-local cached connection (`get_connection(secret_name=None)`) |
| `serializer.py` | `FMSJSONEncoder` + `json_dumps` (datetime/Decimal/bytes → JSON-safe) |
| `validator.py` | `require_params`, `safe_sort`, `safe_order`, `parse_int`, `parse_pagination` |
| `auth.py` | `verify_token` (Cognito JWT), `get_user_sub/email/groups/role` |
| `logger.py` | `get_logger(name)` — one StreamHandler, INFO level |

Note: `auth.verify_token()` imports `jose` (python-jose) lazily. API Gateway's
`COGNITO_USER_POOLS` authorizer does the token validation in production, so `jose`
is optional — add it to the install command above only if you call `verify_token()`
directly.

## Deploy (layer first)

```bash
serverless deploy --stage dev
```

Then **capture the new layer ARN** from the output:

```
Service Information
...
layers:
  wedding-card-invitation-web-common: arn:aws:lambda:ap-southeast-1:<account-id>:layer:wedding-card-invitation-web-common:3
```

Set `WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN` to that ARN in every service's deploy env
(`.env.example` block) and redeploy all services. Bump the ARN every time the
layer changes — Lambda pins to the exact version.

## Git hygiene

The vendored `python/` tree contains ~30 MB of Linux wheels and `.so` files —
do **not** commit it (pain point #19, it breaks `git push`). Gitignore
`python/python/` and run the `pip install` command above as a pre-deploy step.
