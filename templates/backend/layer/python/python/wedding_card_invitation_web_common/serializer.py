import json
from datetime import date, datetime
from decimal import Decimal


class FMSJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, bytes):
            return obj.decode('utf-8', errors='replace')
        return super().default(obj)


def json_dumps(data):
    return json.dumps(data, cls=FMSJSONEncoder)
