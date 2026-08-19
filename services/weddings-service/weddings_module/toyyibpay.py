"""ToyyibPay payment integration.

Implements the ToyyibPay API (sandbox https://dev.toyyibpay.com, prod
https://toyyibpay.com) for the couple-facing order checkout flow.

Configuration is read from environment variables at call time (never hardcoded):
  TOYYIBPAY_BASE_URL          default https://dev.toyyibpay.com
  TOYYIBPAY_USER_SECRET_KEY   required for create_bill / verify_bill / handle_webhook
  TOYYIBPAY_CATEGORY_CODE     required for create_bill

Auth: ToyyibPay uses NO headers/bearer — the secret key (and category code) are
passed as form fields. The secret stays server-side only.

Security notes (per the reconciled spec):
  * Never trust the callback alone — always re-query getBillTransactions and
    confirm billpaymentStatus == 1 before marking an order paid.
  * The callback hash is validated IF present (MD5(userSecretKey + status +
    order_id + refno + "ok")), but callbacks can be unsigned/spoofed, so the
    getBillTransactions re-check is the real gate.
  * Idempotent: an unpaid order is only transitioned to paid once.

The three public function signatures are stable — do not change them without
coordinating with the payment lane and the order handlers that call them.
"""

import hashlib
import hmac
import os
import re

import requests

from wedding_card_invitation_web_common import (
    get_connection, get_cursor, close_connection, get_logger,
)

logger = get_logger(__name__)

# Default ToyyibPay sandbox base URL (dev environment).
DEFAULT_BASE_URL = 'https://dev.toyyibpay.com'

# billPaymentChannel: 2 = both FPX + card (per official docs).
_BILL_PAYMENT_CHANNEL = 2
# billExpiryDays for created bills.
_BILL_EXPIRY_DAYS = 30

# Allowed characters for billName / billDescription (alnum + space + underscore).
_BILL_TEXT_RE = re.compile(r'[^A-Za-z0-9 _]')


class ToyyibPayNotConfigured(Exception):
    """Raised when ToyyibPay env config is missing."""


class ToyyibPayError(Exception):
    """Raised when ToyyibPay returns a business error or the request fails."""


def _base_url():
    return os.environ.get('TOYYIBPAY_BASE_URL', DEFAULT_BASE_URL).rstrip('/')


def _require_config():
    secret_key = os.environ.get('TOYYIBPAY_USER_SECRET_KEY', '')
    category_code = os.environ.get('TOYYIBPAY_CATEGORY_CODE', '')
    if not secret_key or not category_code:
        raise ToyyibPayNotConfigured(
            'TOYYIBPAY_USER_SECRET_KEY and TOYYIBPAY_CATEGORY_CODE must be set'
        )
    return secret_key, category_code


def _sanitize_bill_text(value, max_len=100):
    """Restrict to alnum + space + underscore (no slashes/ampersands), cap length."""
    cleaned = _BILL_TEXT_RE.sub(' ', str(value or ''))
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned[:max_len]


def _to_cents(amount):
    """Convert a MYR amount (float/str) to integer cents (100 = RM1)."""
    try:
        return int(round(float(amount) * 100))
    except (TypeError, ValueError):
        raise ToyyibPayError(f'Invalid price_amount: {amount!r}')


def _parse_json(resp):
    try:
        return resp.json()
    except ValueError:
        return {'msg': resp.text}


def _amount_matches(paid, expected):
    """True if a ToyyibPay decimal amount string matches an expected MYR amount."""
    try:
        return abs(float(paid) - float(expected)) < 0.005
    except (TypeError, ValueError):
        return False


def _validate_hash(payload, secret_key):
    """Validate the callback hash IF present. Returns True when absent or valid.

    expected = MD5(userSecretKey + status + order_id + refno + "ok")
    """
    provided = str(payload.get('hash') or '').strip()
    if not provided:
        return True  # hash is optional per spec
    status = str(payload.get('status') or '')
    order_id = str(payload.get('order_id') or '')
    refno = str(payload.get('refno') or '')
    expected = hashlib.md5(
        f'{secret_key}{status}{order_id}{refno}ok'.encode('utf-8')
    ).hexdigest()
    return hmac.compare_digest(provided.lower(), expected.lower())


