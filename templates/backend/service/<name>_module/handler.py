"""Authenticated endpoints — COGNITO_USER_POOLS authorizer.

Mounted at /admin/{proxy+}. Any Cognito user passes the authorizer; role-gating
is enforced in-app via `get_user_role` / `get_user_email` (never rely on API
Gateway claims alone).

Canonical handler pattern:
  top-level try/except
    -> route dispatch on httpMethod + path
    -> get_connection/get_cursor in try/finally
    -> close_connection in finally
    -> return envelope helpers (success/created/validation_error/...)
"""

import json

from wedding_card_invitation_web_common import (
    success, not_found, forbidden, internal_error,
    get_connection, get_cursor, close_connection,
    get_user_email, get_user_sub, get_user_role, get_logger,
)

logger = get_logger(__name__)


def _handle_admin(cursor, conn, http_method, path, body, params):
    # GET /admin/health — sanity check for authenticated requests.
    if http_method == 'GET' and path.rstrip('/') == '/admin/health':
        return success({'status': 'ok'})

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
