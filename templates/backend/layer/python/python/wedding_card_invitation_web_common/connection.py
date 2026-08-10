"""Database connection lifecycle. Reads credentials from Secrets Manager.

Lambda containers are reused, so we cache the connection per container
(module-level). Warm invocations reuse it instead of opening a new Postgres
connection — this prevents exhausting RDS max_connections (~66 on t4g.micro)
under burst load, which previously caused 500s and baked 404 pages.
"""

import json
import logging
import os
import threading

logger = logging.getLogger(__name__)

# Cache per container. Lambda runs one event at a time per container, so a
# single shared connection is safe. Thread-local keeps it safe if a container
# ever runs concurrent events.
_local = threading.local()


def _get_secret(secret_name):
    import boto3
    client = boto3.client('secretsmanager', region_name=os.environ.get('AWS_REGION', 'ap-southeast-1'))
    try:
        return json.loads(client.get_secret_value(SecretId=secret_name)['SecretString'])
    except Exception as e:
        logger.error(f'Failed to fetch secret {secret_name}: {e}')
        raise


def get_connection(secret_name=None):
    """Get a DB connection, reusing the cached one for warm containers."""
    if secret_name is None:
        secret_name = os.environ.get('GETDB_CONNECTION')
    if not secret_name:
        raise ValueError('GETDB_CONNECTION environment variable is not set')

    cached = getattr(_local, 'conn', None)
    if cached is not None:
        try:
            if not cached.closed:
                return cached
        except Exception:
            pass
        _local.conn = None

    import psycopg2
    creds = _get_secret(secret_name)
    conn = psycopg2.connect(
        host=creds.get('host'), port=creds.get('port', 5432),
        user=creds.get('username'), password=creds.get('password'),
        dbname=creds.get('dbname'),
    )
    # Reuse for subsequent invocations in this container
    _local.conn = conn
    return conn


def get_cursor(connection):
    from psycopg2.extras import RealDictCursor
    return connection.cursor(cursor_factory=RealDictCursor)


def close_connection(connection, cursor=None):
    """Release the cursor, but KEEP the cached connection open for reuse.

    Only the container shutdown path closes it; handlers call this in finally
    after every request, so we must not actually close the cached conn.
    """
    try:
        if cursor is not None:
            cursor.close()
    except Exception as e:
        logger.debug(f'Error closing cursor: {e}')
    try:
        # Roll back any open transaction so the cached connection is clean.
        connection.rollback()
    except Exception:
        pass