def _trigger_amplify_build(order_id, couple_slug):
    """Trigger an Amplify build for a paid order (A1).

    Reads AMPLIFY_APP_ID / AMPLIFY_BRANCH (default 'main') from env. Logs loudly
    on failure but does NOT raise — payment is already recorded as paid; the
    build can be retried via the operator's trigger-build.sh.

    Returns True if the build was triggered, False otherwise.
    """
    app_id = os.environ.get('AMPLIFY_APP_ID', '').strip()
    if not app_id:
        logger.error(f'AMPLIFY_APP_ID not set — cannot trigger build for order {order_id}')
        return False
    branch = os.environ.get('AMPLIFY_BRANCH', 'main').strip() or 'main'
    try:
        import boto3
        client = boto3.client('amplify', region_name=os.environ.get('AWS_REGION', 'ap-southeast-1'))
        resp = client.start_job(appId=app_id, branchName=branch, jobType='RELEASE')
        job_id = (resp.get('jobSummary') or {}).get('jobId')
        logger.info(
            f'Triggered Amplify build for order {order_id} (slug={couple_slug}) job={job_id}'
        )
        return True
    except Exception as e:
        logger.error(f'Amplify build trigger failed for order {order_id}: {e}')
        return False


def create_bill(order, return_url, callback_url):
    """Create a ToyyibPay bill for an order.

    Args:
        order: dict with at least {id, couple_slug, price_amount, price_currency}.
            Optional: bill_name, bill_description, bill_to, bill_email, bill_phone.
        return_url: URL the customer is redirected to after payment.
        callback_url: server-side URL ToyyibPay POSTs the payment result to.

    Returns:
        (bill_code, bill_url) — the ToyyibPay bill code and the redirect URL the
        customer should be sent to.

    Raises:
        ToyyibPayNotConfigured: env keys missing.
        ToyyibPayError: ToyyibPay returned an error response.
    """
    secret_key, category_code = _require_config()

    bill_name = _sanitize_bill_text(
        order.get('bill_name') or f"Wedding {order.get('couple_slug', '')}", max_len=30
    )
    bill_description = _sanitize_bill_text(
        order.get('bill_description') or 'Wedding invitation package', max_len=100
    )
    amount_cents = _to_cents(order.get('price_amount'))

    payload = {
        'userSecretKey': secret_key,
        'categoryCode': category_code,
        'billName': bill_name,
        'billDescription': bill_description,
        'billPriceSetting': 1,                       # fixed amount
        'billAmount': amount_cents,                  # integer cents
        'billPayorInfo': 1,
        'billReturnUrl': return_url,
        'billCallbackUrl': callback_url,
        'billExternalReferenceNo': str(order.get('id')),  # idempotency key
        'billTo': _sanitize_bill_text(order.get('bill_to') or order.get('couple_slug') or 'Guest', max_len=100),
        'billEmail': str(order.get('bill_email') or ''),
        'billPhone': str(order.get('bill_phone') or ''),
        'billPaymentChannel': _BILL_PAYMENT_CHANNEL,
        'billExpiryDays': _BILL_EXPIRY_DAYS,
    }

    resp = requests.post(
        f'{_base_url()}/index.php/api/createBill', data=payload, timeout=30
    )
    data = _parse_json(resp)

    # Distinguish success vs error by the presence of BillCode — ToyyibPay
    # returns HTTP 200 even for business errors.
    if isinstance(data, list) and data and data[0].get('BillCode'):
        bill_code = data[0]['BillCode']
        return bill_code, f'{_base_url()}/{bill_code}'

    msg = data.get('msg') if isinstance(data, dict) else str(data)
    logger.error(f'ToyyibPay createBill failed: {msg}')
    raise ToyyibPayError(f'ToyyibPay createBill failed: {msg}')


