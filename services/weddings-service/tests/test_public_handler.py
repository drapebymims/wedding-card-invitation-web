"""Unit tests for the public Lambda (public_handler.py).

No AWS, no Postgres — `get_connection`/`get_cursor`/`close_connection` are
monkeypatched (see conftest.py `fake_db`) so these tests exercise the real
route dispatch, validation, and SQL shape against a fake cursor.
"""

import json


def _call(handler, method, path, body=None, query=None):
    event = {'httpMethod': method, 'path': path, 'queryStringParameters': query or {}}
    if body is not None:
        event['body'] = json.dumps(body)
    return handler(event, {})


def _body(response):
    return json.loads(response['body'])


# ---------------------------------------------------------------- health

def test_public_health(public_lambda, fake_db):
    resp = _call(public_lambda, 'GET', '/public/health')
    assert resp['statusCode'] == 200
    assert _body(resp) == {'success': True, 'data': {'status': 'ok'}, 'error': None}
    assert fake_db['cursor'].calls == []
    assert fake_db['conn'].commits == 0


# ---------------------------------------------------------------- rsvps

def test_rsvp_missing_fields(public_lambda, fake_db):
    resp = _call(public_lambda, 'POST', '/public/rsvps', body={})
    assert resp['statusCode'] == 400
    body = _body(resp)
    assert body['success'] is False
    assert body['error']['code'] == 'VALIDATION_ERROR'
    # validation must fail before any SQL runs
    assert fake_db['cursor'].calls == []
    assert fake_db['conn'].commits == 0


def test_rsvp_malformed_json_body(public_lambda, fake_db):
    event = {'httpMethod': 'POST', 'path': '/public/rsvps', 'body': 'not-json'}
    resp = public_lambda(event, {})
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'


