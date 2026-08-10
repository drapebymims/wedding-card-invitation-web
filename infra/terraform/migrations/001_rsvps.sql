-- wedding-card-invitation-web — Migration 001: RSVP table
-- Idempotent: safe to run multiple times. Apply BEFORE deploying code that queries it.

CREATE TABLE IF NOT EXISTS public.rsvps (
    id          BIGSERIAL PRIMARY KEY,
    couple_slug TEXT NOT NULL,
    guest_name  TEXT NOT NULL,
    attendance  TEXT NOT NULL CHECK (attendance IN ('yes', 'no')),
    guests_count INTEGER NOT NULL DEFAULT 1 CHECK (guests_count >= 1),
    dietary     TEXT,
    phone       TEXT,
    message     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsvps_couple_created
    ON public.rsvps (couple_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rsvps_couple_attendance
    ON public.rsvps (couple_slug, attendance);
