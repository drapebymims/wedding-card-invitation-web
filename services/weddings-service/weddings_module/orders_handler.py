"""Couple-facing order endpoints + internal build-pipeline + ToyyibPay callback.

Two Lambda entry points in this module:

  lambda_handler          -> /orders/{proxy+}   COGNITO_USER_POOLS authorizer
  internal_lambda_handler -> /internal/{proxy+} no authorizer; API-key protected
                            EXCEPT the ToyyibPay callback, which is unauthenticated
                            (ToyyibPay won't send our API key — it is verified via
                            bill lookup + hash + getBillTransactions instead).

Orders are owned by the Cognito user (owner_sub from the token's `sub` claim).
The internal couples-configs endpoint is used by the Amplify build pipeline to
bake paid cards into the static export, so it is protected by a shared API key
(INTERNAL_API_KEY) rather than a user session.

Routes (orders, auth required):
  POST   /orders                 -> create a draft order (derives couple_slug)
  GET    /orders                 -> list current user's orders, newest first
  GET    /orders/{id}            -> single order (owner only)
  PUT    /orders/{id}            -> update config/package/price_amount while editable
  POST   /orders/{id}/checkout   -> create a ToyyibPay bill, set status=awaiting_payment
  POST   /orders/{id}/images     -> presign an S3 PUT for a couple image upload

Routes (internal):
  GET    /internal/couples-configs?status=paid,building,live -> {couples:[{slug,config}]}  (API key)
  POST   /internal/build-complete {slug|orderId} -> mark a building order live (API key)
  POST   /internal/toyyibpay/callback -> ToyyibPay webhook (no API key; verified via bill)

Canonical handler pattern: top-level try/except -> route dispatch on httpMethod +
path -> get_connection/get_cursor in try/finally -> close_connection in finally
-> envelope helpers.
"""

import hmac
import json
import os
import re
import urllib.parse
import uuid

from wedding_card_invitation_web_common import (
    success, created, not_found, unauthorized, conflict, validation_error,
    internal_error, get_connection, get_cursor, close_connection,
    get_user_sub, get_logger,
)

from .toyyibpay import create_bill, handle_webhook, ToyyibPayError, ToyyibPayNotConfigured

logger = get_logger(__name__)

# Statuses in which an order's config/package/price may still be edited.
_EDITABLE_STATUSES = ('draft', 'awaiting_payment')

# Default statuses served by the internal couples-configs endpoint.
_DEFAULT_INTERNAL_STATUSES = ('paid', 'building', 'live')

# Allowed statuses for the internal endpoint filter.
_ALLOWED_INTERNAL_STATUSES = ('draft', 'awaiting_payment', 'paid', 'building', 'live', 'expired', 'cancelled')

# Server-authoritative package pricing in MYR (A1). The client NEVER supplies
# price_amount — it is always derived from `package` via this table so a customer
# cannot set their own price. Single-price MVP; keep a dict for future tiers.
_PACKAGE_PRICES = {
    'standard': 39.00,
}

# Bounded retries for the slug TOCTOU race (B1).
_SLUG_RETRY_ATTEMPTS = 5

# Seed couple slugs committed in apps/web/config/couples/ (adam-eve, maya-arif,
# sarah-daniel). The sync lane skips seeds, so a buyer must never be allocated
# one of these — their paid card would never go live (B3-backend).
_RESERVED_SEED_SLUGS = frozenset({'adam-eve', 'maya-arif', 'sarah-daniel'})

# Allowed image content types for couple uploads -> file extension.
_ALLOWED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
}

# Max upload size (bytes) — 10MB.
_MAX_IMAGE_BYTES = 10 * 1024 * 1024

# Presigned PUT URL lifetime (seconds) — 15 minutes.
_PRESIGN_EXPIRES = 15 * 60


def _order_columns():
    return (
        'id, owner_sub, couple_slug, config, package, price_amount, price_currency, '
        'status, bill_code, bill_url, paid_at, live_until, edit_until, created_at, updated_at'
    )


