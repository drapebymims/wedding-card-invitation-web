"""Public endpoints — no auth.

Mounted at /public/{proxy+}. Anything a storefront/landing page needs without
a session lives here.

Canonical handler pattern (same skeleton as the other handlers):
  top-level try/except -> route dispatch on httpMethod + path
    -> get_connection/get_cursor in try/finally -> close_connection in finally
    -> return envelope helpers
"""

import json

from wedding_card_invitation_web_common import (
    success, not_found, internal_error,
    get_connection, get_cursor, close_connection, get_logger,
)

logger = get_logger(__name__)


def _handle_public(cursor, http_method, path):
    # GET /public/health — liveness probe used by the frontend/scripts.
    if http_method == 'GET' and path.rstrip('/') == '/public/health':
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

        conn = get_connection()
        cursor = get_cursor(conn)
        try:
            return _handle_public(cursor, http_method, path)
        finally:
            close_connection(conn, cursor)
    except Exception as e:
        logger.exception('Unhandled error')
        return internal_error()
