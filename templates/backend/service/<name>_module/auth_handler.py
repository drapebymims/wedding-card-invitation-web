"""Auth endpoints — Cognito login/signup (no authorizer).

Mounted at /auth/{proxy+}. Backs the frontend sign-in/sign-up forms.

Canonical handler pattern: top-level try/except -> route dispatch on
httpMethod + path -> get_connection/get_cursor in try/finally ->
close_connection in finally -> envelope helpers. (Pure-auth routes don't
strictly need the DB; the connection lifecycle is kept for consistency.)
"""

import json
import os

from wedding_card_invitation_web_common import (
    success, validation_error, internal_error,
    get_connection, get_cursor, close_connection, get_logger,
)

logger = get_logger(__name__)


def _cognito_client():
    import boto3
    return boto3.client('cognito-idp', region_name=os.environ.get('AWS_REGION', 'ap-southeast-1'))


def _handle_auth(cursor, conn, http_method, path, body):
    client = _cognito_client()
    pool_id = os.environ.get('COGNITO_USER_POOL_ID', '')
    app_client_id = os.environ.get('COGNITO_APP_CLIENT_ID', '')

    # POST /auth/login
    if http_method == 'POST' and path.rstrip('/') == '/auth/login':
        email = body.get('email') or ''
        password = body.get('password') or ''
        if not email or not password:
            return validation_error('email and password are required')
        try:
            resp = client.initiate_auth(
                ClientId=app_client_id,
                AuthFlow='USER_PASSWORD_AUTH',
                AuthParameters={'USERNAME': email, 'PASSWORD': password},
            )
            result = resp['AuthenticationResult']
            return success({
                'AccessToken': result['AccessToken'],
                'IdToken': result['IdToken'],
                'RefreshToken': result.get('RefreshToken', ''),
                'ExpiresIn': result['ExpiresIn'],
                'TokenType': result['TokenType'],
            })
        except client.exceptions.NotAuthorizedException:
            return validation_error('Incorrect email or password')
        except Exception as e:
            logger.error(f'Login failed: {e}')
            return validation_error('Login failed')

    # POST /auth/signup
    if http_method == 'POST' and path.rstrip('/') == '/auth/signup':
        email = body.get('email') or ''
        password = body.get('password') or ''
        name = body.get('name') or ''
        if not email or not password:
            return validation_error('email and password are required')
        try:
            client.sign_up(
                ClientId=app_client_id,
                Username=email,
                Password=password,
                UserAttributes=[{'Name': 'email', 'Value': email}, {'Name': 'name', 'Value': name}],
            )
            return success({'message': 'Account created. Check your email to verify.'})
        except Exception as e:
            logger.error(f'Signup failed: {e}')
            return validation_error('Signup failed')

    return validation_error('Method not supported')


def lambda_handler(event, context):
    try:
        http_method = event.get('httpMethod', 'GET')
        path = event.get('path', '')
        try:
            body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        except (ValueError, TypeError):
            body = {}

        conn = get_connection()
        cursor = get_cursor(conn)
        try:
            if '/auth' in path:
                return _handle_auth(cursor, conn, http_method, path, body)
            return validation_error('Endpoint not found')
        finally:
            close_connection(conn, cursor)
    except Exception as e:
        logger.exception('Unhandled error')
        return internal_error()
