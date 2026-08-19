"""Unit tests for the ToyyibPay integration (toyyibpay.py).

Hermetic: `requests.post` is monkeypatched (no real HTTP) and the DB helpers are
monkeypatched via conftest fake_db. Covers create_bill (sanitize + cents +
error handling), verify_bill (status + amount reconcile), and handle_webhook
(hash validation, getBillTransactions re-check, idempotency).
"""

import pytest

import weddings_module.toyyibpay as tp


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setenv('TOYYIBPAY_USER_SECRET_KEY', 'secret')
    monkeypatch.setenv('TOYYIBPAY_CATEGORY_CODE', 'cat-1')
    monkeypatch.setenv('TOYYIBPAY_BASE_URL', 'https://dev.toyyibpay.com')


def _fake_post(monkeypatch, result):
    captured = {}

    def fake_post(url, data=None, timeout=None):
        captured['url'] = url
        captured['data'] = data
        return result

    monkeypatch.setattr(tp.requests, 'post', fake_post)
    return captured


class _Resp:
    def __init__(self, payload):
        self._payload = payload

    def json(self):
        return self._payload


# ---------------------------------------------------------------- create_bill

def test_create_bill_success(env, monkeypatch):
    captured = _fake_post(monkeypatch, _Resp([{'BillCode': 'BILL123'}]))
    order = {'id': 'ord-1', 'couple_slug': 'adam-eve', 'price_amount': 99.0}
    bill_code, bill_url = tp.create_bill(order, 'https://x/w/adam-eve?thanks=1', 'https://api/internal/toyyibpay/callback')

    assert bill_code == 'BILL123'
    assert bill_url == 'https://dev.toyyibpay.com/BILL123'
    assert captured['url'] == 'https://dev.toyyibpay.com/index.php/api/createBill'
    data = captured['data']
    assert data['userSecretKey'] == 'secret'
    assert data['categoryCode'] == 'cat-1'
    assert data['billAmount'] == 9900          # 99.00 MYR -> 9900 cents
    assert data['billExternalReferenceNo'] == 'ord-1'
    assert data['billPaymentChannel'] == 2
    assert data['billPriceSetting'] == 1
    assert data['billCallbackUrl'] == 'https://api/internal/toyyibpay/callback'


def test_create_bill_sanitizes_text(env, monkeypatch):
    captured = _fake_post(monkeypatch, _Resp([{'BillCode': 'B'}]))
    order = {
        'id': 'ord-1', 'couple_slug': 'adam-eve', 'price_amount': 10.0,
        'bill_name': 'Wedding & Party / 2026!', 'bill_description': 'x' * 200,
    }
    tp.create_bill(order, 'https://x', 'https://y')
    data = captured['data']
    # slashes/ampersands stripped (replaced by spaces, then collapsed), capped at 30 / 100 chars
    assert data['billName'] == 'Wedding Party 2026'
    assert len(data['billDescription']) == 100


def test_create_bill_error_response(env, monkeypatch):
    _fake_post(monkeypatch, _Resp({'status': 'error', 'msg': 'Invalid category'}))
    with pytest.raises(tp.ToyyibPayError):
        tp.create_bill({'id': 'ord-1', 'price_amount': 10.0}, 'https://x', 'https://y')


def test_create_bill_not_configured(monkeypatch):
    monkeypatch.delenv('TOYYIBPAY_USER_SECRET_KEY', raising=False)
    monkeypatch.delenv('TOYYIBPAY_CATEGORY_CODE', raising=False)
    with pytest.raises(tp.ToyyibPayNotConfigured):
        tp.create_bill({'id': 'ord-1', 'price_amount': 10.0}, 'https://x', 'https://y')


# ---------------------------------------------------------------- verify_bill

def test_verify_bill_paid(env, monkeypatch):
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '1', 'billpaymentAmount': '99.00'}]))
    assert tp.verify_bill('BILL123', expected_amount=99.0) is True


def test_verify_bill_pending(env, monkeypatch):
    # 2 and 4 are both pending — must NOT be treated as paid.
    for status in ('2', '4'):
        _fake_post(monkeypatch, _Resp([{'billpaymentStatus': status, 'billpaymentAmount': '99.00'}]))
        assert tp.verify_bill('BILL123', expected_amount=99.0) is False


def test_verify_bill_failed(env, monkeypatch):
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '3', 'billpaymentAmount': '99.00'}]))
    assert tp.verify_bill('BILL123') is False


def test_verify_bill_amount_mismatch(env, monkeypatch):
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '1', 'billpaymentAmount': '50.00'}]))
    assert tp.verify_bill('BILL123', expected_amount=99.0) is False


def test_verify_bill_error_response(env, monkeypatch):
    _fake_post(monkeypatch, _Resp({'status': 'error'}))
    assert tp.verify_bill('BILL123') is False


# ---------------------------------------------------------------- handle_webhook

