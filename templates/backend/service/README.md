# Service Skeleton — `wedding-card-invitation-web-<name>-service`

A single service = three Lambda functions behind one API Gateway stage. Copy
this directory to `services/<name>-service/`, replace every `<name>` token with
your domain name (`order`, `core`, `catalog`, …), and fill in the env block.

## What's here

```
serverless.yml          # 3 functions, gateway CORS, IAM, full env block
requirements.txt        # psycopg2-binary + boto3 (requests/Pillow live in the layer)
<name>_module/          # python package with the three handlers
  handler.py            # authenticated routes  (mounted at /admin/{proxy+})
  public_handler.py     # public routes        (mounted at /public/{proxy+})
  auth_handler.py       # Cognito login/signup (mounted at /auth/{proxy+})
README.md               # this file
```

The functions are named `publicHandler`, `authHandler`, and `<name>Handler` (the
third is the domain's authenticated entry point — its path `/admin/` is
conventional; rename freely, e.g. `/catalog/`).

## The handler pattern (canonical — copy this shape)

Every handler follows the same skeleton. Don't deviate:

```
def lambda_handler(event, context):
    try:                                        # 1. top-level try/except
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        params = event.get('queryStringParameters') or {}
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        ...
        conn = get_connection()                 # 2. connection in try/finally
        cursor = get_cursor(conn)
        try:
            return _route(cursor, conn, http_method, path, body, params)   # 3. dispatch on httpMethod+path
        finally:
            close_connection(conn, cursor)      # 4. close in finally (keeps cached conn open)
    except Exception as e:
        logger.exception('Unhandled error')     # 5. never leak stack traces to the client
        return internal_error()
```

- Route dispatch is plain `if http_method == 'GET' and path == '...'` chains — no
  framework. Read `params` from query strings, `body` from the JSON event.
- **Never hand-build a response.** Always return one of the envelope helpers from
  `wedding_card_invitation_web_common.response` (`success`, `created`, `paginated`, `validation_error`,
  `not_found`, `unauthorized`, `forbidden`, `conflict`, `internal_error`, `timeout`).
- Parameterized SQL everywhere (`%(name)s` with `RealDictCursor`). Never f-string
  SQL with user input.
- Public routes = no authorizer. Authenticated = `COGNITO_USER_POOLS`. Admin =
  role-gated **in-app** via `get_user_role`/`get_user_email` — never trust API
  Gateway claims alone.

## API envelope contract

Every Lambda response is one of these two shapes. **No exceptions.**

```json
{ "success": true,  "data": { ... }, "error": null, "meta": { "page": 1, "per_page": 20, "total": 137 } }
{ "success": false, "data": null, "error": { "code": "NOT_FOUND", "message": "Order not found" } }
```

Error code vocabulary:

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Bad input, missing required params |
| `UNAUTHORIZED` | 401 | No/invalid token |
| `FORBIDDEN` | 403 | Valid token, wrong role |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | State conflict (duplicate, bad transition) |
| `INTERNAL_ERROR` | 500 | Unhandled — catch-all, never leak details |
| `TIMEOUT` | 504 | External call timed out |

Add domain-specific codes sparingly (`STOCK_CONFLICT`, `ORDERING_CLOSED` — see
BGAM's order-service for real examples).

> **Frontends read `data.data.field`.** The axios wrapper unwraps the outer
> `data`, so components use the inner object directly. Define the contract
> before wiring the frontend (pain point #7).

## Deploy

```bash
# 1. env block from .env.example (set GETDB_CONNECTION, COGNITO_*, buckets, SES,
#    and WEDDING_CARD_INVITATION_WEB_COMMON_LAYER_ARN — the ARN captured after deploying the layer)
serverless deploy --stage dev
```

Use the **global** `serverless` CLI (v3) — `npx serverless` may resolve the wrong
version (pain point #20).

## Adding a new service

1. Copy this directory: `cp -r services/<name>-service services/<other>-service`.
2. Rename the package dir `<other>_module` and replace the `<name>` tokens inside
   `serverless.yml` (function name, `handler:` paths) and the module docstrings.
3. Pick route prefixes (`/public/`, `/auth/`, `/admin/`) — keep them namespaced
   so multiple services can coexist on one API Gateway stage.
4. Redeploy the layer first if the new service needs new utilities there.
5. Add the new IAM permissions to `provider.iam.role.statements` only if the new
   service touches resources (S3 buckets, SES) the shared statements don't cover.
