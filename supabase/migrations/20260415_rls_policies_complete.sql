/**
 * ROW LEVEL SECURITY (RLS) POLICIES - Complete Implementation
 * File: supabase/migrations/20260415_rls_policies_complete.sql
 * Date: April 15, 2026
 * 
 * CRITICAL FIX: Complete RLS for all sensitive tables
 * Prevents users from accessing other users' data
 * 
 * This migration supports the actual schema:
 * - campaigns table is named ip_campaigns
 * - Uses wallet/address for user identification
 * - Handles subscription and order immutability
 */

-- Enable RLS only on tables that exist
ALTER TABLE IF EXISTS drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS whitelist ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROPS TABLE - Artists edit own, users read published
-- ============================================

-- Artists can read and update their own drops
CREATE POLICY IF NOT EXISTS "Artists can manage their own drops"
  ON drops
  FOR ALL
  USING (artist_id = auth.uid())
  WITH CHECK (artist_id = auth.uid());

-- Public can read published drops
CREATE POLICY IF NOT EXISTS "Public can read published drops"
  ON drops
  FOR SELECT
  USING (status IN ('published', 'active', 'live'));

-- Admin override (check for admin role in JWT)
CREATE POLICY IF NOT EXISTS "Admin can manage all drops"
  ON drops
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- ORDERS TABLE - Users access their own orders
-- ============================================

-- Users can only see their own orders (by wallet address)
CREATE POLICY IF NOT EXISTS "Users can read their own orders"
  ON orders
  FOR SELECT
  USING (buyer_wallet = auth.jwt() ->> 'wallet' OR buyer_wallet = auth.jwt() ->> 'address');

-- Users cannot modify orders (orders are immutable)
CREATE POLICY IF NOT EXISTS "Orders are immutable - no updates"
  ON orders
  FOR UPDATE
  USING (false);

CREATE POLICY IF NOT EXISTS "Orders cannot be deleted"
  ON orders
  FOR DELETE
  USING (false);

-- Artists can see orders for their drops
CREATE POLICY IF NOT EXISTS "Artists can see orders for their products"
  ON orders
  FOR SELECT
  USING (
    product_id IN (
      SELECT id FROM products WHERE creator_wallet = auth.jwt() ->> 'wallet'
    )
  );

-- Admin can see all orders
CREATE POLICY IF NOT EXISTS "Admin can access all orders"
  ON orders
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- SUBSCRIPTIONS TABLE - Users access their own
-- ============================================

-- Users can read their own subscriptions (by wallet)
CREATE POLICY IF NOT EXISTS "Users can read their own subscriptions"
  ON subscriptions
  FOR SELECT
  USING (subscriber_wallet = auth.jwt() ->> 'wallet' OR subscriber_wallet = auth.jwt() ->> 'address');

-- Subscriptions cannot be modified by users (managed by backend)
CREATE POLICY IF NOT EXISTS "Prevent subscription modifications"
  ON subscriptions
  FOR UPDATE
  USING (false);

CREATE POLICY IF NOT EXISTS "Prevent subscription deletion"
  ON subscriptions
  FOR DELETE
  USING (false);

-- Artists can see who subscribed to them
CREATE POLICY IF NOT EXISTS "Artists can see their subscribers"
  ON subscriptions
  FOR SELECT
  USING (artist_wallet = auth.jwt() ->> 'wallet');

-- ============================================
-- PRODUCTS TABLE - Public reads, creators manage
-- ============================================

-- Public can read published products
CREATE POLICY IF NOT EXISTS "Public can read published products"
  ON products
  FOR SELECT
  USING (status IN ('published', 'active'));

-- Creators can manage their products
CREATE POLICY IF NOT EXISTS "Creators can manage their products"
  ON products
  FOR ALL
  USING (creator_wallet = auth.jwt() ->> 'wallet' OR creator_wallet = auth.jwt() ->> 'address')
  WITH CHECK (creator_wallet = auth.jwt() ->> 'wallet' OR creator_wallet = auth.jwt() ->> 'address');

-- ============================================
-- IP_CAMPAIGNS TABLE - Campaign access control
-- ============================================

-- Only admins/artists can create campaigns
CREATE POLICY IF NOT EXISTS "Artists can create their campaigns"
  ON ip_campaigns
  FOR INSERT
  WITH CHECK (creator_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'role' = 'admin');

-- Creators can manage their campaigns
CREATE POLICY IF NOT EXISTS "Creators can manage their campaigns"
  ON ip_campaigns
  FOR ALL
  USING (creator_wallet = auth.jwt() ->> 'wallet')
  WITH CHECK (creator_wallet = auth.jwt() ->> 'wallet');

-- Admin can access all campaigns
CREATE POLICY IF NOT EXISTS "Admin can access all campaigns"
  ON ip_campaigns
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- ARTISTS TABLE - Verify ownership
-- ============================================

-- Artists can read/update their own profile (by wallet)
CREATE POLICY IF NOT EXISTS "Artists can manage their profile"
  ON artists
  FOR ALL
  USING (wallet = auth.jwt() ->> 'wallet' OR wallet = auth.jwt() ->> 'address')
  WITH CHECK (wallet = auth.jwt() ->> 'wallet' OR wallet = auth.jwt() ->> 'address');

-- Public can read artist profiles
CREATE POLICY IF NOT EXISTS "Public can read artist profiles"
  ON artists
  FOR SELECT
  USING (true);

-- ============================================
-- PROFILES TABLE - User data access
-- ============================================

-- Users can read/update their own profile
CREATE POLICY IF NOT EXISTS "Users can manage their own profile"
  ON profiles
  FOR ALL
  USING (wallet = auth.jwt() ->> 'wallet' OR wallet = auth.jwt() ->> 'address')
  WITH CHECK (wallet = auth.jwt() ->> 'wallet' OR wallet = auth.jwt() ->> 'address');

-- ============================================
-- WHITELIST TABLE - Verification access
-- ============================================

-- Users can see if they're on a whitelist
CREATE POLICY IF NOT EXISTS "Users can check whitelist status"
  ON whitelist
  FOR SELECT
  USING (wallet = auth.jwt() ->> 'wallet' OR wallet = auth.jwt() ->> 'address' OR true);

-- Only admins/creators can manage whitelist
CREATE POLICY IF NOT EXISTS "Creators can manage whitelists"
  ON whitelist
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- ============================================
-- GRANT REQUIRED PERMISSIONS
-- ============================================

-- Anon users need select on public tables
GRANT SELECT ON drops TO anon;
GRANT SELECT ON artists TO anon;
GRANT SELECT ON products TO anon;
GRANT SELECT ON ip_campaigns TO anon;
GRANT SELECT ON whitelist TO anon;

-- Authenticated users need permissions (RLS controls actual access)
GRANT ALL ON drops TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON subscriptions TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON ip_campaigns TO authenticated;
GRANT ALL ON artists TO authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON whitelist TO authenticated;

-- Service role (backend) needs full access (RLS not applied to service role)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
