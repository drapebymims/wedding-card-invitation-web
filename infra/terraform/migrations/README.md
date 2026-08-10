# Migrations — `infra/terraform/migrations/`

All schema changes live here as numbered SQL files. They are applied to the RDS
database directly (via psql / a migration script) — not by Lambda code and not
by Terraform.

## Numbering convention

- `NNN_*.sql` — zero-padded, monotonically increasing. Never renumber or edit an
  already-applied migration (treat them as append-only history).
- Pick the next number regardless of gaps: `001_...`, `002_...`, …
- Name the file after what it adds: `004_documents_roles.sql`.

## Idempotency rules (hard requirement)

Every migration must be safe to run **multiple times** against an existing
database. That's what makes apply-before-deploy safe and recoverable.

- Tables / indexes / views: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- Types: guard with a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  block (a bare `CREATE TYPE` is **not** idempotent).
- Seed/insert data: `ON CONFLICT (key) DO NOTHING` (or `DO UPDATE`).
- Column adds/alters on existing tables: `ADD COLUMN IF NOT EXISTS`.

Example (from `001_init.sql`):

```sql
CREATE TABLE IF NOT EXISTS public.users ( ... );

INSERT INTO public.users (cognito_sub, email, name) VALUES ('seed', 'seed@x', 'Seed')
ON CONFLICT (cognito_sub) DO NOTHING;
```

## Apply BEFORE deploying code

The ordering is a hard rule (AGENTS.md #5): **migrations first, code second.**

1. Write the migration `NNN_*.sql`.
2. Apply it to the stage's database.
3. Only then deploy the Lambda/service code that queries the new columns/tables.

If you deploy code that reads a column that doesn't exist yet, every query 500s
and — with static-export frontends — baked error pages (pain point #12).

## Applying

Get the endpoint + credentials from the `db_secret_name` output (the secret
created by `database.tf`) and run with psql:

```bash
# From infra/terraform after `terraform output db_secret_name`
# Read the connection string from Secrets Manager at runtime (never commit creds):
DB_SECRET_NAME=$(terraform output -raw db_secret_name)
# ... fetch host/username/password from AWS Secrets Manager ...

psql "postgresql://<username>:<password>@<db-endpoint>:5432/<dbname>" \
  -f migrations/001_init.sql

# Or with a connection string exported from the secret:
psql "$DB_CONN_STRING" -f migrations/002_orders.sql
```

A convenient pattern is a `scripts/migrate.sh` that reads the secret from AWS
Secrets Manager, constructs the psql URL, and applies every `NNN_*.sql` newer
than the last applied one. (Keep it generic — see `scripts/` for examples.)
