-- Admin Setup for THEPOPUP
-- Run this in Supabase SQL Editor after setting up the main schema
-- Replace 'YOUR_ADMIN_WALLET_ADDRESS' with your actual admin wallet

-- Drop existing whitelist policies (if they exist)
DROP POLICY IF EXISTS "whitelist_insert_admin_only" ON whitelist;
DROP POLICY IF EXISTS "whitelist_update_admin_only" ON whitelist;
DROP POLICY IF EXISTS "whitelist_delete_admin_only" ON whitelist;

-- Create new policies with your admin wallet
-- Replace 'YOUR_ADMIN_WALLET_ADDRESS' below with your actual admin wallet.
-- Supports current `sub` wallet JWTs and older `wallet_address` JWTs.
CREATE POLICY "whitelist_insert_admin_only" ON whitelist FOR INSERT WITH CHECK (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
);

CREATE POLICY "whitelist_update_admin_only" ON whitelist FOR UPDATE USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
);

CREATE POLICY "whitelist_delete_admin_only" ON whitelist FOR DELETE USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
);

-- Also set up admin policies for products and orders tables
DROP POLICY IF EXISTS "products_insert_admin_only" ON products;
DROP POLICY IF EXISTS "products_update_admin_only" ON products;
DROP POLICY IF EXISTS "products_delete_admin_only" ON products;

CREATE POLICY "products_insert_admin_only" ON products FOR INSERT WITH CHECK (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
);

CREATE POLICY "products_update_admin_only" ON products FOR UPDATE USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
);

CREATE POLICY "products_delete_admin_only" ON products FOR DELETE USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
);

DROP POLICY IF EXISTS "orders_update_admin_only" ON orders;

CREATE POLICY "orders_update_admin_only" ON orders FOR UPDATE USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('YOUR_ADMIN_WALLET_ADDRESS')
);

-- Note: This setup assumes you're using wallet-based authentication
-- If you're using Supabase Auth, you may need to adjust the JWT structure
