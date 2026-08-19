-- wedding-card-invitation-web — Migration 004: Orders (couple-facing order lifecycle)
-- Idempotent: safe to run multiple times. Apply BEFORE deploying code that queries it.
--
-- One row per couple order. `config` stores the full CoupleConfig JSONB object
-- (see apps/web/src/lib/types.ts). `couple_slug` is the /w/<slug> route derived
-- from the couple names and is unique across all orders.

CREATE TABLE IF NOT EXISTS public.orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_sub       TEXT NOT NULL,
    couple_slug     TEXT NOT NULL UNIQUE,
    config          JSONB NOT NULL,
    package         TEXT NOT NULL DEFAULT 'standard',
    price_amount    NUMERIC(10,2) NOT NULL,
    price_currency  TEXT NOT NULL DEFAULT 'MYR',
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','awaiting_payment','paid','building','live','expired','cancelled')),
    bill_code       TEXT,
    bill_url        TEXT,
    paid_at         TIMESTAMPTZ,
    live_until      TIMESTAMPTZ,
    edit_until      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_owner_sub
    ON public.orders (owner_sub);
CREATE INDEX IF NOT EXISTS idx_orders_status
    ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_couple_slug
    ON public.orders (couple_slug);
CREATE INDEX IF NOT EXISTS idx_orders_bill_code
    ON public.orders (bill_code);
