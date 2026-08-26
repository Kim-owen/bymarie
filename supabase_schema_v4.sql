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

-- Create product-images and media public storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true),
       ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Grant public RLS access to product-images and media buckets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public Product Storage Access'
  ) THEN
    CREATE POLICY "Public Product Storage Access"
    ON storage.objects FOR ALL
    USING (bucket_id IN ('product-images', 'media'))
    WITH CHECK (bucket_id IN ('product-images', 'media'));
  END IF;
END $$;
