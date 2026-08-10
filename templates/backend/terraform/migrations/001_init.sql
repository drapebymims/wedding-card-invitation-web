-- wedding-card-invitation-web — Migration 001 (example)
-- Idempotent: safe to run against an existing database.
-- Apply BEFORE deploying code that queries these tables.

CREATE TABLE IF NOT EXISTS public.users (
    id          BIGSERIAL PRIMARY KEY,
    cognito_sub TEXT UNIQUE NOT NULL,
    email       TEXT NOT NULL,
    name        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed example using ON CONFLICT so re-runs are no-ops.
INSERT INTO public.users (cognito_sub, email, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'system@example.com', 'System')
ON CONFLICT (cognito_sub) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
