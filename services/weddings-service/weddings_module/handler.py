"""Authenticated endpoints — COGNITO_USER_POOLS authorizer.

Mounted at /admin/{proxy+}. Any Cognito user passes the authorizer; role-gating
is enforced in-app via `get_user_role` / `get_user_email` (never rely on API
Gateway claims alone).

Routes:
  GET    /admin/health          -> liveness probe
  GET    /admin/rsvps           -> paginated RSVPs (coupleSlug, optional attendance)
  GET    /admin/rsvps/stats     -> aggregate RSVP counts + pending wishes
  GET    /admin/wishes          -> paginated wishes (status: pending|approved|all)
  PATCH  /admin/wishes/{id}     -> approve/reject a wish  ({approved: bool})
  DELETE /admin/wishes/{id}     -> delete a wish
  GET    /admin/gifts           -> paginated gifts (coupleSlug)
  DELETE /admin/gifts/{id}      -> delete a gift

Canonical handler pattern:
  top-level try/except
    -> route dispatch on httpMethod + path
    -> get_connection/get_cursor in try/finally
    -> close_connection in finally
    -> return envelope helpers (success/created/validation_error/...)
"""

import json

from wedding_card_invitation_web_common import (
    success, not_found, forbidden, validation_error, internal_error,
    get_connection, get_cursor, close_connection,
    get_user_email, get_user_sub, get_user_role, get_logger,
    parse_pagination, paginated,
)

logger = get_logger(__name__)


def _rsvp_columns():
    return 'id, couple_slug, guest_name, attendance, guests_count, dietary, phone, message, created_at'


def _wish_columns():
    return 'id, couple_slug, name, message, approved, created_at'


def _gift_columns():
    return 'id, couple_slug, name, message, item, approved, created_at'


def _id_from_path(path, resource):
    """Extract the numeric id from '/admin/<resource>/<id>' (trailing slash ok).

    Returns None for a missing or non-numeric id so the dispatcher can fall
    through to a 404 instead of crashing on a bad cast.
    """
    parts = path.rstrip('/').split('/')
    if len(parts) != 4 or parts[1] != 'admin' or parts[2] != resource:
        return None
    try:
        return int(parts[3])
    except (ValueError, TypeError):
        return None


def _require_couple_slug(params):
    """Validate + return the coupleSlug query param, or None if invalid."""
    couple_slug = str(params.get('coupleSlug') or '').strip()
    if not couple_slug:
        return None
    return couple_slug


