"""Unit tests for the authenticated admin Lambda (handler.py).

Same hermetic setup as the public tests: DB helpers are monkeypatched, so
these tests cover route dispatch (incl. {id} parsing with/without trailing
slash), validation, SQL shape, commit behaviour, and 404s for missing rows.
"""

import json


def _call(handler, method, path, body=None, query=None, claims=None):
    event = {'httpMethod': method, 'path': path, 'queryStringParameters': query or {}}
    if body is not None:
        event['body'] = json.dumps(body)
    # Default to platform-staff claims so existing tests exercise the full-access
    # path; pass explicit claims to test per-couple scoping.
    event['requestContext'] = {
        'authorizer': {'claims': claims or {'sub': 'staff-sub', 'cognito:groups': 'admin'}},
    }
    return handler(event, {})


def _body(response):
    return json.loads(response['body'])


# ---------------------------------------------------------------- health

def test_admin_health(admin_lambda, fake_db):
    resp = _call(admin_lambda, 'GET', '/admin/health')
    assert resp['statusCode'] == 200
    assert _body(resp) == {'success': True, 'data': {'status': 'ok'}, 'error': None}
    assert fake_db['cursor'].calls == []


# ---------------------------------------------------------------- rsvps list

def test_admin_rsvps_paginated_with_attendance_filter(admin_lambda, fake_db):
    fake_db['cursor'].results = [
        {'total': 1},
        [{'id': 1, 'guest_name': 'Jane', 'attendance': 'yes'}],
    ]
    resp = _call(
        admin_lambda, 'GET', '/admin/rsvps',
        query={'coupleSlug': 'bride-groom', 'attendance': 'yes', 'page': '2', 'perPage': '5'},
    )
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['pagination'] == {'page': 2, 'items_per_page': 5, 'total': 1, 'total_pages': 1}
    assert len(body['data']) == 1

    count_call, list_call = fake_db['cursor'].calls
    assert 'FROM public.rsvps' in count_call['query']
    assert 'AND attendance = %(attendance)s' in count_call['query']
    assert count_call['params'] == {'couple_slug': 'bride-groom', 'attendance': 'yes'}
    assert 'ORDER BY created_at DESC' in list_call['query']
    assert 'LIMIT %(limit)s' in list_call['query'] and 'OFFSET %(offset)s' in list_call['query']
    assert list_call['params']['couple_slug'] == 'bride-groom'
    assert list_call['params']['attendance'] == 'yes'
    assert list_call['params']['limit'] == 5
    assert list_call['params']['offset'] == 5


def test_admin_rsvps_requires_couple_slug(admin_lambda, fake_db):
    resp = _call(admin_lambda, 'GET', '/admin/rsvps', query={})
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


def test_admin_rsvps_rejects_bad_attendance(admin_lambda, fake_db):
    resp = _call(admin_lambda, 'GET', '/admin/rsvps',
                 query={'coupleSlug': 'bride-groom', 'attendance': 'maybe'})
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


# ---------------------------------------------------------------- rsvps stats

def test_admin_rsvps_stats_query_shape(admin_lambda, fake_db):
    fake_db['cursor'].results = [
        {'total': 5, 'confirmed': 3, 'declined': 2, 'guests': 6},
        {'total': 4},
    ]
    resp = _call(admin_lambda, 'GET', '/admin/rsvps/stats', query={'coupleSlug': 'bride-groom'})
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['success'] is True
    assert body['data'] == {
        'total': 5, 'confirmed': 3, 'declined': 2, 'guests': 6, 'pending_wishes': 4,
    }

    rsvp_query, wishes_query = fake_db['cursor'].queries
    assert 'FROM public.rsvps' in rsvp_query
    assert "FILTER (WHERE attendance = 'yes')" in rsvp_query
    assert "FILTER (WHERE attendance = 'no')" in rsvp_query
    assert rsvp_query.count('%(couple_slug)s') == 1
    assert 'FROM public.wishes' in wishes_query
    assert 'approved = FALSE' in wishes_query
    assert fake_db['cursor'].calls[1]['params'] == {'couple_slug': 'bride-groom'}


def test_admin_rsvps_stats_requires_couple_slug(admin_lambda, fake_db):
    resp = _call(admin_lambda, 'GET', '/admin/rsvps/stats', query={})
    assert resp['statusCode'] == 400
    assert fake_db['cursor'].calls == []


# ---------------------------------------------------------------- wishes list

