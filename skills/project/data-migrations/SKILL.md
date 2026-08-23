---
name: data-migrations
description: Database discipline for foundation-derived projects — migrations-before-code as a load-bearing rule, idempotent SQL patterns, seed safety, and schema-evolution gotchas. Use when touching the schema, writing migrations, seeding data, or adding CHECK constraints/analytics views. Trigger words: "migration", "schema", "seed", "ALTER TABLE", "CHECK constraint", "analytics view".
---

# Data & Migrations — Schema Changes Without Casualties

## Migrations BEFORE code — load-bearing, not hygiene

Deploying code whose queries reference a migration's new table/column FAILS CLOSED:
RBAC gates lock out every non-admin when `roles` is missing (#55); per-tenant ownership
checks 500 when `orders` doesn't exist yet (wedding-card). Apply
`infra/terraform/migrations/NNN_*.sql` before deploying dependent handlers — always.

## Idempotent patterns (every migration re-runnable)

```sql
CREATE TABLE IF NOT EXISTS ...;
CREATE INDEX IF NOT EXISTS idx_<table>_<col> ON ...;
INSERT ... ON CONFLICT DO UPDATE / DO NOTHING;
-- Widening a status enum post-launch (#63):
DROP CONSTRAINT IF EXISTS <table>_<col>_check;
ADD CONSTRAINT <table>_<col>_check CHECK (status IN (...));
```

Numbered files `NNN_*.sql`. Enum-like statuses get DB-level CHECK constraints plus
status-lifecycle timestamps at the data edge (`sold_at` set once, preserved later,
cleared on leaving the status).

## Seeds

- Seed column lists MUST stay synced with the current schema — seeds drift silently
  behind migrations and die on `UndefinedColumn` (#40).
- Never run `SEED_TARGET=live` from a Mac — the layer's Linux psycopg2 wheel can't
  import locally (`No module named 'psycopg2._psycopg'`, #38). Local seeds:
  `SEED_TARGET=local` + DB env + macOS `psycopg2-binary`.
- Seed scripts `sys.path.append` (not `insert`) the layer path so the local wheel isn't
  shadowed (#38).
- Mock-first projects: mock ids/shapes mirror the backend contract exactly — string
  `'seller-1'` vs integer id breaks rendering on flip and TS can't catch it (#44).
- Bootstrap superadmin: `SUPERADMIN_EMAILS` env grants admin before any DB row exists (#55).

## Modeling lessons

- Free-text entity fields rot ("pmt rm3099", branch codes ×4 spellings) — entity
  references get dropdown tables + dedicated notes fields, never free text (sinar).
- Analytics are `CREATE OR REPLACE VIEW`s in migrations (idempotent), exposed via one
  dashboard endpoint — not app-code aggregation.
- Per-seller/tenant slugs: `UNIQUE(seller_id, slug)` + deterministic collision suffixes.
- Stock/inventory mutations: atomic conditional UPDATE (`WHERE stock >= qty`) in one
  transaction + append-only ledger rows; availability computed, never stored.
- Lead capture never fails on stale references — invalid FK resolves to NULL, not error.
- Money amounts live in minor units (sen/cents) end to end (#69).

## Applying

Local: `psql -h localhost -U <user> -d <db> -f migration.sql`. Live: read credentials
from Secrets Manager, then psql to `<host>:5432`. Verify `\dt public.*`.

## Anti-patterns

- Deploying handlers before their migration (#55).
- Non-idempotent migration that can't re-run.
- Editing seed column lists without checking the latest migration.
- Seeding prod from a Mac (#38).
- New status value shipped with no constraint-widening migration (#63).

## Related

`docs/pain-points.md` rows 38, 40, 43–44, 55, 63 · pairs with `serverless-backend`,
`aws-deploy`.
