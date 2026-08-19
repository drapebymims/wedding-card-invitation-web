"""Shared pytest fixtures for the weddings-service.

Sets up sys.path so the handlers import cleanly WITHOUT AWS or a database:
  * `services/weddings-service`  -> `weddings_module` package
  * the shared layer's `python/python` dir -> `wedding_card_invitation_web_common`

The `fake_db` fixture monkeypatches `get_connection` / `get_cursor` /
`close_connection` inside both handler modules so every test drives the real
route-dispatch + validation code against a fake cursor that records `execute`
calls and returns canned fetch results.
"""

import json
import os
import sys

import pytest

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
SERVICE_DIR = os.path.dirname(TESTS_DIR)                                   # services/weddings-service
REPO_ROOT = os.path.dirname(os.path.dirname(SERVICE_DIR))                  # repo root
LAYER_DIR = os.path.join(
    REPO_ROOT,
    'layers', 'shared-layers', 'wedding-card-invitation-web-common-layer',
    'python', 'python',
)

for _path in (SERVICE_DIR, LAYER_DIR):
    if _path not in sys.path:
        sys.path.insert(0, _path)


class FakeCursor:
    """In-memory stand-in for a psycopg2 RealDictCursor.

    Records every `execute(query, params)` call on `.calls` and serves canned
    `fetchone()`/`fetchall()` results from `.results` (popped FIFO, so each
    route that runs several queries gets its own canned result in order).
    """

    def __init__(self, results=None):
        self.results = list(results or [])
        self.calls = []          # [{'query': str, 'params': dict|None}, ...]
        self.closed = False

    def execute(self, query, params=None):
        self.calls.append({'query': query, 'params': params})

    def fetchone(self):
        return self.results.pop(0) if self.results else None

    def fetchall(self):
        return self.results.pop(0) if self.results else []

    def close(self):
        self.closed = True

    @property
    def queries(self):
        return [call['query'] for call in self.calls]

    def calls_for(self, fragment):
        return [call for call in self.calls if fragment in call['query']]


class FakeConnection:
    """In-memory stand-in for a psycopg2 connection (tracks commit/rollback)."""

    def __init__(self, cursor):
        self._cursor = cursor
        self.commits = 0
        self.rollbacks = 0

    def cursor(self, cursor_factory=None):
        return self._cursor

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _make_event(method, path, body=None, query=None, claims=None):
    event = {
        'httpMethod': method,
        'path': path,
        'queryStringParameters': query or {},
    }
    if body is not None:
        event['body'] = json.dumps(body)
    if claims:
        event['requestContext'] = {'authorizer': {'claims': claims}}
    return event


@pytest.fixture
def fake_db(monkeypatch):
    """Patch both handlers' DB helpers with a fake connection/cursor."""
    cursor = FakeCursor()
    conn = FakeConnection(cursor)

    def install(module):
        monkeypatch.setattr(module, 'get_connection', lambda: conn)
        monkeypatch.setattr(module, 'get_cursor', lambda connection: cursor)
        monkeypatch.setattr(module, 'close_connection', lambda connection, c=None: None)

    import weddings_module.public_handler as public_module
    import weddings_module.handler as admin_module
    import weddings_module.orders_handler as orders_module
    import weddings_module.toyyibpay as toyyibpay_module

    install(public_module)
    install(admin_module)
    install(orders_module)
    install(toyyibpay_module)
    return {'cursor': cursor, 'conn': conn}


@pytest.fixture
def public_lambda(fake_db):
    import weddings_module.public_handler as public_module
    return public_module.lambda_handler


@pytest.fixture
def admin_lambda(fake_db):
    import weddings_module.handler as admin_module
    return admin_module.lambda_handler


@pytest.fixture
def orders_lambda(fake_db):
    import weddings_module.orders_handler as orders_module
    return orders_module.lambda_handler


@pytest.fixture
def internal_lambda(fake_db):
    import weddings_module.orders_handler as orders_module
    return orders_module.internal_lambda_handler