def test_admin_wishes_default_pending(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'total': 1}, [{'id': 1, 'approved': False}]]
    resp = _call(admin_lambda, 'GET', '/admin/wishes', query={'coupleSlug': 'bride-groom'})
    assert resp['statusCode'] == 200
    assert _body(resp)['pagination']['total'] == 1
    count_query, list_query = fake_db['cursor'].queries
    assert 'approved = FALSE' in count_query
    assert 'approved = FALSE' in list_query
    assert 'ORDER BY created_at DESC' in list_query


def test_admin_wishes_status_filters(admin_lambda, fake_db):
    for status, clause in (('approved', 'approved = TRUE'), ('all', None)):
        fake_db['cursor'].calls.clear()
        fake_db['cursor'].results = [{'total': 0}, []]
        resp = _call(admin_lambda, 'GET', '/admin/wishes',
                     query={'coupleSlug': 'bride-groom', 'status': status})
        assert resp['statusCode'] == 200
        list_query = fake_db['cursor'].queries[1]
        if clause:
            assert clause in list_query
        else:
            # 'all' -> no approval filter in the WHERE clause (the column still
            # appears in the SELECT list, so assert on the filter fragments only)
            assert 'approved = TRUE' not in list_query
            assert 'approved = FALSE' not in list_query


def test_admin_wishes_rejects_bad_status(admin_lambda, fake_db):
    resp = _call(admin_lambda, 'GET', '/admin/wishes',
                 query={'coupleSlug': 'bride-groom', 'status': 'spam'})
    assert resp['statusCode'] == 400
    assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


# ---------------------------------------------------------------- wish moderation

def test_admin_wishes_patch_approve(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'couple_slug': 'bride-groom'}, {'id': 7, 'approved': True}]
    resp = _call(admin_lambda, 'PATCH', '/admin/wishes/7', body={'approved': True})
    assert resp['statusCode'] == 200
    assert _body(resp)['data'] == {'id': 7, 'approved': True}
    assert fake_db['conn'].commits == 1

    call = fake_db['cursor'].calls_for('UPDATE public.wishes')
    assert len(call) == 1
    assert call[0]['params'] == {'approved': True, 'id': 7}
    assert 'WHERE id = %(id)s' in call[0]['query']


def test_admin_wishes_patch_trailing_slash(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'couple_slug': 'bride-groom'}, {'id': 7, 'approved': False}]
    resp = _call(admin_lambda, 'PATCH', '/admin/wishes/7/', body={'approved': False})
    assert resp['statusCode'] == 200
    assert _body(resp)['data'] == {'id': 7, 'approved': False}


def test_admin_wishes_patch_missing_id_returns_404(admin_lambda, fake_db):
    fake_db['cursor'].results = []            # UPDATE ... RETURNING matched no row
    resp = _call(admin_lambda, 'PATCH', '/admin/wishes/999', body={'approved': True})
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'
    assert fake_db['conn'].commits == 0


def test_admin_wishes_patch_invalid_body(admin_lambda, fake_db):
    for bad in ('yes', 1, None, {}):
        resp = _call(admin_lambda, 'PATCH', '/admin/wishes/7', body={'approved': bad})
        assert resp['statusCode'] == 400
        assert _body(resp)['error']['code'] == 'VALIDATION_ERROR'
    assert fake_db['cursor'].calls == []


def test_admin_wishes_patch_non_numeric_id(admin_lambda, fake_db):
    resp = _call(admin_lambda, 'PATCH', '/admin/wishes/abc', body={'approved': True})
    assert resp['statusCode'] == 404
    assert fake_db['cursor'].calls == []


def test_admin_wishes_delete(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'couple_slug': 'bride-groom'}, {'id': 7}]
    resp = _call(admin_lambda, 'DELETE', '/admin/wishes/7')
    assert resp['statusCode'] == 200
    assert _body(resp)['data'] == {'id': 7}
    assert fake_db['conn'].commits == 1
    call = fake_db['cursor'].calls_for('DELETE FROM public.wishes')
    assert call[0]['params'] == {'id': 7}


def test_admin_wishes_delete_missing_returns_404(admin_lambda, fake_db):
    fake_db['cursor'].results = []
    resp = _call(admin_lambda, 'DELETE', '/admin/wishes/999')
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'
    assert fake_db['conn'].commits == 0


# ---------------------------------------------------------------- gifts

def test_admin_gifts_paginated(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'total': 2}, [{'id': 1}, {'id': 2}]]
    resp = _call(admin_lambda, 'GET', '/admin/gifts', query={'coupleSlug': 'bride-groom'})
    assert resp['statusCode'] == 200
    body = _body(resp)
    assert body['pagination']['total'] == 2
    assert len(body['data']) == 2
    queries = fake_db['cursor'].queries
    assert 'FROM public.gifts' in queries[0]
    assert 'FROM public.gifts' in queries[1]
    assert 'ORDER BY created_at DESC' in queries[1]


