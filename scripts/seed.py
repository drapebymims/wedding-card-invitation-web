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
        # The shared-layer module is wedding_card_invitation_web_common (renamed to <name>_common
        # by scaffold-project.sh). Imported dynamically so this template file
        # stays valid Python before scaffolding.
        module_name = os.environ.get('WEDDING_CARD_INVITATION_WEB_COMMON_MODULE', 'wedding_card_invitation_web_common')
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
# DEMO DATA — sample RSVPs / wishes / gifts for the sample couples.
#
# Runs only when the target table is EMPTY for a couple (idempotent:
# re-running is a no-op). Replace with real data or delete when going live.
# =====================================================================

DEMO_RSVPS = [
    {'couple_slug': 'adam-eve', 'guest_name': 'Nurul Aini', 'attendance': 'yes', 'guests_count': 2,
     'dietary': 'Tiada', 'phone': '6012-000 1111', 'message': 'Alhamdulillah, tahniah!'},
    {'couple_slug': 'adam-eve', 'guest_name': 'Hafiz Ismail', 'attendance': 'yes', 'guests_count': 1,
     'dietary': None, 'phone': '6013-222 3333', 'message': None},
    {'couple_slug': 'adam-eve', 'guest_name': 'Cikgu Rosnah', 'attendance': 'no', 'guests_count': 0,
     'dietary': None, 'phone': None, 'message': 'Maaf tidak dapat hadir, doa dari jauh.'},
    {'couple_slug': 'sarah-daniel', 'guest_name': 'Alex Lim', 'attendance': 'yes', 'guests_count': 2,
     'dietary': 'Vegetarian', 'phone': '6016-111 2222', 'message': 'So happy for you both!'},
    {'couple_slug': 'maya-arif', 'guest_name': 'Kak Yana', 'attendance': 'yes', 'guests_count': 3,
     'dietary': None, 'phone': '6017-333 4444', 'message': 'Selamat pengantin baru!'},
]

DEMO_WISHES = [
    {'couple_slug': 'adam-eve', 'name': 'Aisyah', 'message': 'Semoga bahagia hingga ke syurga!', 'approved': True},
    {'couple_slug': 'adam-eve', 'name': 'Daniel', 'message': 'Congratulations to the lovely couple!', 'approved': True},
    {'couple_slug': 'adam-eve', 'name': 'Farah', 'message': 'Tahniah! Semoga menjadi keluarga sakinah.', 'approved': False},
    {'couple_slug': 'sarah-daniel', 'name': 'Nadia', 'message': 'Best wishes for a lifetime of happiness!', 'approved': True},
    {'couple_slug': 'sarah-daniel', 'name': 'Wei Ming', 'message': 'Wishing you both all the love in the world.', 'approved': False},
    {'couple_slug': 'maya-arif', 'name': 'Faris', 'message': 'Selamat pengantin baru! 🎉', 'approved': True},
]

DEMO_GIFTS = [
    {'couple_slug': 'adam-eve', 'name': 'Ahmad', 'message': 'Sikit tanda ingatan. Tahniah!', 'item': None, 'approved': True},
    {'couple_slug': 'maya-arif', 'name': 'Sofia', 'message': 'Untuk madu bulan anda.', 'item': 'Set barangan dapur', 'approved': True},
]


def _seed_if_empty(cur, table, rows):
    inserted = 0
    for row in rows:
        cur.execute(
            f"""SELECT 1 FROM {table} WHERE couple_slug = %s LIMIT 1""",
            (row['couple_slug'],),
        )
        if cur.fetchone():
            continue
        cols = ', '.join(row.keys())
        placeholders = ', '.join(['%s'] * len(row))
        cur.execute(
            f"""INSERT INTO {table} ({cols}) VALUES ({placeholders})""",
            tuple(row.values()),
        )
        inserted += 1
    return inserted


def seed(conn):
    cur = conn.cursor()
    counts = {
        'rsvps': _seed_if_empty(cur, 'rsvps', DEMO_RSVPS),
        'wishes': _seed_if_empty(cur, 'wishes', DEMO_WISHES),
        'gifts': _seed_if_empty(cur, 'gifts', DEMO_GIFTS),
    }
    conn.commit()
    logger.info('Seed complete: %s', counts)


if __name__ == '__main__':
    conn = get_connection()
    try:
        seed(conn)
    finally:
        conn.close()
