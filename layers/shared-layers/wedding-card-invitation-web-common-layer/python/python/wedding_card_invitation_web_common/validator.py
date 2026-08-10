def require_params(params, required):
    missing = [k for k in required if not params.get(k)]
    return (len(missing) == 0, missing)


def safe_sort(sort_key, whitelist, default='created_at'):
    return sort_key if sort_key in whitelist else default


def safe_order(order, default='DESC'):
    return order if order and order.upper() in ('ASC', 'DESC') else default


def parse_int(value, default=1):
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


def parse_pagination(params):
    page = parse_int(params.get('page'), 1)
    per_page = parse_int(params.get('perPage') or params.get('items_per_page'), 20)
    return page, per_page
