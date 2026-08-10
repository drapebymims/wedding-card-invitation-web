"""Public endpoints — no auth.

Mounted at /public/{proxy+}. Anything a storefront/landing page needs without
a session lives here: liveness probe, RSVP submission, guestbook wishes and
gift-registry messages.

Moderation note: wishes and gifts are submitted as `approved = FALSE` and only
become public after an admin approves them (PATCH /admin/wishes/{id}). Public
reads therefore filter `approved = TRUE` so nothing unmoderated leaks to the
storefront.

Canonical handler pattern (same skeleton as the other handlers):
  top-level try/except -> route dispatch on httpMethod + path
    -> get_connection/get_cursor in try/finally -> close_connection in finally
    -> return envelope helpers
"""

import json

from wedding_card_invitation_web_common import (
    success, created, not_found, validation_error, internal_error, paginated,
    get_connection, get_cursor, close_connection,
    require_params, parse_pagination, get_logger,
)

logger = get_logger(__name__)


def _wish_columns():
    return 'id, couple_slug, name, message, approved, created_at'


def _gift_columns():
    return 'id, couple_slug, name, message, item, approved, created_at'


def _require_text(body, fields):
    """True if every field is present and non-blank after stripping."""
    ok, _missing = require_params(body, fields)
    if not ok:
        return False
    return all(str(body.get(field, '')).strip() for field in fields)


def _handle_public(cursor, conn, http_method, path, body, params):
    clean_path = path.rstrip('/')

    # GET /public/health — liveness probe used by the frontend/scripts.
    if http_method == 'GET' and clean_path == '/public/health':
        return success({'status': 'ok'})

    # POST /public/rsvps — submit an RSVP (stored as-is, no moderation).
    if http_method == 'POST' and clean_path == '/public/rsvps':
        if not _require_text(body, ['coupleSlug', 'guestName', 'attendance']):
            return validation_error('coupleSlug, guestName and attendance are required')
        attendance = body.get('attendance').strip()
        if attendance not in ('yes', 'no'):
            return validation_error('attendance must be either "yes" or "no"')
        try:
            guests_count = int(body.get('guestsCount', 1))
        except (ValueError, TypeError):
            return validation_error('guestsCount must be an integer')
        if guests_count < 1:
            return validation_error('guestsCount must be at least 1')

        cursor.execute(
            '''
            INSERT INTO public.rsvps
                (couple_slug, guest_name, attendance, guests_count, dietary, phone, message)
            VALUES
                (%(couple_slug)s, %(guest_name)s, %(attendance)s, %(guests_count)s,
                 %(dietary)s, %(phone)s, %(message)s)
            RETURNING id
            ''',
            {
                'couple_slug': body.get('coupleSlug').strip(),
                'guest_name': body.get('guestName').strip(),
                'attendance': attendance,
                'guests_count': guests_count,
                'dietary': body.get('dietary'),
                'phone': body.get('phone'),
                'message': body.get('message'),
            },
        )
        row = cursor.fetchone()
        conn.commit()
        return created({'id': row['id']})

    # GET /public/wishes — approved guestbook entries, newest first.
    if http_method == 'GET' and clean_path == '/public/wishes':
        couple_slug = str(params.get('coupleSlug') or '').strip()
        if not couple_slug:
            return validation_error('coupleSlug is required')
        page, per_page = parse_pagination(params)
        page = max(1, page)
        per_page = max(1, per_page)

        cursor.execute(
            'SELECT COUNT(*)::int AS total FROM public.wishes '
            'WHERE couple_slug = %(couple_slug)s AND approved = TRUE',
            {'couple_slug': couple_slug},
        )
        total = (cursor.fetchone() or {}).get('total') or 0
        cursor.execute(
            f'SELECT {_wish_columns()} FROM public.wishes '
            'WHERE couple_slug = %(couple_slug)s AND approved = TRUE '
            'ORDER BY created_at DESC LIMIT %(limit)s OFFSET %(offset)s',
            {'couple_slug': couple_slug, 'limit': per_page, 'offset': (page - 1) * per_page},
        )
        rows = cursor.fetchall()
        return paginated(rows, page, per_page, total)

    # POST /public/wishes — submit a wish; needs admin approval before public.
    if http_method == 'POST' and clean_path == '/public/wishes':
        if not _require_text(body, ['coupleSlug', 'name', 'message']):
            return validation_error('coupleSlug, name and message are required')
        cursor.execute(
            'INSERT INTO public.wishes (couple_slug, name, message) '
            'VALUES (%(couple_slug)s, %(name)s, %(message)s) RETURNING id',
            {
                'couple_slug': body.get('coupleSlug').strip(),
                'name': body.get('name').strip(),
                'message': body.get('message').strip(),
            },
        )
        row = cursor.fetchone()
        conn.commit()
        return created({'id': row['id']})

    # GET /public/gifts — approved gift-registry messages.
    if http_method == 'GET' and clean_path == '/public/gifts':
        couple_slug = str(params.get('coupleSlug') or '').strip()
        if not couple_slug:
            return validation_error('coupleSlug is required')
        cursor.execute(
            f'SELECT {_gift_columns()} FROM public.gifts '
            'WHERE couple_slug = %(couple_slug)s AND approved = TRUE '
            'ORDER BY created_at DESC',
            {'couple_slug': couple_slug},
        )
        return success(cursor.fetchall())

    # POST /public/gifts — submit a gift message; needs admin approval before public.
    if http_method == 'POST' and clean_path == '/public/gifts':
        if not _require_text(body, ['coupleSlug', 'name', 'message']):
            return validation_error('coupleSlug, name and message are required')
        cursor.execute(
            'INSERT INTO public.gifts (couple_slug, name, message, item) '
            'VALUES (%(couple_slug)s, %(name)s, %(message)s, %(item)s) RETURNING id',
            {
                'couple_slug': body.get('coupleSlug').strip(),
                'name': body.get('name').strip(),
                'message': body.get('message').strip(),
                'item': body.get('item'),
            },
        )
        row = cursor.fetchone()
        conn.commit()
        return created({'id': row['id']})

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

        conn = get_connection()
        cursor = get_cursor(conn)
        try:
            return _handle_public(cursor, conn, http_method, path, body, params)
        finally:
            close_connection(conn, cursor)
    except Exception as e:
        logger.exception('Unhandled error')
        return internal_error()
