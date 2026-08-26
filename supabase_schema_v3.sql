-- ===================================================
-- BYMARIE - SCHEMA v3 (ADDITIVE): verified wallet deposits
-- Backs the redesigned /api/wallet/deposit flow: every deposit is recorded
-- keyed by its Paystack transaction reference, which is also what makes the
-- endpoint idempotent (a retried/duplicated request can't double-credit a
-- wallet -- the second insert of the same reference just fails/is ignored).
-- Paste into the Supabase SQL Editor and run it once.
-- ===================================================

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  reference TEXT PRIMARY KEY,
  "userId" TEXT,
  email TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT DEFAULT 'GHS',
  status TEXT DEFAULT 'success',
  "paymentMethod" TEXT,
  "rawGatewayResponse" JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_idx ON public.wallet_transactions ("userId");
CREATE INDEX IF NOT EXISTS wallet_transactions_email_idx ON public.wallet_transactions (email);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read/Write Wallet Transactions" ON public.wallet_transactions;
CREATE POLICY "Public Read/Write Wallet Transactions" ON public.wallet_transactions FOR ALL USING (true) WITH CHECK (true);
