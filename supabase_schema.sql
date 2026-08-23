-- ===================================================
-- BYMARIE LUXURY E-COMMERCE - SUPABASE DATABASE SCHEMA
-- Copy and paste this script into your Supabase SQL Editor
-- ===================================================

-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL,
  old NUMERIC DEFAULT 0,
  stock INTEGER DEFAULT 10,
  tag TEXT DEFAULT '',
  image TEXT NOT NULL,
  images JSONB DEFAULT '[]'::jsonb,
  desc TEXT,
  details JSONB DEFAULT '[]'::jsonb,
  colors JSONB DEFAULT '[]'::jsonb,
  sizes JSONB DEFAULT '[]'::jsonb,
  rating NUMERIC DEFAULT 5.0,
  reviews JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  delivery TEXT DEFAULT 'Standard delivery',
  payment TEXT DEFAULT 'Mobile Money',
  status TEXT DEFAULT 'Processing',
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  discountAmount NUMERIC DEFAULT 0,
  deliveryFee NUMERIC DEFAULT 0,
  total NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
  code TEXT PRIMARY KEY,
  discount NUMERIC NOT NULL,
  type TEXT DEFAULT 'percent',
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Site Settings Table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id INT PRIMARY KEY DEFAULT 1,
  heroTitle TEXT,
  heroSubtitle TEXT,
  announcementText TEXT,
  promoCodeNotice TEXT,
  brandEthosTitle TEXT,
  brandEthosText TEXT,
  contactEmail TEXT,
  contactPhone TEXT,
  accraAddress TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS) & Public Read/Write Policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read/Write Products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write Orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write Coupons" ON public.coupons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Read/Write Settings" ON public.site_settings FOR ALL USING (true) WITH CHECK (true);

-- 6. Insert Initial Storage Bucket for Product Photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Storage Access" ON storage.objects 
FOR ALL USING (bucket_id = 'product-images') WITH CHECK (bucket_id = 'product-images');
