-- wedding-card-invitation-web — Migration 003: Gift registry messages
-- Idempotent: safe to run multiple times. Apply BEFORE deploying code that queries it.

CREATE TABLE IF NOT EXISTS public.gifts (
    id          BIGSERIAL PRIMARY KEY,
    couple_slug TEXT NOT NULL,
    name        TEXT NOT NULL,
    message     TEXT NOT NULL,
    item        TEXT,
    approved    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gifts_couple_created
    ON public.gifts (couple_slug, created_at DESC);
