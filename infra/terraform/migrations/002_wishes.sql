-- wedding-card-invitation-web — Migration 002: Guestbook wishes
-- Idempotent: safe to run multiple times. Apply BEFORE deploying code that queries it.

CREATE TABLE IF NOT EXISTS public.wishes (
    id          BIGSERIAL PRIMARY KEY,
    couple_slug TEXT NOT NULL,
    name        TEXT NOT NULL,
    message     TEXT NOT NULL,
    approved    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wishes_couple_approved_created
    ON public.wishes (couple_slug, approved, created_at DESC);
