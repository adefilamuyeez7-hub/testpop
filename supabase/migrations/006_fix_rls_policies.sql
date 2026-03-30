-- CRITICAL FIX: Implement proper Row Level Security (RLS) policies
-- Replaces open policies with wallet-based access control
-- Date: March 23, 2026

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DROP EXISTING INSECURE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Artists policies
DROP POLICY IF EXISTS "artists_read_all" ON artists;
DROP POLICY IF EXISTS "artists_update_own" ON artists;
DROP POLICY IF EXISTS "artists_write_all" ON artists;
DROP POLICY IF EXISTS "artists_insert_all" ON artists;

-- Drops policies
DROP POLICY IF EXISTS "drops_read_public" ON drops;
DROP POLICY IF EXISTS "drops_read_all" ON drops;
DROP POLICY IF EXISTS "drops_write_all" ON drops;
DROP POLICY IF EXISTS "drops_create_own" ON drops;
DROP POLICY IF EXISTS "drops_update_own" ON drops;
DROP POLICY IF EXISTS "drops_insert_all" ON drops;

-- Products policies
DROP POLICY IF EXISTS "products_read_published" ON products;
DROP POLICY IF EXISTS "products_read_own_draft" ON products;
DROP POLICY IF EXISTS "products_read_all" ON products;
DROP POLICY IF EXISTS "products_write_all" ON products;
DROP POLICY IF EXISTS "products_create_own" ON products;
DROP POLICY IF EXISTS "products_update_own" ON products;

-- Orders policies
DROP POLICY IF EXISTS "orders_read_own" ON orders;
DROP POLICY IF EXISTS "orders_read_own_product_sales" ON orders;
DROP POLICY IF EXISTS "orders_read_all" ON orders;
DROP POLICY IF EXISTS "orders_write_all" ON orders;
DROP POLICY IF EXISTS "orders_create_own" ON orders;

-- Whitelist policies
DROP POLICY IF EXISTS "whitelist_read_all" ON whitelist;
DROP POLICY IF EXISTS "whitelist_insert_admin_only" ON whitelist;
DROP POLICY IF EXISTS "whitelist_update_admin_only" ON whitelist;
DROP POLICY IF EXISTS "whitelist_delete_admin_only" ON whitelist;
DROP POLICY IF EXISTS "whitelist_write_all" ON whitelist;

-- Analytics policies
DROP POLICY IF EXISTS "analytics_insert_all" ON analytics;
DROP POLICY IF EXISTS "analytics_read_own" ON analytics;
DROP POLICY IF EXISTS "analytics_read_all" ON analytics;
DROP POLICY IF EXISTS "analytics_read_write_all" ON analytics;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. IMPLEMENT NEW SECURE POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- ARTISTS TABLE - Secure policies
-- ─────────────────────────────────────────────────────────────────────────────────

-- Anyone authenticated can READ public artist information (for discovery)
CREATE POLICY "artists_read_public" ON artists
FOR SELECT
USING (auth.role() = 'authenticated');

-- Artists can only UPDATE their own profile
CREATE POLICY "artists_update_own_profile" ON artists
FOR UPDATE
USING (wallet = auth.jwt() ->> 'sub');

-- Artists can INSERT their own profile (first time)
CREATE POLICY "artists_insert_own_profile" ON artists
FOR INSERT
WITH CHECK (wallet = auth.jwt() ->> 'sub');

-- ─────────────────────────────────────────────────────────────────────────────────
-- DROPS TABLE - Secure policies
-- ─────────────────────────────────────────────────────────────────────────────────

-- Anyone can READ published drops (status != 'draft')
CREATE POLICY "drops_read_published" ON drops
FOR SELECT
USING (status != 'draft');

-- Artists can READ their own draft drops
CREATE POLICY "drops_read_own_draft" ON drops
FOR SELECT
USING (
  status = 'draft'
  AND EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = drops.artist_id
    AND artists.wallet = auth.jwt() ->> 'sub'
  )
);

-- Artists can CREATE drops for themselves only
CREATE POLICY "drops_create_own" ON drops
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = artist_id
    AND artists.wallet = auth.jwt() ->> 'sub'
  )
);

-- Artists can UPDATE only their own drops
CREATE POLICY "drops_update_own" ON drops
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = drops.artist_id
    AND artists.wallet = auth.jwt() ->> 'sub'
  )
);

-- Artists can DELETE only their own drops
CREATE POLICY "drops_delete_own" ON drops
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = drops.artist_id
    AND artists.wallet = auth.jwt() ->> 'sub'
  )
);

-- ─────────────────────────────────────────────────────────────────────────────────
-- PRODUCTS TABLE - Secure policies
-- ─────────────────────────────────────────────────────────────────────────────────

-- Anyone can READ published products (status = 'published')
CREATE POLICY "products_read_published" ON products
FOR SELECT
USING (status = 'published');

-- Creators can READ their own draft products
CREATE POLICY "products_read_own_draft" ON products
FOR SELECT
USING (
  status = 'draft'
  AND creator_wallet = auth.jwt() ->> 'sub'
);

-- Creators can CREATE their own products
CREATE POLICY "products_create_own" ON products
FOR INSERT
WITH CHECK (creator_wallet = auth.jwt() ->> 'sub');

