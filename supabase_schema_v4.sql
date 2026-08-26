-- ===================================================
-- BYMARIE - SCHEMA v4 (ADDITIVE): verified order payments
-- Adds a paymentReference column to orders so a Paystack-paid order can be
-- looked up idempotently (the webhook and the post-redirect confirmation
-- call both complete the same payment, and must not create two orders for
-- one transaction). Paste into the Supabase SQL Editor and run it once.
-- ===================================================

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "paymentReference" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_reference_unique_idx
  ON public.orders ("paymentReference")
  WHERE "paymentReference" IS NOT NULL;
