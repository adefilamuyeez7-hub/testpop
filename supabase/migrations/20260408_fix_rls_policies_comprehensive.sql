-- ============================================================================
-- Migration: 20260408_fix_rls_policies_comprehensive.sql
-- CRITICAL: Fix broken RLS policies allowing unauthorized access
-- Date: April 8, 2026
-- ============================================================================

-- ============================================================================
-- FUNCTION: Get authenticated user's wallet
-- ============================================================================
CREATE OR REPLACE FUNCTION get_auth_wallet()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (auth.jwt() ->> 'wallet'),
    (auth.jwt() ->> 'address'),
    (auth.jwt() ->> 'wallet_address'),
    ''
  )::TEXT;
$$;

-- ============================================================================
-- ORDERS TABLE - Fix critical data breach vulnerabilities
-- ============================================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Orders - Buyers can read own" ON orders;
DROP POLICY IF EXISTS "Orders - Sellers can read own artist orders" ON orders;
DROP POLICY IF EXISTS "Orders - Anyone can read" ON orders;
DROP POLICY IF EXISTS "Orders - Anyone can insert" ON orders;
DROP POLICY IF EXISTS "Orders - Anyone can update" ON orders;

-- Re-enable RLS (make sure it's on)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- NEW POLICIES - Restrict to authorized users only
-- Buyers can only read their own orders
CREATE POLICY "Orders - Buyers read own orders only"
  ON orders
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR lower(buyer_wallet) = lower(get_auth_wallet())
    OR EXISTS (
      SELECT 1
      FROM public.products p
      LEFT JOIN public.artists a ON a.id = p.artist_id
      WHERE p.id = orders.product_id
        AND lower(COALESCE(a.wallet, p.creator_wallet, '')) = lower(get_auth_wallet())
    )
    OR EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      LEFT JOIN public.artists a ON a.id = p.artist_id
      WHERE oi.order_id = orders.id
        AND lower(COALESCE(a.wallet, p.creator_wallet, '')) = lower(get_auth_wallet())
    )
  );

-- Only verify transactions can create orders (via backend service role)
CREATE POLICY "Orders - Service role creates verified orders only"
  ON orders
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Only order buyers and sellers can update their own orders
CREATE POLICY "Orders - Order participants can update status"
  ON orders
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR lower(buyer_wallet) = lower(get_auth_wallet())
    OR EXISTS (
      SELECT 1
      FROM public.products p
      LEFT JOIN public.artists a ON a.id = p.artist_id
      WHERE p.id = orders.product_id
        AND lower(COALESCE(a.wallet, p.creator_wallet, '')) = lower(get_auth_wallet())
    )
    OR EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      LEFT JOIN public.artists a ON a.id = p.artist_id
      WHERE oi.order_id = orders.id
        AND lower(COALESCE(a.wallet, p.creator_wallet, '')) = lower(get_auth_wallet())
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR lower(buyer_wallet) = lower(get_auth_wallet())
    OR EXISTS (
      SELECT 1
      FROM public.products p
      LEFT JOIN public.artists a ON a.id = p.artist_id
      WHERE p.id = orders.product_id
        AND lower(COALESCE(a.wallet, p.creator_wallet, '')) = lower(get_auth_wallet())
    )
    OR EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.products p ON p.id = oi.product_id
      LEFT JOIN public.artists a ON a.id = p.artist_id
      WHERE oi.order_id = orders.id
        AND lower(COALESCE(a.wallet, p.creator_wallet, '')) = lower(get_auth_wallet())
    )
  );

-- ============================================================================
-- ARTISTS TABLE - Fix profile update vulnerabilities
-- ============================================================================

DROP POLICY IF EXISTS "Artists - Owners can update" ON artists;
DROP POLICY IF EXISTS "Artists - Anyone can read" ON artists;
DROP POLICY IF EXISTS "Artists - Anyone can update" ON artists;

ALTER TABLE artists ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved/active artist profiles
DROP POLICY IF EXISTS "Artists - Public read approved profiles" ON artists;
CREATE POLICY "Artists - Public read approved profiles"
  ON artists
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR status IN ('approved', 'active')
    OR lower(wallet) = lower(get_auth_wallet())
  );