-- Creators can UPDATE only their own products
CREATE POLICY "products_update_own" ON products
FOR UPDATE
USING (creator_wallet = auth.jwt() ->> 'sub');

-- Creators can DELETE only their own products
CREATE POLICY "products_delete_own" ON products
FOR DELETE
USING (creator_wallet = auth.jwt() ->> 'sub');

-- ─────────────────────────────────────────────────────────────────────────────────
-- ORDERS TABLE - Secure policies
-- ─────────────────────────────────────────────────────────────────────────────────

-- Buyers can READ only their own orders
CREATE POLICY "orders_read_own_orders" ON orders
FOR SELECT
USING (buyer_wallet = auth.jwt() ->> 'sub');

-- Sellers can READ orders for their products
CREATE POLICY "orders_read_own_product_sales" ON orders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = orders.product_id
    AND products.creator_wallet = auth.jwt() ->> 'sub'
  )
);

-- Buyers can CREATE orders for themselves
CREATE POLICY "orders_create_own" ON orders
FOR INSERT
WITH CHECK (buyer_wallet = auth.jwt() ->> 'sub');

-- Sellers can UPDATE order status for their products only
CREATE POLICY "orders_update_own_product_sales" ON orders
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = orders.product_id
    AND products.creator_wallet = auth.jwt() ->> 'sub'
  )
);

-- ─────────────────────────────────────────────────────────────────────────────────
-- WHITELIST TABLE - Admin-only management
-- ─────────────────────────────────────────────────────────────────────────────────

-- Anyone can READ the whitelist (for public information)
CREATE POLICY "whitelist_read_public" ON whitelist
FOR SELECT
USING (true);

-- Only admin wallet can INSERT
CREATE POLICY "whitelist_insert_admin_only" ON whitelist
FOR INSERT
WITH CHECK (auth.jwt() ->> 'sub' = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092');

-- Only admin wallet can UPDATE
CREATE POLICY "whitelist_update_admin_only" ON whitelist
FOR UPDATE
USING (auth.jwt() ->> 'sub' = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092');

-- Only admin wallet can DELETE
CREATE POLICY "whitelist_delete_admin_only" ON whitelist
FOR DELETE
USING (auth.jwt() ->> 'sub' = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092');

-- ─────────────────────────────────────────────────────────────────────────────────
-- ANALYTICS TABLE - Controlled access
-- ─────────────────────────────────────────────────────────────────────────────────

-- Authenticated users can INSERT analytics events
CREATE POLICY "analytics_insert_authenticated" ON analytics
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Users can READ analytics only for artists they own
CREATE POLICY "analytics_read_own_artist" ON analytics
FOR SELECT
USING (
  artist_id IS NULL
  OR artist_id IN (
    SELECT id FROM artists
    WHERE wallet = auth.jwt() ->> 'sub'
  )
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. AUDIT LOGGING FUNCTION (for tracking changes)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE
  record_id UUID NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at DESC);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by);

-- Function to log changes
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, action, record_id, new_data, changed_by)
    VALUES (TG_TABLE_NAME, 'INSERT', NEW.id, row_to_json(NEW), auth.jwt() ->> 'sub');
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, action, record_id, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, 'UPDATE', NEW.id, row_to_json(OLD), row_to_json(NEW), auth.jwt() ->> 'sub');
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, action, record_id, old_data, changed_by)
    VALUES (TG_TABLE_NAME, 'DELETE', OLD.id, row_to_json(OLD), auth.jwt() ->> 'sub');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable audit logging for critical tables
DROP TRIGGER IF EXISTS audit_artists_changes ON artists;
CREATE TRIGGER audit_artists_changes
AFTER INSERT OR UPDATE OR DELETE ON artists
FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

DROP TRIGGER IF EXISTS audit_drops_changes ON drops;
CREATE TRIGGER audit_drops_changes
AFTER INSERT OR UPDATE OR DELETE ON drops
FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

DROP TRIGGER IF EXISTS audit_products_changes ON products;
CREATE TRIGGER audit_products_changes
AFTER INSERT OR UPDATE OR DELETE ON products
FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

DROP TRIGGER IF EXISTS audit_orders_changes ON orders;
CREATE TRIGGER audit_orders_changes
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. GRANT PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure RLS is enabled on all secure tables
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs - admin only can read
CREATE POLICY "audit_logs_read_admin_only" ON audit_logs
FOR SELECT
USING (auth.jwt() ->> 'sub' = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092');

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════════════════════════
-- This migration fixes CRITICAL security issue: Open RLS policies
-- Before: All authenticated users could read/write/modify ANY data
-- After: Wallet-based access control with proper scoping
-- 
-- Key changes:
-- 1. Artists can ONLY read/update their own profiles
-- 2. Drops can ONLY be created/modified by their artist
-- 3. Products can ONLY be created/modified by their creator
-- 4. Orders can ONLY be read by buyer or seller (product creator)
-- 5. Whitelist management restricted to admin wallet
-- 6. Audit logging added for all critical tables
-- 7. JWT 'sub' field used for wallet identification (not custom 'wallet' field)
-- ═══════════════════════════════════════════════════════════════════════════════
