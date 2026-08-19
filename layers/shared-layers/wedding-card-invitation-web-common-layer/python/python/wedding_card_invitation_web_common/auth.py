"""Cognito JWT verification + user claims helpers."""

import json
import os

# Cognito group conventions for this platform.
# Platform staff/admin group — full access to every couple's admin data.
PLATFORM_ADMIN_GROUP = 'admin'
# Couple-facing group — regular accounts that own couples via the orders table.
COUPLE_GROUP = 'couple'


def verify_token(token, user_pool_id=None, region=None):
    """Verify a Cognito JWT. Returns claims dict or None."""
    if not token:
        return None
    region = region or os.environ.get('AWS_REGION', 'ap-southeast-1')
    user_pool_id = user_pool_id or os.environ.get('COGNITO_USER_POOL_ID')
    if not user_pool_id:
        return None
    try:
        from jose import jwk, jwt
        keys_url = f'https://cognito-idp.{region}.amazonaws.com/{user_pool_id}/.well-known/jwks.json'
        import requests
        keys = requests.get(keys_url, timeout=10).json()['keys']
        headers = jwt.get_unverified_headers(token)
        kid = headers['kid']
        key = next((k for k in keys if k['kid'] == kid), None)
        if not key:
            return None
        public_key = jwk.construct(key)
        message, encoded_sig = token.rsplit('.', 1)
        from jose.utils import base64url_decode
        decoded_sig = base64url_decode(encoded_sig.encode('utf-8'))
        if not public_key.verify(message.encode('utf-8'), decoded_sig):
            return None
        return jwt.get_unverified_claims(token)
    except Exception:
        return None


def get_user_sub(event):
    return (event.get('requestContext') or {}).get('authorizer', {}).get('claims', {}).get('sub')


def get_user_email(event):
    return (event.get('requestContext') or {}).get('authorizer', {}).get('claims', {}).get('email') or ''


def get_user_groups(event):
    groups = (event.get('requestContext') or {}).get('authorizer', {}).get('claims', {}).get('cognito:groups', '')
    return groups.split(',') if groups else []


def get_user_role(event):
    groups = get_user_groups(event)
    return 'admin' if PLATFORM_ADMIN_GROUP in groups else ('user' if groups else '')


def is_platform_admin(event):
    """True when the caller is in the platform staff/admin Cognito group."""
    return PLATFORM_ADMIN_GROUP in get_user_groups(event)
