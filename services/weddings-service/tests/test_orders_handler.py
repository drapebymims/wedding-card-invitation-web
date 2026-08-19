"""Unit tests for the couple-facing orders Lambda (orders_handler.py).

Hermetic: DB helpers are monkeypatched (conftest fake_db) and the ToyyibPay
`create_bill` call is monkeypatched, so these tests exercise the real route
dispatch, validation, SQL shape, and checkout/callback wiring.
"""

import json

import pytest

UUID1 = '11111111-1111-1111-1111-111111111111'
UUID2 = '22222222-2222-2222-2222-222222222222'


def _call(handler, method, path, body=None, query=None, claims=None, headers=None):
    event = {'httpMethod': method, 'path': path, 'queryStringParameters': query or {}}
    if body is not None:
        event['body'] = json.dumps(body)
    if claims:
        event['requestContext'] = {'authorizer': {'claims': claims}}
    if headers:
        event['headers'] = headers
    return handler(event, {})


def _body(response):
    return json.loads(response['body'])


def _order_row(id=UUID1, slug='adam-eve', status='draft', bill_code=None, bill_url=None):
    return {
        'id': id, 'owner_sub': 'user-sub', 'couple_slug': slug,
        'config': {'slug': slug, 'couple': {'groom': {'name': 'Adam'}, 'bride': {'name': 'Eve'}}},
        'package': 'standard', 'price_amount': '39.00', 'price_currency': 'MYR',
        'status': status, 'bill_code': bill_code, 'bill_url': bill_url,
        'paid_at': None, 'live_until': None, 'edit_until': None,
        'created_at': '2026-01-01T00:00:00+00:00', 'updated_at': '2026-01-01T00:00:00+00:00',
    }


# ---------------------------------------------------------------- auth

def test_orders_requires_auth(orders_lambda, fake_db):
    resp = _call(orders_lambda, 'GET', '/orders')
    assert resp['statusCode'] == 401
    assert _body(resp)['error']['code'] == 'UNAUTHORIZED'
    assert fake_db['cursor'].calls == []


# ---------------------------------------------------------------- create