def _handle_admin(cursor, conn, http_method, path, body, params):
    clean_path = path.rstrip('/')

    # GET /admin/health — sanity check for authenticated requests.
    if http_method == 'GET' and clean_path == '/admin/health':
        return success({'status': 'ok'})

    # GET /admin/rsvps — paginated RSVPs for a couple, optional attendance filter.
    if http_method == 'GET' and clean_path == '/admin/rsvps':
        couple_slug = _require_couple_slug(params)
        if not couple_slug:
            return validation_error('coupleSlug is required')
        attendance = (params.get('attendance') or '').strip()
        if attendance and attendance not in ('yes', 'no'):
            return validation_error('attendance must be either "yes" or "no"')
        page, per_page = parse_pagination(params)
        page = max(1, page)
        per_page = max(1, per_page)

        count_sql = 'SELECT COUNT(*)::int AS total FROM public.rsvps WHERE couple_slug = %(couple_slug)s'
        list_sql = (
            f'SELECT {_rsvp_columns()} FROM public.rsvps '
            'WHERE couple_slug = %(couple_slug)s'
        )
        count_params = {'couple_slug': couple_slug}
        list_params = {'couple_slug': couple_slug}
        if attendance:
            count_sql += ' AND attendance = %(attendance)s'
            list_sql += ' AND attendance = %(attendance)s'
            count_params['attendance'] = attendance
            list_params['attendance'] = attendance
        list_sql += ' ORDER BY created_at DESC LIMIT %(limit)s OFFSET %(offset)s'
        list_params['limit'] = per_page
        list_params['offset'] = (page - 1) * per_page

        cursor.execute(count_sql, count_params)
        total = (cursor.fetchone() or {}).get('total') or 0
        cursor.execute(list_sql, list_params)
        rows = cursor.fetchall()
        return paginated(rows, page, per_page, total)

    # GET /admin/rsvps/stats — aggregate counts + pending wishes for a couple.
    if http_method == 'GET' and clean_path == '/admin/rsvps/stats':
        couple_slug = _require_couple_slug(params)
        if not couple_slug:
            return validation_error('coupleSlug is required')
        cursor.execute(
            '''
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE attendance = 'yes')::int AS confirmed,
                COUNT(*) FILTER (WHERE attendance = 'no')::int AS declined,
                COALESCE(SUM(guests_count) FILTER (WHERE attendance = 'yes'), 0)::int AS guests
            FROM public.rsvps
            WHERE couple_slug = %(couple_slug)s
            ''',
            {'couple_slug': couple_slug},
        )
        stats = cursor.fetchone() or {}
        cursor.execute(
            'SELECT COUNT(*)::int AS total FROM public.wishes '
            'WHERE couple_slug = %(couple_slug)s AND approved = FALSE',
            {'couple_slug': couple_slug},
        )
        pending = cursor.fetchone() or {}
        return success({
            'total': stats.get('total') or 0,
            'confirmed': stats.get('confirmed') or 0,
            'declined': stats.get('declined') or 0,
            'guests': stats.get('guests') or 0,
            'pending_wishes': pending.get('total') or 0,
        })

    # GET /admin/wishes — paginated wishes filtered by moderation status.
    if http_method == 'GET' and clean_path == '/admin/wishes':
        couple_slug = _require_couple_slug(params)
        if not couple_slug:
            return validation_error('coupleSlug is required')
        status = (params.get('status') or 'pending').strip()
        if status not in ('pending', 'approved', 'all'):
            return validation_error('status must be one of "pending", "approved", "all"')
        page, per_page = parse_pagination(params)
        page = max(1, page)
        per_page = max(1, per_page)

        count_sql = 'SELECT COUNT(*)::int AS total FROM public.wishes WHERE couple_slug = %(couple_slug)s'
        list_sql = f'SELECT {_wish_columns()} FROM public.wishes WHERE couple_slug = %(couple_slug)s'
        count_params = {'couple_slug': couple_slug}
        list_params = {'couple_slug': couple_slug}
        if status == 'pending':
            count_sql += ' AND approved = FALSE'
            list_sql += ' AND approved = FALSE'
        elif status == 'approved':
            count_sql += ' AND approved = TRUE'
            list_sql += ' AND approved = TRUE'
        list_sql += ' ORDER BY created_at DESC LIMIT %(limit)s OFFSET %(offset)s'
        list_params['limit'] = per_page
        list_params['offset'] = (page - 1) * per_page

        cursor.execute(count_sql, count_params)
        total = (cursor.fetchone() or {}).get('total') or 0
        cursor.execute(list_sql, list_params)
        rows = cursor.fetchall()
        return paginated(rows, page, per_page, total)

    wish_id = _id_from_path(path, 'wishes')
    gift_id = _id_from_path(path, 'gifts')

    # PATCH /admin/wishes/{id} — approve or reject a wish.
    if http_method == 'PATCH' and wish_id is not None:
        approved = body.get('approved')
        if not isinstance(approved, bool):
            return validation_error('approved must be a boolean')
        cursor.execute(
            'UPDATE public.wishes SET approved = %(approved)s '
            'WHERE id = %(id)s RETURNING id, approved',
            {'approved': approved, 'id': wish_id},
        )
        row = cursor.fetchone()
        if row is None:
            return not_found('Wish not found')
        conn.commit()
        return success({'id': row['id'], 'approved': row['approved']})

    # DELETE /admin/wishes/{id}
    if http_method == 'DELETE' and wish_id is not None:
        cursor.execute(
            'DELETE FROM public.wishes WHERE id = %(id)s RETURNING id',
            {'id': wish_id},
        )
        row = cursor.fetchone()
        if row is None:
            return not_found('Wish not found')
        conn.commit()
        return success({'id': row['id']})

    # GET /admin/gifts — paginated gifts for a couple.
    if http_method == 'GET' and clean_path == '/admin/gifts':
        couple_slug = _require_couple_slug(params)
        if not couple_slug:
            return validation_error('coupleSlug is required')
        page, per_page = parse_pagination(params)
        page = max(1, page)
        per_page = max(1, per_page)
        cursor.execute(
            'SELECT COUNT(*)::int AS total FROM public.gifts WHERE couple_slug = %(couple_slug)s',
            {'couple_slug': couple_slug},
        )
        total = (cursor.fetchone() or {}).get('total') or 0
        cursor.execute(
            f'SELECT {_gift_columns()} FROM public.gifts '
            'WHERE couple_slug = %(couple_slug)s ORDER BY created_at DESC '
            'LIMIT %(limit)s OFFSET %(offset)s',
            {'couple_slug': couple_slug, 'limit': per_page, 'offset': (page - 1) * per_page},
        )
        rows = cursor.fetchall()
        return paginated(rows, page, per_page, total)

    # DELETE /admin/gifts/{id}
    if http_method == 'DELETE' and gift_id is not None:
        cursor.execute(
            'DELETE FROM public.gifts WHERE id = %(id)s RETURNING id',
            {'id': gift_id},
        )
        row = cursor.fetchone()
        if row is None:
            return not_found('Gift not found')
        conn.commit()
        return success({'id': row['id']})

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

        user_email = get_user_email(event)
        logger.info(f'Authenticated request by email={user_email} path={path}')

        conn = get_connection()
        cursor = get_cursor(conn)
        try:
            # Role gate example — enforce per-route, not at the door:
            # if get_user_role(event) != 'admin':
            #     return forbidden('Admin role required')
            return _handle_admin(cursor, conn, http_method, path, body, params)
        finally:
            close_connection(conn, cursor)
    except Exception as e:
        logger.exception('Unhandled error')
        return internal_error()