-- Only artists can update their own profile
CREATE POLICY "Artists - Only owner can update own profile"
  ON artists
  FOR UPDATE
  USING (auth.role() = 'service_role' OR lower(wallet) = lower(get_auth_wallet()))
  WITH CHECK (auth.role() = 'service_role' OR lower(wallet) = lower(get_auth_wallet()));

-- Service role can insert (admin user creation)
CREATE POLICY "Artists - Service role creates artists"
  ON artists
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- DROPS TABLE - Fix deletion vulnerabilities
-- ============================================================================

DROP POLICY IF EXISTS "Drops - Anyone can read" ON drops;
DROP POLICY IF EXISTS "Drops - Anyone can delete" ON drops;
DROP POLICY IF EXISTS "Drops - Anyone can update" ON drops;

ALTER TABLE drops ENABLE ROW LEVEL SECURITY;

-- Anyone can read published drops
DROP POLICY IF EXISTS "Drops - Public read published drops" ON drops;
CREATE POLICY "Drops - Public read published drops"
  ON drops
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR status IN ('published', 'active', 'live')
    OR EXISTS (
      SELECT 1 FROM artists a
      WHERE a.id = drops.artist_id
      AND lower(a.wallet) = lower(get_auth_wallet())
    )
  );

-- Only artist owner can update their drops
CREATE POLICY "Drops - Artist owner can update own drops"
  ON drops
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM artists a
      WHERE a.id = drops.artist_id
      AND lower(a.wallet) = lower(get_auth_wallet())
    )
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM artists a
      WHERE a.id = drops.artist_id
      AND lower(a.wallet) = lower(get_auth_wallet())
    )
  );

-- Only artist owner can delete their drops
CREATE POLICY "Drops - Artist owner can delete own drops"
  ON drops
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM artists a
      WHERE a.id = drops.artist_id
      AND lower(a.wallet) = lower(get_auth_wallet())
    )
  );

-- Service role creates drops
CREATE POLICY "Drops - Service role creates drops"
  ON drops
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- PRODUCTS TABLE - Fix authorization
-- ============================================================================

DROP POLICY IF EXISTS "Products - Anyone can read" ON products;
DROP POLICY IF EXISTS "Products - Anyone can delete" ON products;
DROP POLICY IF EXISTS "Products - Public read published products" ON products;
DROP POLICY IF EXISTS "Products - Creator can update own products" ON products;
DROP POLICY IF EXISTS "Products - Creator can delete own products" ON products;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Products - Public read published products"
  ON products
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR status IN ('published', 'active')
    OR EXISTS (
      SELECT 1 FROM artists a
      WHERE a.id = products.artist_id
      AND lower(a.wallet) = lower(get_auth_wallet())
    )
    OR lower(products.creator_wallet) = lower(get_auth_wallet())
  );

CREATE POLICY "Products - Creator can update own products"
  ON products
  FOR UPDATE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM artists a
      WHERE a.id = products.artist_id
      AND lower(a.wallet) = lower(get_auth_wallet())
    )
    OR lower(products.creator_wallet) = lower(get_auth_wallet())
  )
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM artists a
      WHERE a.id = products.artist_id
      AND lower(a.wallet) = lower(get_auth_wallet())
    )
    OR lower(products.creator_wallet) = lower(get_auth_wallet())
  );

CREATE POLICY "Products - Creator can delete own products"
  ON products
  FOR DELETE
  USING (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM artists a
      WHERE a.id = products.artist_id
      AND lower(a.wallet) = lower(get_auth_wallet())
    )
    OR lower(products.creator_wallet) = lower(get_auth_wallet())
  );

-- ============================================================================
-- SUBSCRIPTIONS TABLE - Fix authorization
-- ============================================================================

DROP POLICY IF EXISTS "Subscriptions - Anyone can read" ON subscriptions;
DROP POLICY IF EXISTS "Subscriptions - Anyone can update" ON subscriptions;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Subscribers can read their own subscriptions
CREATE POLICY "Subscriptions - Users read own subscriptions"
  ON subscriptions
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR lower(subscriber_wallet) = lower(get_auth_wallet())
  );