def test_handle_webhook_marks_paid(env, fake_db, monkeypatch):
    fake_db['cursor'].results = [
        {'id': 'ord-1', 'couple_slug': 'adam-eve', 'price_amount': '99.00', 'status': 'awaiting_payment'},  # SELECT order
        {'id': 'ord-1'},                                                          # UPDATE RETURNING (paid)
        {'id': 'ord-1'},                                                          # UPDATE RETURNING (building)
    ]
    # getBillTransactions returns paid + matching amount
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '1', 'billpaymentAmount': '99.00'}]))
    # Build trigger succeeds -> order moves paid -> building.
    monkeypatch.setattr(tp, '_trigger_amplify_build', lambda order_id, slug: True)
    payload = {'billcode': 'BILL123', 'status': '1', 'order_id': 'ord-1', 'refno': 'R1'}
    result = tp.handle_webhook(payload)
    assert result == 'ord-1'
    assert fake_db['conn'].commits == 2  # paid commit + building commit

    updates = fake_db['cursor'].calls_for('UPDATE public.orders')
    assert len(updates) == 2
    assert "status = 'paid'" in updates[0]['query']
    assert "live_until = now() + interval '1 year'" in updates[0]['query']
    assert "edit_until = now() + interval '6 months'" in updates[0]['query']
    assert "status = 'building'" in updates[1]['query']


def test_handle_webhook_triggers_build_once(env, fake_db, monkeypatch):
    """A1: build fires once on the unpaid->paid transition, not on re-delivery."""
    triggered = {'n': 0}

    def fake_trigger(order_id, slug):
        triggered['n'] += 1
        return True

    monkeypatch.setattr(tp, '_trigger_amplify_build', fake_trigger)
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '1', 'billpaymentAmount': '99.00'}]))

    # First callback: awaiting_payment -> paid -> building, build fires once.
    fake_db['cursor'].results = [
        {'id': 'ord-1', 'couple_slug': 'adam-eve', 'price_amount': '99.00', 'status': 'awaiting_payment'},
        {'id': 'ord-1'},
        {'id': 'ord-1'},
    ]
    assert tp.handle_webhook({'billcode': 'BILL123'}) == 'ord-1'
    assert triggered['n'] == 1

    # Re-delivered callback: status is now 'building' -> no-op, no build.
    fake_db['cursor'].results = [
        {'id': 'ord-1', 'couple_slug': 'adam-eve', 'price_amount': '99.00', 'status': 'building'},
    ]
    assert tp.handle_webhook({'billcode': 'BILL123'}) == 'ord-1'
    assert triggered['n'] == 1  # still 1 — not re-triggered


def test_handle_webhook_build_failure_keeps_paid(env, fake_db, monkeypatch):
    """A1: a failed build trigger does NOT fail the webhook; order stays paid."""
    monkeypatch.setattr(tp, '_trigger_amplify_build', lambda order_id, slug: False)
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '1', 'billpaymentAmount': '99.00'}]))
    fake_db['cursor'].results = [
        {'id': 'ord-1', 'couple_slug': 'adam-eve', 'price_amount': '99.00', 'status': 'awaiting_payment'},
        {'id': 'ord-1'},
    ]
    result = tp.handle_webhook({'billcode': 'BILL123'})
    assert result == 'ord-1'  # webhook still succeeds
    assert fake_db['conn'].commits == 1  # only the paid commit
    updates = fake_db['cursor'].calls_for('UPDATE public.orders')
    assert len(updates) == 1
    assert "status = 'paid'" in updates[0]['query']  # no building transition


def test_handle_webhook_idempotent_already_paid(env, fake_db, monkeypatch):
    fake_db['cursor'].results = [
        {'id': 'ord-1', 'price_amount': '99.00', 'status': 'paid'},  # already paid
    ]
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '1', 'billpaymentAmount': '99.00'}]))
    result = tp.handle_webhook({'billcode': 'BILL123'})
    assert result == 'ord-1'
    # No UPDATE issued, no commit.
    assert fake_db['cursor'].calls_for('UPDATE public.orders') == []
    assert fake_db['conn'].commits == 0


def test_handle_webhook_not_verified(env, fake_db, monkeypatch):
    # getBillTransactions says pending -> do not mark paid.
    fake_db['cursor'].results = [
        {'id': 'ord-1', 'price_amount': '99.00', 'status': 'awaiting_payment'},
    ]
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '2', 'billpaymentAmount': '99.00'}]))
    result = tp.handle_webhook({'billcode': 'BILL123'})
    assert result is None
    assert fake_db['cursor'].calls_for('UPDATE public.orders') == []
    assert fake_db['conn'].commits == 0


def test_handle_webhook_unknown_bill(env, fake_db, monkeypatch):
    fake_db['cursor'].results = [None]  # no matching order
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '1', 'billpaymentAmount': '99.00'}]))
    result = tp.handle_webhook({'billcode': 'UNKNOWN'})
    assert result is None


def test_handle_webhook_missing_billcode(env, fake_db):
    assert tp.handle_webhook({}) is None
    assert fake_db['cursor'].calls == []


def test_handle_webhook_bad_hash(env, fake_db, monkeypatch):
    fake_db['cursor'].results = [
        {'id': 'ord-1', 'price_amount': '99.00', 'status': 'awaiting_payment'},
    ]
    _fake_post(monkeypatch, _Resp([{'billpaymentStatus': '1', 'billpaymentAmount': '99.00'}]))
    payload = {'billcode': 'BILL123', 'status': '1', 'order_id': 'ord-1', 'refno': 'R1', 'hash': 'deadbeef'}
    result = tp.handle_webhook(payload)
    assert result is None
    assert fake_db['cursor'].calls_for('UPDATE public.orders') == []
