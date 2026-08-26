-- ===================================================
-- BYMARIE - SCHEMA FIX-UP for users / wholesale_inquiries
-- Some other tool already created "users" and "wholesale_inquiries" with a
-- different column set (role/tier/wallet/points/tags/businessName/etc.)
-- instead of the columns in supabase_schema_v2.sql. Both tables are still
-- empty, so this is purely additive and non-destructive: it adds the
-- columns the app actually reads/writes without touching or removing the
-- existing ones. Paste into the Supabase SQL Editor and run it once.
-- ===================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "walletBalance" NUMERIC DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "joinedDate" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "ordersCount" INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "loggedIn" BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "lastLogin" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "authToken" TEXT;

-- Required for upsert(..., { onConflict: 'email' }) to work -- PostgREST
-- needs a real unique index/constraint on the conflict target column.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON public.users (email);

ALTER TABLE public.wholesale_inquiries ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.wholesale_inquiries ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.wholesale_inquiries ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE public.wholesale_inquiries ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.wholesale_inquiries ADD COLUMN IF NOT EXISTS notes TEXT;