def test_rsvp_bad_attendance(public_lambda, fake_db):
    resp = _call(
        public_lambda, 'POST', '/public/rsvps',
        body={'coupleSlug': 'bride-groom', 'guestName': 'Jane', 'attendance': 'maybe'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


def test_rsvp_blank_required_field(public_lambda, fake_db):
    resp = _call(
        public_lambda, 'POST', '/public/rsvps',
        body={'coupleSlug': '   ', 'guestName': 'Jane', 'attendance': 'yes'},
    )
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'


def test_rsvp_invalid_guests_count(public_lambda, fake_db):
    for bad in ('abc', 0, -2):
        resp = _call(
            public_lambda, 'POST', '/public/rsvps',
            body={'coupleSlug': 'bride-groom', 'guestName': 'Jane',
                  'attendance': 'yes', 'guestsCount': bad},
        )
        assert resp['statusCode'] == 400
        assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


def test_rsvp_valid_insert(public_lambda, fake_db):
    fake_db['cursor'].results = [{'id': 7}]
    resp = _call(
        public_lambda, 'POST', '/public/rsvps',
        body={'coupleSlug': 'bride-groom', 'guestName': 'Jane', 'attendance': 'yes',
              'guestsCount': 3, 'dietary': 'vegetarian', 'message': 'Can\'t wait!'},
    )
    assert resp['statusCode'] == 201
    body = _body(resp)
    assert body['success'] is True
    assert body['data'] == {'id': 7}
    assert fake_db['conn'].commits == 1

    insert = fake_db['cursor'].calls_for('INSERT INTO public.rsvps')
    assert len(insert) == 1
    params = insert[0]['params']
    assert params['couple_slug'] == 'bride-groom'
    assert params['guest_name'] == 'Jane'
    assert params['attendance'] == 'yes'
    assert params['guests_count'] == 3
    assert params['dietary'] == 'vegetarian'
    assert params['phone'] is None        # optional, omitted -> NULL
    assert params['message'] == "Can't wait!"
    assert '%' in insert[0]['query']      # parameterized, not f-string'd input


def test_rsvp_defaults_guests_count_to_one(public_lambda, fake_db):
    fake_db['cursor'].results = [{'id': 8}]
    resp = _call(
        public_lambda, 'POST', '/public/rsvps',
        body={'coupleSlug': 'bride-groom', 'guestName': 'Jane', 'attendance': 'no'},
    )
    assert resp['statusCode'] == 201
    params = fake_db['cursor'].calls_for('INSERT INTO public.rsvps')[0]['params']
    assert params['guests_count'] == 1


# ---------------------------------------------------------------- wishes

def test_wishes_post_creates_unapproved(public_lambda, fake_db):
    fake_db['cursor'].results = [{'id': 42}]
    resp = _call(
        public_lambda, 'POST', '/public/wishes',
        body={'coupleSlug': 'bride-groom', 'name': 'Auntie', 'message': 'Best wishes!'},
    )
    assert resp['statusCode'] == 201
    assert _body(resp)['data'] == {'id': 42}
    assert fake_db['conn'].commits == 1

    insert = fake_db['cursor'].calls_for('INSERT INTO public.wishes')
    assert len(insert) == 1
    params = insert[0]['params']
    assert params == {'couple_slug': 'bride-groom', 'name': 'Auntie', 'message': 'Best wishes!'}
    # approved is NOT set -> DB default FALSE (moderated by admin)
    assert 'approved' not in params


def test_wishes_post_missing_fields(public_lambda, fake_db):
    resp = _call(public_lambda, 'POST', '/public/wishes', body={'coupleSlug': 'x'})
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


def test_wishes_get_approved_only_paginated(public_lambda, fake_db):
    fake_db['cursor'].results = [
        {'total': 3},
        [{'id': 2, 'name': 'Newest'}, {'id': 1, 'name': 'Older'}],
    ]
    resp = _call(
        public_lambda, 'GET', '/public/wishes',
        query={'coupleSlug': 'bride-groom', 'page': '2', 'perPage': '10'},
    )
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['success'] is True
    assert body['pagination'] == {'page': 2, 'items_per_page': 10, 'total': 3, 'total_pages': 1}
    assert len(body['data']) == 2

    queries = fake_db['cursor'].queries
    assert len(queries) == 2
    # count query first
    assert 'SELECT COUNT(*)::int AS total' in queries[0]
    assert 'approved = TRUE' in queries[0]
    # data query: approved only, newest first, parameterized pagination
    assert 'approved = TRUE' in queries[1]
    assert 'ORDER BY created_at DESC' in queries[1]
    assert 'LIMIT %(limit)s' in queries[1] and 'OFFSET %(offset)s' in queries[1]
    params = fake_db['cursor'].calls[1]['params']
    assert params['couple_slug'] == 'bride-groom'
    assert params['limit'] == 10
    assert params['offset'] == 10


def test_wishes_get_requires_couple_slug(public_lambda, fake_db):
    resp = _call(public_lambda, 'GET', '/public/wishes', query={})
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


# ---------------------------------------------------------------- gifts

def test_gifts_post_with_and_without_item(public_lambda, fake_db):
    fake_db['cursor'].results = [{'id': 9}]
    resp = _call(
        public_lambda, 'POST', '/public/gifts',
        body={'coupleSlug': 'bride-groom', 'name': 'Uncle', 'message': 'A little something',
              'item': 'Vase'},
    )
    assert resp['statusCode'] == 201
    assert _body(resp)['data'] == {'id': 9}
    assert fake_db['conn'].commits == 1
    params = fake_db['cursor'].calls_for('INSERT INTO public.gifts')[0]['params']
    assert params['item'] == 'Vase'
    assert 'approved' not in params  # DB default FALSE

    # item omitted -> None (NULL column)
    fake_db['cursor'].calls.clear()
    fake_db['cursor'].results = [{'id': 10}]
    resp = _call(
        public_lambda, 'POST', '/public/gifts',
        body={'coupleSlug': 'bride-groom', 'name': 'Uncle', 'message': 'Congrats'},
    )
    assert resp['statusCode'] == 201
    params = fake_db['cursor'].calls_for('INSERT INTO public.gifts')[0]['params']
    assert params['item'] is None


def test_gifts_get_approved_only(public_lambda, fake_db):
    fake_db['cursor'].results = [[{'id': 1, 'item': 'Vase', 'approved': True}]]
    resp = _call(public_lambda, 'GET', '/public/gifts', query={'coupleSlug': 'bride-groom'})
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['success'] is True
    assert body['data'] == [{'id': 1, 'item': 'Vase', 'approved': True}]
    query = fake_db['cursor'].queries[0]
    assert 'FROM public.gifts' in query
    assert 'approved = TRUE' in query


# ---------------------------------------------------------------- routing

def test_unknown_route_returns_404(public_lambda, fake_db):
    resp = _call(public_lambda, 'GET', '/public/nope')
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'
    assert fake_db['cursor'].calls == []


def test_trailing_slash_still_routes(public_lambda, fake_db):
    fake_db['cursor'].results = [{'id': 1}]
    resp = _call(public_lambda, 'POST', '/public/rsvps/',
                 body={'coupleSlug': 's', 'guestName': 'n', 'attendance': 'yes'})
    assert resp['statusCode'] == 201
