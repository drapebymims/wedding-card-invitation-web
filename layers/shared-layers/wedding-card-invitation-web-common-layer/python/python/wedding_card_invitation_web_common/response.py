import json

from .serializer import FMSJSONEncoder


def _headers():
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    }


def _error(code, message, details=None, status_code=400):
    err = {'code': code, 'message': message}
    if details:
        err['details'] = details
    return {
        'statusCode': status_code,
        'headers': _headers(),
        'body': json.dumps({'success': False, 'error': err, 'data': None}, cls=FMSJSONEncoder),
    }


def success(data, meta=None, status_code=200):
    body = {'success': True, 'data': data, 'error': None}
    if meta:
        body['meta'] = meta
    return {'statusCode': status_code, 'headers': _headers(), 'body': json.dumps(body, cls=FMSJSONEncoder)}


def created(data, meta=None):
    return success(data, meta, status_code=201)


def paginated(data, page, items_per_page, total, meta=None):
    total_pages = max(1, (total + items_per_page - 1) // items_per_page) if items_per_page else 1
    body = {
        'success': True, 'data': data, 'error': None,
        'pagination': {'page': page, 'items_per_page': items_per_page, 'total': total, 'total_pages': total_pages},
    }
    if meta:
        body['meta'] = meta
    return {'statusCode': 200, 'headers': _headers(), 'body': json.dumps(body, cls=FMSJSONEncoder)}


def validation_error(message, details=None):
    return _error('VALIDATION_ERROR', message, details, 400)


def not_found(message='Resource not found', details=None):
    return _error('NOT_FOUND', message, details, 404)


def unauthorized(message='Unauthorized', details=None):
    return _error('UNAUTHORIZED', message, details, 401)


def forbidden(message='Forbidden', details=None):
    return _error('FORBIDDEN', message, details, 403)


def conflict(message='Resource conflict', details=None):
    return _error('CONFLICT', message, details, 409)


def internal_error(message='Internal server error', details=None):
    return _error('INTERNAL_ERROR', message, details, 500)


def timeout(message='External service timeout', details=None):
    return _error('TIMEOUT', message, details, 504)