def test_admin_gifts_requires_couple_slug(admin_lambda, fake_db):
    resp = _call(admin_lambda, 'GET', '/admin/gifts', query={})
    assert resp['statusCode'] == 400
    assert fake_db['cursor'].calls == []


def test_admin_gifts_delete(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'couple_slug': 'bride-groom'}, {'id': 3}]
    resp = _call(admin_lambda, 'DELETE', '/admin/gifts/3')
    assert resp['statusCode'] == 200
    assert _body(resp)['data'] == {'id': 3}
    assert fake_db['conn'].commits == 1


def test_admin_gifts_delete_missing_returns_404(admin_lambda, fake_db):
    fake_db['cursor'].results = []
    resp = _call(admin_lambda, 'DELETE', '/admin/gifts/404')
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'


# ---------------------------------------------------------------- routing

def test_admin_unknown_route_returns_404(admin_lambda, fake_db):
    resp = _call(admin_lambda, 'GET', '/admin/nope')
    assert resp['statusCode'] == 404
    assert _body(resp)['error']['code'] == 'NOT_FOUND'
    assert fake_db['cursor'].calls == []


# ---------------------------------------------------------------- per-couple scoping

def test_admin_rsvps_forbidden_for_unowned_couple(admin_lambda, fake_db):
    fake_db['cursor'].results = [None]  # ownership lookup finds no orders row
    resp = _call(
        admin_lambda, 'GET', '/admin/rsvps',
        query={'coupleSlug': 'other-couple'},
        claims={'sub': 'couple-sub', 'cognito:groups': 'couple'},
    )
    assert resp['statusCode'] == 403
    assert _body(resp)['error']['code'] == 'FORBIDDEN'
    # only the ownership query ran — no data query leaked
    assert len(fake_db['cursor'].calls) == 1
    assert 'FROM public.orders' in fake_db['cursor'].queries[0]
    assert fake_db['cursor'].calls[0]['params'] == {'owner_sub': 'couple-sub', 'couple_slug': 'other-couple'}


def test_admin_rsvps_allowed_for_owned_couple(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'owner_sub': 'couple-sub'}, {'total': 1}, [{'id': 1}]]
    resp = _call(
        admin_lambda, 'GET', '/admin/rsvps',
        query={'coupleSlug': 'my-couple'},
        claims={'sub': 'couple-sub', 'cognito:groups': 'couple'},
    )
    assert resp['statusCode'] == 200
    assert _body(resp)['success'] is True
    assert fake_db['cursor'].calls[0]['params'] == {'owner_sub': 'couple-sub', 'couple_slug': 'my-couple'}


def test_admin_rsvps_forbidden_when_sub_missing(admin_lambda, fake_db):
    resp = _call(
        admin_lambda, 'GET', '/admin/rsvps',
        query={'coupleSlug': 'my-couple'},
        claims={'cognito:groups': 'couple'},  # no sub claim
    )
    assert resp['statusCode'] == 403
    assert _body(resp)['error']['code'] == 'FORBIDDEN'
    assert fake_db['cursor'].calls == []


def test_admin_platform_staff_bypasses_ownership(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'total': 0}, []]
    resp = _call(
        admin_lambda, 'GET', '/admin/wishes',
        query={'coupleSlug': 'any-couple'},
        claims={'sub': 'staff-sub', 'cognito:groups': 'admin'},
    )
    assert resp['statusCode'] == 200
    # platform staff never hit the orders table
    assert all('FROM public.orders' not in q for q in fake_db['cursor'].queries)


def test_admin_wishes_patch_forbidden_for_unowned(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'couple_slug': 'other-couple'}, None]
    resp = _call(
        admin_lambda, 'PATCH', '/admin/wishes/7', body={'approved': True},
        claims={'sub': 'couple-sub', 'cognito:groups': 'couple'},
    )
    assert resp['statusCode'] == 403
    assert _body(resp)['error']['code'] == 'FORBIDDEN'
    assert fake_db['conn'].commits == 0
    assert fake_db['cursor'].calls_for('UPDATE public.wishes') == []


def test_admin_gifts_delete_forbidden_for_unowned(admin_lambda, fake_db):
    fake_db['cursor'].results = [{'couple_slug': 'other-couple'}, None]
    resp = _call(
        admin_lambda, 'DELETE', '/admin/gifts/3',
        claims={'sub': 'couple-sub', 'cognito:groups': 'couple'},
    )
    assert resp['statusCode'] == 403
    assert _body(resp)['error']['code'] == 'FORBIDDEN'
    assert fake_db['conn'].commits == 0
    assert fake_db['cursor'].calls_for('DELETE FROM public.gifts') == []