def verify_bill(bill_code, expected_amount=None):
    """Server-side verification of a ToyyibPay bill's payment status.

    Calls getBillTransactions (the only status endpoint) and returns True iff
    billpaymentStatus == 1 (paid). If expected_amount is provided, also
    reconciles billpaymentAmount against it.

    Args:
        bill_code: the ToyyibPay bill code returned by create_bill.
        expected_amount: optional MYR amount to reconcile against.

    Returns:
        bool — True if the bill is confirmed paid (and amount matches), else False.

    Raises:
        ToyyibPayNotConfigured: env keys missing.
    """
    secret_key, _ = _require_config()

    resp = requests.post(
        f'{_base_url()}/index.php/api/getBillTransactions',
        data={'billCode': bill_code, 'userSecretKey': secret_key},
        timeout=30,
    )
    data = _parse_json(resp)

    if not isinstance(data, list) or not data:
        logger.error(f'ToyyibPay getBillTransactions returned: {data}')
        return False

    tx = data[0]
    # billpaymentStatus: 1=success, 2=pending, 3=unsuccessful, 4=pending.
    # Only 1 counts as paid — never pre-mark paid/failed on 2 or 4.
    if str(tx.get('billpaymentStatus')) != '1':
        return False

    if expected_amount is not None:
        paid = tx.get('billpaymentAmount')
        if not _amount_matches(paid, expected_amount):
            logger.error(f'ToyyibPay amount mismatch: paid={paid} expected={expected_amount}')
            return False

    return True


def handle_webhook(payload):
    """Process a ToyyibPay webhook callback and mark an order paid.

    Parses the callback payload, validates the hash if present, looks up the
    order by bill_code, then re-queries getBillTransactions to confirm the bill
    is actually paid (never trusting the callback alone) and that the amount
    reconciles. If verified and the order is not already paid/building/live, sets
    status='paid', paid_at=now(), live_until=now()+1 year and
    edit_until=now()+6 months, then triggers an Amplify build (A1) and moves the
    order to 'building' on a successful trigger (A2). Idempotent: an already
    paid/building/live order is a no-op and never re-triggers a build.

    Args:
        payload: dict of the form-encoded webhook body from ToyyibPay.

    Returns:
        str — the processed order id, or None if the order was not found or the
        payment could not be verified.
    """
    secret_key, _ = _require_config()

    bill_code = str(payload.get('billcode') or '').strip()
    if not bill_code:
        logger.warning('ToyyibPay callback missing billcode')
        return None

    if not _validate_hash(payload, secret_key):
        logger.error('ToyyibPay callback hash validation failed')
        return None

    conn = get_connection()
    cursor = get_cursor(conn)
    try:
        cursor.execute(
            'SELECT id, couple_slug, price_amount, status FROM public.orders '
            'WHERE bill_code = %(bill_code)s',
            {'bill_code': bill_code},
        )
        row = cursor.fetchone()
        if row is None:
            logger.warning(f'ToyyibPay callback for unknown bill_code={bill_code}')
            return None

        order_id = str(row['id'])
        # Idempotent: if already paid/building/live, no-op (never re-trigger build).
        if row['status'] in ('paid', 'building', 'live'):
            return order_id

        # Never trust the callback alone — re-query ToyyibPay and reconcile amount.
        if not verify_bill(bill_code, expected_amount=row['price_amount']):
            logger.info(f'ToyyibPay bill not verified paid: {bill_code}')
            return None

        cursor.execute(
            '''
            UPDATE public.orders
            SET status = 'paid', paid_at = now(),
                live_until = now() + interval '1 year',
                edit_until = now() + interval '6 months',
                updated_at = now()
            WHERE id = %(id)s AND status IN ('draft', 'awaiting_payment')
            RETURNING id
            ''',
            {'id': row['id']},
        )
        updated = cursor.fetchone()
        conn.commit()

        if updated is None:
            return order_id  # raced with another callback; already transitioned
        logger.info(f'Order {order_id} marked paid via ToyyibPay callback')

        # A1: trigger the build on the unpaid->paid transition only.
        # A2: move to 'building' on a successful trigger; on failure the order
        # stays 'paid' (payment recorded) and can be retried via trigger-build.sh.
        if _trigger_amplify_build(order_id, row['couple_slug']):
            cursor.execute(
                "UPDATE public.orders SET status = 'building', updated_at = now() "
                "WHERE id = %(id)s AND status = 'paid'",
                {'id': row['id']},
            )
            conn.commit()

        return order_id
    finally:
        close_connection(conn, cursor)