def _order_row(row):
    """Shape a DB row into the public order object (never leak owner_sub)."""
    return {
        'id': str(row['id']),
        'couple_slug': row['couple_slug'],
        'config': row['config'],
        'package': row['package'],
        'price_amount': str(row['price_amount']),
        'price_currency': row['price_currency'],
        'status': row['status'],
        'bill_code': row['bill_code'],
        'bill_url': row['bill_url'],
        'paid_at': row['paid_at'],
        'live_until': row['live_until'],
        'edit_until': row['edit_until'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


def _slugify(value):
    """Lowercase, kebab-case, strip non-alphanumerics.

    Runs of non-alphanumeric characters collapse to a single hyphen; leading and
    trailing hyphens are removed. Returns '' if nothing usable remains.
    """
    value = (value or '').strip().lower()
    value = re.sub(r'[^a-z0-9]+', '-', value)
    return value.strip('-')


def _derive_slug(config):
    """Derive a couple_slug from the config's couple names (groom + bride).

    Uses the short `name` (falling back to `fullName`) of groom then bride,
    matching the existing adam-eve / maya-arif convention. Returns '' if no
    usable names are present.
    """
    couple = (config or {}).get('couple') or {}
    groom = couple.get('groom') or {}
    bride = couple.get('bride') or {}
    groom_part = _slugify(groom.get('name') or groom.get('fullName'))
    bride_part = _slugify(bride.get('name') or bride.get('fullName'))
    slug = '-'.join(p for p in (groom_part, bride_part) if p)
    return slug


def _unique_slug(cursor, base_slug):
    """Return base_slug if free, else base_slug-2, -3, ... until one is free.

    Treats the committed seed slugs (_RESERVED_SEED_SLUGS) as taken so a buyer
    can never be allocated one (the sync lane skips seeds — B3-backend).
    """
    if not base_slug:
        base_slug = 'couple'
    candidate = base_slug
    suffix = 2
    while True:
        if candidate in _RESERVED_SEED_SLUGS:
            candidate = f'{base_slug}-{suffix}'
            suffix += 1
            continue
        cursor.execute(
            'SELECT 1 FROM public.orders WHERE couple_slug = %(slug)s',
            {'slug': candidate},
        )
        if cursor.fetchone() is None:
            return candidate
        candidate = f'{base_slug}-{suffix}'
        suffix += 1


def _price_for_package(package):
    """Return the server-authoritative MYR price for a package, or None if unknown.

    The client never supplies price_amount; it is always derived from `package`
    via _PACKAGE_PRICES (A1).
    """
    return _PACKAGE_PRICES.get(package)


def _is_unique_violation(exc):
    """True if `exc` is a psycopg2 UniqueViolation (slug collision).

    psycopg2 is imported lazily because its binary wheel is Linux-only and cannot
    load in the local (macOS) test environment; the fake cursor never raises, so
    this path is only exercised against a real Postgres in production.
    """
    try:
        import psycopg2
        return isinstance(exc, psycopg2.errors.UniqueViolation)
    except ImportError:
        return False


def _is_valid_uuid(value):
    """True if value parses as a UUID (B6 — reject malformed ids before querying)."""
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, TypeError, AttributeError):
        return False


def _s3_client():
    import boto3
    return boto3.client('s3', region_name=os.environ.get('AWS_REGION', 'ap-southeast-1'))


def _cdn_url(key):
    """CloudFront URL that will serve the object after upload.

    Uses the existing ASSETS_CDN_URL convention (already wired in serverless.yml
    + .env.example). Falls back to a relative path if unset (deploy-time concern).
    """
    domain = os.environ.get('ASSETS_CDN_URL', '').strip().rstrip('/')
    if domain:
        return f'{domain}/{key}'
    return f'/{key}'


def _presign_image_upload(owner_sub, content_type):
    """Presign an S3 PUT for a couple image.

    Returns (key, upload_url, cdn_url). The key is per-tenant
    (uploads/<owner_sub>/<uuid>.<ext>) and never derived from client input, so
    path traversal is impossible. The presigned URL is scoped to PutObject on
    this exact key.
    """
    ext = _ALLOWED_IMAGE_TYPES[content_type]
    key = f'uploads/{owner_sub}/{uuid.uuid4()}.{ext}'
    bucket = os.environ.get('ASSETS_BUCKET', '').strip()
    if not bucket:
        raise ValueError('ASSETS_BUCKET environment variable is not set')
    upload_url = _s3_client().generate_presigned_url(
        'put_object',
        Params={'Bucket': bucket, 'Key': key, 'ContentType': content_type},
        ExpiresIn=_PRESIGN_EXPIRES,
    )
    return key, upload_url, _cdn_url(key)


def _validate_image_upload_body(body):
    """Validate + normalize a POST /orders/{id}/images body.

    Returns (data, error_response). contentType must be an allowlisted image
    type; optional size (bytes) must not exceed the max.
    """
    content_type = str(body.get('contentType') or body.get('fileType') or '').strip().lower()
    if content_type not in _ALLOWED_IMAGE_TYPES:
        allowed = ', '.join(sorted(_ALLOWED_IMAGE_TYPES))
        return None, validation_error(f'contentType must be one of: {allowed}')

    size = body.get('size')
    if size is not None:
        try:
            size = int(size)
        except (TypeError, ValueError):
            return None, validation_error('size must be an integer number of bytes')
        if size < 0 or size > _MAX_IMAGE_BYTES:
            return None, validation_error(f'size must be between 0 and {_MAX_IMAGE_BYTES} bytes')

    return {'content_type': content_type, 'size': size}, None


def _order_id_from_path(path):
    """Extract the UUID from '/orders/<id>', '/orders/<id>/checkout' or
    '/orders/<id>/images'.

    Trailing slash ok. Returns None for a missing or malformed id so the
    dispatcher falls through to a 404.
    """
    parts = path.rstrip('/').split('/')
    if len(parts) < 3 or parts[1] != 'orders':
        return None
    if len(parts) == 3:
        return parts[2] or None
    if len(parts) == 4 and parts[3] in ('checkout', 'images'):
        return parts[2] or None
    return None


def _toyyibpay_callback_url():
    """Absolute https URL ToyyibPay POSTs the payment result to.

    Built from PUBLIC_API_BASE_URL + the callback path. Returns None if the env
    var is unset or not an https URL — checkout must fail rather than emit a
    relative/bad callback URL that would silently never confirm payment (B4).
    """
    base = os.environ.get('PUBLIC_API_BASE_URL', '').strip().rstrip('/')
    if not base or not base.startswith('https://'):
        return None
    return f'{base}/internal/toyyibpay/callback'


def _toyyibpay_return_url(order_id):
    """URL the customer is redirected to after payment.

    Points at /checkout/thanks?order=<order_id> (NOT /w/<slug>) because the card
    is built on demand and /w/[slug] has dynamicParams=false in the static export
    — the buyer would land on a 404 right after paying (A6). The thanks page
    fetches the order by id to display the slug.

    Returns None if FRONTEND_URL is unset or not an https URL — checkout must
    fail rather than emit a relative billReturnUrl that ToyyibPay can't redirect
    to (B2).
    """
    frontend = os.environ.get('FRONTEND_URL', '').strip().rstrip('/')
    if not frontend or not frontend.startswith('https://'):
        return None
    return f'{frontend}/checkout/thanks?order={order_id}'


def _validate_create_body(body):
    """Validate + normalize a POST /orders body. Returns (data, error_response).

    price_amount is intentionally NOT accepted from the client — the server
    derives it from `package` via the price table (A1).
    """
    package = str(body.get('package') or 'standard').strip() or 'standard'
    config = body.get('config')
    if not isinstance(config, dict) or not config:
        return None, validation_error('config (CoupleConfig object) is required')
    return {'package': package, 'config': config}, None


def _handle_orders(cursor, conn, http_method, path, body, params, owner_sub):
    clean_path = path.rstrip('/')
    order_id = _order_id_from_path(path)

    # POST /orders — create a draft order, deriving couple_slug from config.
    if http_method == 'POST' and clean_path == '/orders':
        data, err = _validate_create_body(body)
        if err:
            return err
        price = _price_for_package(data['package'])
        if price is None:
            return validation_error(f'unknown package: {data["package"]}')
        base_slug = _derive_slug(data['config'])
        if not base_slug:
            return validation_error('config.couple names are required to derive a slug')

        # B1: SELECT-then-INSERT has a TOCTOU race on couple_slug. Retry on
        # UniqueViolation with the next free suffix (bounded).
        slug = _unique_slug(cursor, base_slug)
        inserted = False
        for _ in range(_SLUG_RETRY_ATTEMPTS):
            try:
                cursor.execute(
                    '''
                    INSERT INTO public.orders
                        (owner_sub, couple_slug, config, package, price_amount, price_currency, status)
                    VALUES
                        (%(owner_sub)s, %(couple_slug)s, %(config)s, %(package)s, %(price_amount)s, 'MYR', 'draft')
                    RETURNING id
                    ''',
                    {
                        'owner_sub': owner_sub,
                        'couple_slug': slug,
                        'config': json.dumps(data['config']),
                        'package': data['package'],
                        'price_amount': price,
                    },
                )
                row = cursor.fetchone()
                conn.commit()
                inserted = True
                break
            except Exception as e:
                if not _is_unique_violation(e):
                    raise
                conn.rollback()
                slug = _unique_slug(cursor, base_slug)
        if not inserted:
            return internal_error('Could not allocate a unique couple slug')

        cursor.execute(
            f'SELECT {_order_columns()} FROM public.orders WHERE id = %(id)s',
            {'id': row['id']},
        )
        created_row = cursor.fetchone()
        return created(_order_row(created_row))

    # GET /orders — list current user's orders, newest first.
    if http_method == 'GET' and clean_path == '/orders':
        cursor.execute(
            f'SELECT {_order_columns()} FROM public.orders '
            'WHERE owner_sub = %(owner_sub)s ORDER BY created_at DESC',
            {'owner_sub': owner_sub},
        )
        rows = cursor.fetchall()
        return success([_order_row(r) for r in rows])

    # GET /orders/{id} — single order, owner only.
    if http_method == 'GET' and order_id is not None:
        if not _is_valid_uuid(order_id):
            return not_found('Order not found')
        cursor.execute(
            f'SELECT {_order_columns()} FROM public.orders '
            'WHERE id = %(id)s AND owner_sub = %(owner_sub)s',
            {'id': order_id, 'owner_sub': owner_sub},
        )
        row = cursor.fetchone()
        if row is None:
            return not_found('Order not found')
        return success(_order_row(row))

    # PUT /orders/{id} — update config/package/price_amount while editable.
    if http_method == 'PUT' and order_id is not None:
        if not _is_valid_uuid(order_id):
            return not_found('Order not found')
        cursor.execute(
            f'SELECT {_order_columns()} FROM public.orders '
            'WHERE id = %(id)s AND owner_sub = %(owner_sub)s',
            {'id': order_id, 'owner_sub': owner_sub},
        )
        row = cursor.fetchone()
        if row is None:
            return not_found('Order not found')

        editable = row['status'] in _EDITABLE_STATUSES
        if not editable and row['edit_until'] is not None:
            cursor.execute(
                'SELECT now() <= %(edit_until)s AS editable',
                {'edit_until': row['edit_until']},
            )
            editable = (cursor.fetchone() or {}).get('editable') is True
        if not editable:
            return conflict('Order is no longer editable')

        new_config = body.get('config', row['config'])
        new_package = str(body.get('package') or row['package']).strip() or row['package']
        # A1: price is always derived from package server-side; client price is ignored.
        new_price = _price_for_package(new_package)
        if new_price is None:
            return validation_error(f'unknown package: {new_package}')

        cursor.execute(
            '''
            UPDATE public.orders
            SET config = %(config)s, package = %(package)s, price_amount = %(price_amount)s,
                updated_at = now()
            WHERE id = %(id)s
            RETURNING id
            ''',
            {
                'config': json.dumps(new_config),
                'package': new_package,
                'price_amount': new_price,
                'id': order_id,
            },
        )
        conn.commit()
        cursor.execute(
            f'SELECT {_order_columns()} FROM public.orders WHERE id = %(id)s',
            {'id': order_id},
        )
        updated_row = cursor.fetchone()
        return success(_order_row(updated_row))

    # POST /orders/{id}/checkout — create a ToyyibPay bill and move to awaiting_payment.
    if http_method == 'POST' and order_id is not None and clean_path.endswith('/checkout'):
        if not _is_valid_uuid(order_id):
            return not_found('Order not found')
        cursor.execute(
            f'SELECT {_order_columns()} FROM public.orders '
            'WHERE id = %(id)s AND owner_sub = %(owner_sub)s',
            {'id': order_id, 'owner_sub': owner_sub},
        )
        row = cursor.fetchone()
        if row is None:
            return not_found('Order not found')
        if row['status'] not in ('draft', 'awaiting_payment'):
            return conflict('Order is not in a payable state')

        # B2: if already awaiting_payment with a bill, return the existing bill
        # rather than creating a new one (avoids orphaning a paid old bill).
        if row['status'] == 'awaiting_payment' and row['bill_code']:
            return success({'bill_url': row['bill_url'], 'bill_code': row['bill_code']})

        # B4: fail checkout if the callback URL can't be built (unset / not https)
        # instead of emitting a bad URL that silently never confirms payment.
        callback_url = _toyyibpay_callback_url()
        if not callback_url:
            return internal_error('PUBLIC_API_BASE_URL must be set to an https URL for payments')

        # B2: fail checkout if the return URL can't be built (unset / not https)
        # instead of emitting a relative billReturnUrl ToyyibPay can't redirect to.
        return_url = _toyyibpay_return_url(str(row['id']))
        if not return_url:
            return internal_error('FRONTEND_URL must be set to an https URL for payments')

        order = {
            'id': str(row['id']),
            'couple_slug': row['couple_slug'],
            'price_amount': row['price_amount'],
            'price_currency': row['price_currency'],
            'bill_name': f"Wedding {row['couple_slug']}",
            'bill_description': 'Wedding invitation package',
        }
        try:
            bill_code, bill_url = create_bill(
                order,
                return_url=return_url,
                callback_url=callback_url,
            )
        except ToyyibPayNotConfigured as e:
            logger.error(f'ToyyibPay not configured: {e}')
            return internal_error('Payment gateway is not configured')
        except ToyyibPayError as e:
            logger.error(f'ToyyibPay createBill failed: {e}')
            return internal_error('Payment gateway error')

        cursor.execute(
            '''
            UPDATE public.orders
            SET bill_code = %(bill_code)s, bill_url = %(bill_url)s,
                status = 'awaiting_payment', updated_at = now()
            WHERE id = %(id)s
            RETURNING id
            ''',
            {'bill_code': bill_code, 'bill_url': bill_url, 'id': order_id},
        )
        conn.commit()
        return success({'bill_url': bill_url, 'bill_code': bill_code})

    # POST /orders/{id}/images — presign an S3 PUT for a couple image upload.
    if http_method == 'POST' and order_id is not None and clean_path.endswith('/images'):
        if not _is_valid_uuid(order_id):
            return not_found('Order not found')
        cursor.execute(
            f'SELECT {_order_columns()} FROM public.orders '
            'WHERE id = %(id)s AND owner_sub = %(owner_sub)s',
            {'id': order_id, 'owner_sub': owner_sub},
        )
        row = cursor.fetchone()
        if row is None:
            return not_found('Order not found')

        editable = row['status'] in _EDITABLE_STATUSES
        if not editable and row['edit_until'] is not None:
            cursor.execute(
                'SELECT now() <= %(edit_until)s AS editable',
                {'edit_until': row['edit_until']},
            )
            editable = (cursor.fetchone() or {}).get('editable') is True
        if not editable:
            return conflict('Order is no longer editable')

        data, err = _validate_image_upload_body(body)
        if err:
            return err

        try:
            key, upload_url, cdn_url = _presign_image_upload(owner_sub, data['content_type'])
        except ValueError as e:
            logger.error(f'Image upload presign failed: {e}')
            return internal_error('Upload storage is not configured')

        return success({'uploadUrl': upload_url, 'key': key, 'cdnUrl': cdn_url})

    return not_found('Endpoint not found')


def lambda_handler(event, context):
    try:
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        params = event.get('queryStringParameters') or {}
        try:
            body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        except (ValueError, TypeError):
            body = {}

        owner_sub = get_user_sub(event)
        if not owner_sub:
            return unauthorized('Authentication required')
        logger.info(f'Orders request by sub={owner_sub} path={path}')

        conn = get_connection()
        cursor = get_cursor(conn)
        try:
            return _handle_orders(cursor, conn, http_method, path, body, params, owner_sub)
        finally:
            close_connection(conn, cursor)
    except Exception as e:
        logger.exception('Unhandled error')
        return internal_error()


def _check_api_key(event):
    """Constant-time compare of the x-api-key header against INTERNAL_API_KEY."""
    expected = os.environ.get('INTERNAL_API_KEY', '')
    if not expected:
        return False
    provided = (event.get('headers') or {}).get('x-api-key', '')
    return hmac.compare_digest(provided, expected)


def _handle_internal(cursor, conn, http_method, path, params, body):
    clean_path = path.rstrip('/')

    # GET /internal/couples-configs?status=paid,building,live
    if http_method == 'GET' and clean_path == '/internal/couples-configs':
        raw_status = (params.get('status') or '').strip()
        if raw_status:
            statuses = [s.strip() for s in raw_status.split(',') if s.strip()]
            invalid = [s for s in statuses if s not in _ALLOWED_INTERNAL_STATUSES]
            if invalid:
                return validation_error(f'invalid status(es): {", ".join(invalid)}')
        else:
            statuses = list(_DEFAULT_INTERNAL_STATUSES)

        cursor.execute(
            'SELECT couple_slug, config FROM public.orders '
            'WHERE status = ANY(%(statuses)s) ORDER BY created_at DESC',
            {'statuses': statuses},
        )
        rows = cursor.fetchall()
        couples = [{'slug': r['couple_slug'], 'config': r['config']} for r in rows]
        return success({'couples': couples})

    # POST /internal/build-complete — mark a building order live after a successful bake.
    if http_method == 'POST' and clean_path == '/internal/build-complete':
        slug = str(body.get('slug') or body.get('couple_slug') or '').strip()
        order_id = str(body.get('orderId') or '').strip()
        if not slug and not order_id:
            return validation_error('slug (or orderId) is required')

        if order_id:
            if not _is_valid_uuid(order_id):
                return not_found('Order not found')
            cursor.execute(
                'SELECT id, status FROM public.orders WHERE id = %(id)s',
                {'id': order_id},
            )
        else:
            cursor.execute(
                'SELECT id, status FROM public.orders WHERE couple_slug = %(slug)s',
                {'slug': slug},
            )
        row = cursor.fetchone()
        if row is None:
            return not_found('Order not found')

        # Idempotent: only transition building -> live; already-live is a no-op.
        if row['status'] == 'building':
            cursor.execute(
                "UPDATE public.orders SET status = 'live', updated_at = now() "
                "WHERE id = %(id)s AND status = 'building'",
                {'id': row['id']},
            )
            conn.commit()
        return success({'id': str(row['id']), 'status': 'live'})

    return not_found('Endpoint not found')


def _handle_toyyibpay_callback(event):
    """Handle the ToyyibPay webhook callback (form-encoded, unauthenticated).

    ToyyibPay POSTs application/x-www-form-urlencoded data to the callback URL
    and does NOT send our API key, so this route is exempt from the API-key
    check. Security is enforced inside handle_webhook via bill lookup + hash
    validation + getBillTransactions re-query + amount reconciliation.

    Always acknowledges with HTTP 200 so ToyyibPay stops retrying.
    """
    raw = event.get('body') or ''
    payload = {}
    if raw:
        try:
            parsed = urllib.parse.parse_qs(raw)
            payload = {k: v[0] for k, v in parsed.items()}
        except Exception:
            logger.warning('ToyyibPay callback body could not be parsed')

    try:
        order_id = handle_webhook(payload)
    except ToyyibPayNotConfigured as e:
        logger.error(f'ToyyibPay not configured: {e}')
        return internal_error('Payment gateway is not configured')
    except ToyyibPayError as e:
        logger.error(f'ToyyibPay callback error: {e}')
        return internal_error('Payment gateway error')

    return success({'order_id': order_id})


def internal_lambda_handler(event, context):
    try:
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        params = event.get('queryStringParameters') or {}
        try:
            body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        except (ValueError, TypeError):
            body = {}
        logger.info(f'Internal request path={path}')

        # ToyyibPay callback is unauthenticated (ToyyibPay won't send our key).
        if http_method == 'POST' and path.rstrip('/') == '/internal/toyyibpay/callback':
            return _handle_toyyibpay_callback(event)

        if not _check_api_key(event):
            return unauthorized('Invalid or missing API key')

        conn = get_connection()
        cursor = get_cursor(conn)
        try:
            return _handle_internal(cursor, conn, http_method, path, params, body)
        finally:
            close_connection(conn, cursor)
    except Exception as e:
        logger.exception('Unhandled error')
        return internal_error()
