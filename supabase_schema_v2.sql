-- ===================================================
-- BYMARIE LUXURY E-COMMERCE - SUPABASE SCHEMA v2 (ADDITIVE)
-- Adds tables the backend already reads/writes but that were never
-- created by supabase_schema.sql: users, notifications, campaigns,
-- wholesale_inquiries. Safe to run alongside the original file --
-- every statement is idempotent (CREATE TABLE IF NOT EXISTS / IF NOT EXISTS indexes).
-- Paste this into the Supabase SQL Editor and run it once.
-- ===================================================

-- 0. Extend existing tables with columns the app already writes but that
-- supabase_schema.sql never defined (field-by-field diffed against the live
-- schema and every object server.js actually sends). Without these, the
-- corresponding writes fail once error-swallowing is removed.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN DEFAULT true;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "appliedCoupon" JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS "securedServerSide" BOOLEAN DEFAULT true;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS "accraAddress" TEXT;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS "ethosImageUrl" TEXT;

-- 1. Users (customer accounts, float wallet balance, admin flag via status)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  "walletBalance" NUMERIC DEFAULT 0,
  "joinedDate" TEXT,
  "ordersCount" INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  "loggedIn" BOOLEAN DEFAULT false,
  salt TEXT,
  "passwordHash" TEXT,
  "lastLogin" TEXT,
  "authToken" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Notifications (in-dashboard admin notification feed)
CREATE TABLE IF NOT EXISTS public.notifications (
  id TEXT PRIMARY KEY,
  type TEXT,
  title TEXT,
  message TEXT,
  "orderId" TEXT,
  target TEXT DEFAULT 'admin',
  read BOOLEAN DEFAULT false,
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications (created_at DESC);

-- 3. Campaigns (SMS / Email broadcast history)
CREATE TABLE IF NOT EXISTS public.campaigns (
  id TEXT PRIMARY KEY,
  channel TEXT,
  title TEXT,
  headline TEXT,
  content TEXT,
  sender TEXT,
  "recipientsCount" INTEGER DEFAULT 0,
  "deliveredCount" INTEGER DEFAULT 0,
  "failedCount" INTEGER DEFAULT 0,
  recipients JSONB DEFAULT '[]'::jsonb,
  status TEXT,
  timestamp TEXT,
  "dateFormatted" TEXT,
  "deliveryLogs" JSONB DEFAULT '[]'::jsonb,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON public.campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS campaigns_channel_idx ON public.campaigns (channel);

-- 4. Wholesale / B2B Inquiries
CREATE TABLE IF NOT EXISTS public.wholesale_inquiries (
  id TEXT PRIMARY KEY,
  date TEXT,
  company TEXT,
  contact TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  volume TEXT,
  notes TEXT,
  status TEXT DEFAULT 'New',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wholesale_inquiries_status_idx ON public.wholesale_inquiries (status);

-- 5. Enable Row Level Security & match the existing app's permissive public
-- read/write policy convention (the app has no real per-user auth yet -- same
-- posture as products/orders/coupons/site_settings in supabase_schema.sql).
-- NOTE: this is a known weakness (anon key + fully open RLS means anyone with
-- the public anon key can read/write these tables directly). Flagged as a
-- follow-up, not something this migration silently fixes -- tightening it
-- would require matching changes to how the app authenticates.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wholesale_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read/Write Users" ON public.users;
CREATE POLICY "Public Read/Write Users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read/Write Notifications" ON public.notifications;
CREATE POLICY "Public Read/Write Notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read/Write Campaigns" ON public.campaigns;
CREATE POLICY "Public Read/Write Campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read/Write Wholesale Inquiries" ON public.wholesale_inquiries;
CREATE POLICY "Public Read/Write Wholesale Inquiries" ON public.wholesale_inquiries FOR ALL USING (true) WITH CHECK (true);