-- Only service role creates/updates subscriptions
CREATE POLICY "Subscriptions - Service role manages subscriptions"
  ON subscriptions
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Subscriptions - Service role updates subscriptions"
  ON subscriptions
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- ARTIST_SHARES TABLE - Protect financial data
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.artist_shares') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Artist Shares - Anyone can read" ON public.artist_shares';
    EXECUTE 'DROP POLICY IF EXISTS "Artist Shares - Artists read own shares" ON public.artist_shares';
    EXECUTE 'DROP POLICY IF EXISTS "Artist Shares - Service role manages shares" ON public.artist_shares';
    EXECUTE 'DROP POLICY IF EXISTS "Artist Shares - Service role updates shares" ON public.artist_shares';
    EXECUTE 'ALTER TABLE public.artist_shares ENABLE ROW LEVEL SECURITY';
    EXECUTE $artist_shares_policy$
      CREATE POLICY "Artist Shares - Artists read own shares"
        ON public.artist_shares
        FOR SELECT
        USING (
          auth.role() = 'service_role'
          OR EXISTS (
            SELECT 1
            FROM public.artists a
            WHERE a.id = artist_shares.artist_id
              AND lower(a.wallet) = lower(get_auth_wallet())
          )
        )
    $artist_shares_policy$;
    EXECUTE $artist_shares_policy$
      CREATE POLICY "Artist Shares - Service role manages shares"
        ON public.artist_shares
        FOR INSERT
        WITH CHECK (auth.role() = 'service_role')
    $artist_shares_policy$;
    EXECUTE $artist_shares_policy$
      CREATE POLICY "Artist Shares - Service role updates shares"
        ON public.artist_shares
        FOR UPDATE
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role')
    $artist_shares_policy$;
  END IF;
END $$;

-- ============================================================================
-- NONCES TABLE - Protect authentication
-- ============================================================================

DROP POLICY IF EXISTS "Nonces - Anyone can insert" ON nonces;

ALTER TABLE nonces ENABLE ROW LEVEL SECURITY;

-- Only service role can manage nonces (backend only)
CREATE POLICY "Nonces - Service role only"
  ON nonces
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================================
-- GRANT STATEMENTS - Restrict permissions by role
-- ============================================================================

-- Authenticated users get basic read access
GRANT SELECT ON orders TO authenticated;
GRANT SELECT ON artists TO authenticated;
GRANT SELECT ON drops TO authenticated;
GRANT SELECT ON products TO authenticated;
GRANT SELECT ON subscriptions TO authenticated;

-- Authenticated users can update their own data  
GRANT UPDATE ON orders TO authenticated;
GRANT UPDATE ON artists TO authenticated;
GRANT UPDATE ON drops TO authenticated;
GRANT UPDATE ON products TO authenticated;

-- Service role has unrestricted access (for backend API)
GRANT ALL ON orders TO service_role;
GRANT ALL ON artists TO service_role;
GRANT ALL ON drops TO service_role;
GRANT ALL ON products TO service_role;
GRANT ALL ON subscriptions TO service_role;
DO $$
BEGIN
  IF to_regclass('public.artist_shares') IS NOT NULL THEN
    GRANT ALL ON public.artist_shares TO service_role;
  END IF;
END $$;
GRANT ALL ON nonces TO service_role;

-- Anonymous users can read published content only (read-only)
GRANT SELECT ON artists TO anon;
GRANT SELECT ON drops TO anon;
GRANT SELECT ON products TO anon;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to test)
-- ============================================================================

-- Test 1: Verify a user cannot read all orders
-- SELECT COUNT(*) FROM orders WHERE buyer_wallet != current_user;
-- Expected: 0 or error

-- Test 2: Verify a user cannot update another artist's profile
-- UPDATE artists SET bio = 'HACKED' WHERE wallet != current_user LIMIT 1;
-- Expected: Error or 0 rows updated

-- Test 3: Verify a user cannot delete another artist's drops
-- DELETE FROM drops WHERE artist_id NOT IN (SELECT id FROM artists WHERE wallet = current_user);
-- Expected: Error or 0 rows deleted

-- Test 4: Verify published data is readable
-- SELECT COUNT(*) FROM drops WHERE status = 'published';
-- Expected: Multiple rows (no auth error)

-- ============================================================================
-- NOTES FOR NEXT STEPS
-- ============================================================================
-- 1. Test policies thoroughly before production deployment
-- 2. Run as non-admin user to verify access restrictions
-- 3. Verify schema audit_log table isn't affected
-- 4. Check performance impact of complex RLS policies
-- 5. Consider caching for frequently accessed public data
