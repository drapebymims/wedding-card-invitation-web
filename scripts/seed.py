#!/usr/bin/env python3
"""wedding-card-invitation-web seed template — idempotent, re-runnable seed for your domain data.

Usage:
  SEED_TARGET=local  python3 scripts/seed.py   # local Postgres (DB_HOST etc.)
  SEED_TARGET=live   python3 scripts/seed.py   # RDS via Secrets Manager (GETDB_CONNECTION)

Safe to re-run: every insert is an upsert (ON CONFLICT ... DO UPDATE /
DO NOTHING). Adjust the placeholders in the "YOUR DOMAIN" section before
first use.

NOTE: wedding-card-invitation-web-common-layer and wedding-card-invitation-web_common below are renamed to your project
name by scripts/scaffold-project.sh. If your project name contains a dash,
rename the layer python module to use underscores and match it here.
"""
import importlib
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
logger = logging.getLogger('seed')


def get_connection():
    """Return a live connection: RDS via the shared layer, or local Postgres."""
    target = os.environ.get('SEED_TARGET', 'local')
    if target == 'live':
        # Reuse the shared layer's connection helper. It reads the secret named
        # by GETDB_CONNECTION (e.g. wedding-card-invitation-web-{stage}-db-credentials) from Secrets
        # Manager at runtime — never hardcode credentials.
        sys.path.insert(0, os.path.join(
            os.path.dirname(__file__), '..', 'layers', 'shared-layers',
            'wedding-card-invitation-web-common-layer', 'python', 'python'))
        # The shared-layer module is wedding-card-invitation-web_common (renamed to <name>_common
        # by scaffold-project.sh). Imported dynamically so this template file
        # stays valid Python before scaffolding.
        module_name = os.environ.get('wedding-card-invitation-web_COMMON_MODULE', 'wedding-card-invitation-web_common')
        return importlib.import_module(module_name).get_connection()
    import psycopg2
    return psycopg2.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        port=int(os.environ.get('DB_PORT', '5432')),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD', 'postgres'),
        dbname=os.environ.get('DB_NAME', 'wedding-card-invitation-web'),
    )


# =====================================================================
# YOUR DOMAIN — replace everything below this line with your data model.
#
# The pattern used across projects:
#   * a natural unique key (slug / name / code) drives ON CONFLICT
#   * DO UPDATE refreshes mutable columns, so re-seeding stays in sync
#   * commit once at the end (single transaction)
# =====================================================================

# Example: catalog-style rows keyed by slug. Replace table + columns below.
WIDGETS = [
    {'slug': 'sample-one', 'name': 'Sample One', 'description': 'First sample row', 'sort_order': 1},
    {'slug': 'sample-two', 'name': 'Sample Two', 'description': 'Second sample row', 'sort_order': 2},
]


def seed(conn):
    cur = conn.cursor()

    # Example table: widgets (slug is UNIQUE). Adapt to your schema/migrations.
    for w in WIDGETS:
        cur.execute(
            """INSERT INTO widgets (slug, name, description, sort_order)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (slug) DO UPDATE SET
                 name = EXCLUDED.name,
                 description = EXCLUDED.description,
                 sort_order = EXCLUDED.sort_order""",
            (w['slug'], w['name'], w['description'], w['sort_order']),
        )

    conn.commit()
    logger.info('Seed complete: %d widgets upserted.', len(WIDGETS))


if __name__ == '__main__':
    conn = get_connection()
    try:
        seed(conn)
    finally:
        conn.close()