def test_orders_create_derives_slug_and_server_price(orders_lambda, fake_db):
    fake_db['cursor'].results = [
        None,                              # _unique_slug check -> slug is free
        {'id': UUID1},                     # INSERT ... RETURNING id
        _order_row(slug='john-jane'),      # SELECT after insert
    ]
    resp = _call(
        orders_lambda, 'POST', '/orders',
        body={'package': 'standard', 'config': {'couple': {'groom': {'name': 'John'}, 'bride': {'name': 'Jane'}}}, 'price_amount': 0.01},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 201
    body = _body(resp)
    assert body['success'] is True
    assert body['data']['couple_slug'] == 'john-jane'
    assert body['data']['status'] == 'draft'
    # A1: server price (39.00) overrides the client-supplied 0.01
    assert body['data']['price_amount'] == '39.00'
    assert fake_db['conn'].commits == 1

    insert = fake_db['cursor'].calls_for('INSERT INTO public.orders')
    assert len(insert) == 1
    params = insert[0]['params']
    assert params['owner_sub'] == 'user-sub'
    assert params['couple_slug'] == 'john-jane'
    assert 'status' not in params  # status not set -> DB default 'draft'
    assert params['price_amount'] == 39.0  # derived from package, not the body


def test_orders_create_requires_config(orders_lambda, fake_db):
    resp = _call(
        orders_lambda, 'POST', '/orders',
        body={'package': 'standard', 'price_amount': 99.0},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


def test_orders_create_requires_names_for_slug(orders_lambda, fake_db):
    resp = _call(
        orders_lambda, 'POST', '/orders',
        body={'config': {'couple': {}}, 'price_amount': 99.0},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


def test_orders_create_unknown_package(orders_lambda, fake_db):
    resp = _call(
        orders_lambda, 'POST', '/orders',
        body={'package': 'platinum', 'config': {'couple': {'groom': {'name': 'A'}, 'bride': {'name': 'B'}}}},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


def test_orders_create_retries_on_slug_collision(orders_lambda, fake_db, monkeypatch):
    """B1: a UniqueViolation on INSERT is retried with the next free suffix."""
    import weddings_module.orders_handler as orders_module

    # psycopg2's binary wheel can't load in the local test env, so _is_unique_violation
    # always returns False there. Stub it to True so the retry branch is exercised.
    monkeypatch.setattr(orders_module, '_is_unique_violation', lambda exc: True)

    real_execute = fake_db['cursor'].execute
    attempts = {'n': 0}

    def flaky_execute(query, params=None):
        if 'INSERT INTO public.orders' in query and attempts['n'] == 0:
            attempts['n'] += 1
            raise Exception('duplicate key value violates unique constraint "orders_couple_slug_key"')
        real_execute(query, params)

    monkeypatch.setattr(fake_db['cursor'], 'execute', flaky_execute)
    # _unique_slug SELECT (free) -> INSERT (raises) -> rollback -> _unique_slug SELECT (free) -> INSERT ok
    fake_db['cursor'].results = [
        None,                              # first _unique_slug -> free
        None,                              # second _unique_slug after rollback -> free
        {'id': UUID1},                     # INSERT ... RETURNING id
        _order_row(),                      # SELECT after insert
    ]
    resp = _call(
        orders_lambda, 'POST', '/orders',
        body={'package': 'standard', 'config': {'couple': {'groom': {'name': 'Adam'}, 'bride': {'name': 'Eve'}}}},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 201
    assert _body(resp)['data']['couple_slug'] == 'adam-eve'
    assert fake_db['conn'].commits == 1
    assert fake_db['conn'].rollbacks == 1


def test_orders_create_reserves_seed_slugs(orders_lambda, fake_db):
    """B3-backend: a buyer can never be allocated a committed seed slug.

    Adam + Eve -> base 'adam-eve' is reserved -> allocated 'adam-eve-2'.
    """
    fake_db['cursor'].results = [
        None,                              # _unique_slug: 'adam-eve' reserved (no query), 'adam-eve-2' free
        {'id': UUID1},                     # INSERT ... RETURNING id
        _order_row(slug='adam-eve-2'),     # SELECT after insert
    ]
    resp = _call(
        orders_lambda, 'POST', '/orders',
        body={'package': 'standard', 'config': {'couple': {'groom': {'name': 'Adam'}, 'bride': {'name': 'Eve'}}}},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 201
    assert _body(resp)['data']['couple_slug'] == 'adam-eve-2'
    insert = fake_db['cursor'].calls_for('INSERT INTO public.orders')
    assert insert[0]['params']['couple_slug'] == 'adam-eve-2'


# ---------------------------------------------------------------- list

def test_orders_list_owner_only(orders_lambda, fake_db):
    fake_db['cursor'].results = [[_order_row(), _order_row(id=UUID2, slug='maya-arif')]]
    resp = _call(orders_lambda, 'GET', '/orders', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['success'] is True
    assert len(body['data']) == 2
    query = fake_db['cursor'].queries[0]
    assert 'WHERE owner_sub = %(owner_sub)s' in query
    assert 'ORDER BY created_at DESC' in query
    assert fake_db['cursor'].calls[0]['params'] == {'owner_sub': 'user-sub'}


# ---------------------------------------------------------------- get one

def test_orders_get_owner_only(orders_lambda, fake_db):
    fake_db['cursor'].results = [_order_row()]
    resp = _call(orders_lambda, 'GET', f'/orders/{UUID1}', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 200
    assert _body(resp)['data']['id'] == UUID1
    query = fake_db['cursor'].queries[0]
    assert 'WHERE id = %(id)s AND owner_sub = %(owner_sub)s' in query


def test_orders_get_not_found(orders_lambda, fake_db):
    fake_db['cursor'].results = [None]
    resp = _call(orders_lambda, 'GET', f'/orders/{UUID2}', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'


def test_orders_get_malformed_uuid_404(orders_lambda, fake_db):
    """B6: a non-UUID id is rejected before hitting the DB (no query runs)."""
    resp = _call(orders_lambda, 'GET', '/orders/not-a-uuid', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'
    assert fake_db['cursor'].calls == []


# ---------------------------------------------------------------- update

def test_orders_put_editable_draft(orders_lambda, fake_db):
    fake_db['cursor'].results = [
        _order_row(status='draft'),   # SELECT existing
        _order_row(status='draft'),   # SELECT after update (UPDATE has no fetchone)
    ]
    resp = _call(
        orders_lambda, 'PUT', f'/orders/{UUID1}',
        body={'config': {'slug': 'adam-eve'}, 'package': 'standard', 'price_amount': 199.0},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 200
    assert _body(resp)['success'] is True
    assert fake_db['conn'].commits == 1

    # A1: price is derived from package server-side; client price (199.0) is ignored.
    update = fake_db['cursor'].calls_for('UPDATE public.orders')
    assert len(update) == 1
    assert update[0]['params']['price_amount'] == 39.0
    assert update[0]['params']['package'] == 'standard'


def test_orders_put_unknown_package(orders_lambda, fake_db):
    """A1: an unknown package on update is rejected."""
    fake_db['cursor'].results = [_order_row(status='draft')]
    resp = _call(
        orders_lambda, 'PUT', f'/orders/{UUID1}',
        body={'package': 'platinum'},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'


def test_orders_put_not_editable_conflict(orders_lambda, fake_db):
    fake_db['cursor'].results = [_order_row(status='paid')]
    resp = _call(
        orders_lambda, 'PUT', f'/orders/{UUID1}',
        body={'config': {'slug': 'adam-eve'}},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 409
    assert _body(resp)['error']['code'] == 'CONFLICT'


# ---------------------------------------------------------------- checkout

def test_orders_checkout_creates_bill(orders_lambda, fake_db, monkeypatch):
    import weddings_module.orders_handler as orders_module
    monkeypatch.setenv('PUBLIC_API_BASE_URL', 'https://api.example.com')
    monkeypatch.setenv('FRONTEND_URL', 'https://front.example.com')
    captured = {}

    def fake_create_bill(order, return_url, callback_url):
        captured['return_url'] = return_url
        captured['callback_url'] = callback_url
        return ('BILL123', 'https://dev.toyyibpay.com/BILL123')

    monkeypatch.setattr(orders_module, 'create_bill', fake_create_bill)
    fake_db['cursor'].results = [
        _order_row(status='draft'),   # SELECT existing
        {'id': UUID1},                # UPDATE ... RETURNING id
    ]
    resp = _call(orders_lambda, 'POST', f'/orders/{UUID1}/checkout', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['data'] == {'bill_url': 'https://dev.toyyibpay.com/BILL123', 'bill_code': 'BILL123'}
    assert fake_db['conn'].commits == 1

    # A6: return URL points at the thanks page keyed by order id (not /w/<slug>).
    assert captured['return_url'] == f'https://front.example.com/checkout/thanks?order={UUID1}'
    # Callback URL is unchanged.
    assert captured['callback_url'] == 'https://api.example.com/internal/toyyibpay/callback'

    update = fake_db['cursor'].calls_for('UPDATE public.orders')
    assert len(update) == 1
    params = update[0]['params']
    assert params['bill_code'] == 'BILL123'
    assert params['bill_url'] == 'https://dev.toyyibpay.com/BILL123'
    assert params['id'] == UUID1


def test_orders_checkout_not_payable_conflict(orders_lambda, fake_db):
    fake_db['cursor'].results = [_order_row(status='paid')]
    resp = _call(orders_lambda, 'POST', f'/orders/{UUID1}/checkout', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 409
    assert _body(resp)['error']['code'] == 'CONFLICT'


def test_orders_checkout_not_configured(orders_lambda, fake_db, monkeypatch):
    import weddings_module.orders_handler as orders_module
    from weddings_module.toyyibpay import ToyyibPayNotConfigured

    monkeypatch.setenv('PUBLIC_API_BASE_URL', 'https://api.example.com')
    monkeypatch.setenv('FRONTEND_URL', 'https://front.example.com')

    def boom(order, return_url, callback_url):
        raise ToyyibPayNotConfigured('missing keys')

    monkeypatch.setattr(orders_module, 'create_bill', boom)
    fake_db['cursor'].results = [_order_row(status='draft')]
    resp = _call(orders_lambda, 'POST', f'/orders/{UUID1}/checkout', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 500
    assert _body(resp)['error']['code'] == 'INTERNAL_ERROR'


def test_orders_checkout_requires_https_callback_url(orders_lambda, fake_db, monkeypatch):
    """B4: checkout fails when PUBLIC_API_BASE_URL is unset or not https."""
    import weddings_module.orders_handler as orders_module
    monkeypatch.delenv('PUBLIC_API_BASE_URL', raising=False)
    monkeypatch.setattr(
        orders_module, 'create_bill',
        lambda order, return_url, callback_url: ('BILL123', 'https://dev.toyyibpay.com/BILL123'),
    )
    fake_db['cursor'].results = [_order_row(status='draft')]
    resp = _call(orders_lambda, 'POST', f'/orders/{UUID1}/checkout', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 500
    assert _body(resp)['error']['code'] == 'INTERNAL_ERROR'
    # create_bill must NOT be called (guard fails before billing)
    assert fake_db['cursor'].calls_for('UPDATE public.orders') == []


def test_orders_checkout_requires_https_return_url(orders_lambda, fake_db, monkeypatch):
    """B2: checkout fails when FRONTEND_URL is unset or not https."""
    import weddings_module.orders_handler as orders_module
    monkeypatch.setenv('PUBLIC_API_BASE_URL', 'https://api.example.com')
    monkeypatch.delenv('FRONTEND_URL', raising=False)
    monkeypatch.setattr(
        orders_module, 'create_bill',
        lambda order, return_url, callback_url: ('BILL123', 'https://dev.toyyibpay.com/BILL123'),
    )
    fake_db['cursor'].results = [_order_row(status='draft')]
    resp = _call(orders_lambda, 'POST', f'/orders/{UUID1}/checkout', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 500
    assert _body(resp)['error']['code'] == 'INTERNAL_ERROR'
    # create_bill must NOT be called (guard fails before billing)
    assert fake_db['cursor'].calls_for('UPDATE public.orders') == []


def test_orders_checkout_reuses_existing_bill(orders_lambda, fake_db, monkeypatch):
    """B2: re-checkout of an awaiting_payment order with a bill returns the existing bill."""
    import weddings_module.orders_handler as orders_module
    monkeypatch.setenv('PUBLIC_API_BASE_URL', 'https://api.example.com')
    monkeypatch.setattr(
        orders_module, 'create_bill',
        lambda order, return_url, callback_url: ('NEWBILL', 'https://dev.toyyibpay.com/NEWBILL'),
    )
    fake_db['cursor'].results = [
        _order_row(status='awaiting_payment', bill_code='OLDBILL', bill_url='https://dev.toyyibpay.com/OLDBILL'),
    ]
    resp = _call(orders_lambda, 'POST', f'/orders/{UUID1}/checkout', claims={'sub': 'user-sub'})
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['data'] == {'bill_url': 'https://dev.toyyibpay.com/OLDBILL', 'bill_code': 'OLDBILL'}
    # No new bill created, no UPDATE issued.
    assert fake_db['cursor'].calls_for('UPDATE public.orders') == []
    assert fake_db['conn'].commits == 0


# ---------------------------------------------------------------- image upload (presign)

def test_orders_image_presign_success(orders_lambda, fake_db, monkeypatch):
    import weddings_module.orders_handler as orders_module
    monkeypatch.setattr(
        orders_module, '_presign_image_upload',
        lambda owner_sub, content_type: (
            'uploads/user-sub/abc123.jpg',
            'https://s3.amazonaws.com/bucket/uploads/user-sub/abc123.jpg?X-Amz-Signature=xyz',
            'https://cdn.example.com/uploads/user-sub/abc123.jpg',
        ),
    )
    fake_db['cursor'].results = [_order_row(status='draft')]  # SELECT existing
    resp = _call(
        orders_lambda, 'POST', f'/orders/{UUID1}/images',
        body={'filename': 'photo.jpg', 'contentType': 'image/jpeg', 'size': 2048},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['success'] is True
    assert body['data']['key'] == 'uploads/user-sub/abc123.jpg'
    assert body['data']['uploadUrl'].startswith('https://s3.amazonaws.com/')
    assert body['data']['cdnUrl'] == 'https://cdn.example.com/uploads/user-sub/abc123.jpg'


def test_orders_image_presign_rejects_bad_content_type(orders_lambda, fake_db):
    fake_db['cursor'].results = [_order_row(status='draft')]
    resp = _call(
        orders_lambda, 'POST', f'/orders/{UUID1}/images',
        body={'filename': 'evil.exe', 'contentType': 'application/octet-stream'},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'


def test_orders_image_presign_rejects_oversize(orders_lambda, fake_db):
    fake_db['cursor'].results = [_order_row(status='draft')]
    resp = _call(
        orders_lambda, 'POST', f'/orders/{UUID1}/images',
        body={'filename': 'big.png', 'contentType': 'image/png', 'size': 11 * 1024 * 1024},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'


def test_orders_image_presign_owner_only(orders_lambda, fake_db):
    # No row returned -> order not owned by caller -> 404.
    fake_db['cursor'].results = [None]
    resp = _call(
        orders_lambda, 'POST', f'/orders/{UUID1}/images',
        body={'filename': 'a.jpg', 'contentType': 'image/jpeg'},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'


def test_orders_image_presign_not_editable_conflict(orders_lambda, fake_db):
    fake_db['cursor'].results = [_order_row(status='paid')]
    resp = _call(
        orders_lambda, 'POST', f'/orders/{UUID1}/images',
        body={'filename': 'a.jpg', 'contentType': 'image/jpeg'},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 409
    assert _body(resp)['error']['code'] == 'CONFLICT'


def test_orders_image_presign_malformed_uuid_404(orders_lambda, fake_db):
    resp = _call(
        orders_lambda, 'POST', '/orders/not-a-uuid/images',
        body={'filename': 'a.jpg', 'contentType': 'image/jpeg'},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'
    assert fake_db['cursor'].calls == []


def test_orders_image_presign_not_configured(orders_lambda, fake_db, monkeypatch):
    import weddings_module.orders_handler as orders_module
    monkeypatch.setattr(
        orders_module, '_presign_image_upload',
        lambda owner_sub, content_type: (_ for _ in ()).throw(ValueError('ASSETS_BUCKET not set')),
    )
    fake_db['cursor'].results = [_order_row(status='draft')]
    resp = _call(
        orders_lambda, 'POST', f'/orders/{UUID1}/images',
        body={'filename': 'a.jpg', 'contentType': 'image/jpeg'},
        claims={'sub': 'user-sub'},
    )
    assert resp['statusCode'] == 500
    assert _body(resp)['error']['code'] == 'INTERNAL_ERROR'


# ---------------------------------------------------------------- internal couples-configs

def test_internal_couples_configs_requires_key(internal_lambda, fake_db):
    resp = _call(internal_lambda, 'GET', '/internal/couples-configs')
    assert resp['statusCode'] == 401
    assert _body(resp)['error']['code'] == 'UNAUTHORIZED'
    assert fake_db['cursor'].calls == []


def test_internal_couples_configs_ok(internal_lambda, fake_db, monkeypatch):
    monkeypatch.setenv('INTERNAL_API_KEY', 'secret-key')
    fake_db['cursor'].results = [[{'couple_slug': 'adam-eve', 'config': {'slug': 'adam-eve'}}]]
    resp = _call(
        internal_lambda, 'GET', '/internal/couples-configs',
        query={'status': 'paid,building,live'},
        headers={'x-api-key': 'secret-key'},
    )
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['data'] == {'couples': [{'slug': 'adam-eve', 'config': {'slug': 'adam-eve'}}]}
    query = fake_db['cursor'].queries[0]
    assert 'status = ANY(%(statuses)s)' in query
    assert fake_db['cursor'].calls[0]['params'] == {'statuses': ['paid', 'building', 'live']}


def test_internal_couples_configs_bad_status(internal_lambda, fake_db, monkeypatch):
    monkeypatch.setenv('INTERNAL_API_KEY', 'secret-key')
    resp = _call(
        internal_lambda, 'GET', '/internal/couples-configs',
        query={'status': 'paid,bogus'},
        headers={'x-api-key': 'secret-key'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'


# ---------------------------------------------------------------- build-complete

def test_internal_build_complete_requires_key(internal_lambda, fake_db):
    resp = _call(internal_lambda, 'POST', '/internal/build-complete', body={'slug': 'adam-eve'})
    assert resp['statusCode'] == 401
    assert _body(resp)['error']['code'] == 'UNAUTHORIZED'
    assert fake_db['cursor'].calls == []


def test_internal_build_complete_by_slug(internal_lambda, fake_db, monkeypatch):
    """A2: a building order is marked live after a successful bake."""
    monkeypatch.setenv('INTERNAL_API_KEY', 'secret-key')
    fake_db['cursor'].results = [
        {'id': UUID1, 'status': 'building'},   # SELECT by slug
        {'id': UUID1},                          # UPDATE RETURNING
    ]
    resp = _call(
        internal_lambda, 'POST', '/internal/build-complete',
        body={'slug': 'adam-eve'},
        headers={'x-api-key': 'secret-key'},
    )
    assert resp['statusCode'] == 200
    assert _body(resp)['data'] == {'id': UUID1, 'status': 'live'}
    assert fake_db['conn'].commits == 1
    update = fake_db['cursor'].calls_for('UPDATE public.orders')
    assert len(update) == 1
    assert "status = 'live'" in update[0]['query']
    assert update[0]['params']['id'] == UUID1


def test_internal_build_complete_by_order_id(internal_lambda, fake_db, monkeypatch):
    monkeypatch.setenv('INTERNAL_API_KEY', 'secret-key')
    fake_db['cursor'].results = [
        {'id': UUID1, 'status': 'building'},
        {'id': UUID1},
    ]
    resp = _call(
        internal_lambda, 'POST', '/internal/build-complete',
        body={'orderId': UUID1},
        headers={'x-api-key': 'secret-key'},
    )
    assert resp['statusCode'] == 200
    assert _body(resp)['data']['status'] == 'live'
    query = fake_db['cursor'].queries[0]
    assert 'WHERE id = %(id)s' in query


def test_internal_build_complete_idempotent_already_live(internal_lambda, fake_db, monkeypatch):
    """A2: already-live is a no-op (no UPDATE, no commit)."""
    monkeypatch.setenv('INTERNAL_API_KEY', 'secret-key')
    fake_db['cursor'].results = [
        {'id': UUID1, 'status': 'live'},
    ]
    resp = _call(
        internal_lambda, 'POST', '/internal/build-complete',
        body={'slug': 'adam-eve'},
        headers={'x-api-key': 'secret-key'},
    )
    assert resp['statusCode'] == 200
    assert _body(resp)['data']['status'] == 'live'
    assert fake_db['cursor'].calls_for('UPDATE public.orders') == []
    assert fake_db['conn'].commits == 0


def test_internal_build_complete_not_found(internal_lambda, fake_db, monkeypatch):
    monkeypatch.setenv('INTERNAL_API_KEY', 'secret-key')
    fake_db['cursor'].results = [None]
    resp = _call(
        internal_lambda, 'POST', '/internal/build-complete',
        body={'slug': 'nope'},
        headers={'x-api-key': 'secret-key'},
    )
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'


def test_internal_build_complete_requires_slug_or_id(internal_lambda, fake_db, monkeypatch):
    monkeypatch.setenv('INTERNAL_API_KEY', 'secret-key')
    resp = _call(
        internal_lambda, 'POST', '/internal/build-complete',
        body={},
        headers={'x-api-key': 'secret-key'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'


# ---------------------------------------------------------------- ToyyibPay callback

def test_toyyibpay_callback_no_api_key_needed(internal_lambda, fake_db, monkeypatch):
    import weddings_module.orders_handler as orders_module
    monkeypatch.setattr(orders_module, 'handle_webhook', lambda payload: 'ord-1')
    resp = _call(
        internal_lambda, 'POST', '/internal/toyyibpay/callback',
        body={'billcode': 'BILL123', 'status': '1', 'order_id': 'ord-1', 'refno': 'R1'},
    )
    assert resp['statusCode'] == 200
    assert _body(resp)['data'] == {'order_id': 'ord-1'}
    # No DB calls from the handler itself (handle_webhook owns its connection).
    assert fake_db['cursor'].calls == []


def test_toyyibpay_callback_parses_form_body(internal_lambda, fake_db, monkeypatch):
    import weddings_module.orders_handler as orders_module
    captured = {}

    def fake_handle(payload):
        captured['payload'] = payload
        return 'ord-1'

    monkeypatch.setattr(orders_module, 'handle_webhook', fake_handle)
    event = {
        'httpMethod': 'POST',
        'path': '/internal/toyyibpay/callback',
        'body': 'billcode=BILL123&status=1&order_id=ord-1&refno=R1&amount=99.00',
    }
    resp = internal_lambda(event, {})
    assert resp['statusCode'] == 200
    assert captured['payload'] == {
        'billcode': 'BILL123', 'status': '1', 'order_id': 'ord-1', 'refno': 'R1', 'amount': '99.00',
    }
