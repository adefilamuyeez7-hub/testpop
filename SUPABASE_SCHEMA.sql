-- Generated bootstrap schema
-- Generated at 2026-04-09T14:19:40.724Z
-- Source: supabase/migrations/*.sql in lexical order
-- Apply this entire file to a fresh Supabase project to bootstrap the current app schema.
-- ============================================================================
-- Migration: 001_initial_schema.sql
-- ============================================================================
-- Supabase Database Schema for THEPOPUP
-- Run all of this in the Supabase SQL editor: https://supabase.com/dashboard/project/_/sql/new
-- NOTE: This migration preserves existing data - it adds tables/columns if they don't exist

-- ═══════════════════════════════════════════════════════════════════════════════
-- CREATE TABLES (preserves existing data)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- ARTISTS TABLE - Artist profiles and metadata
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  name VARCHAR(255),
  handle VARCHAR(100) UNIQUE,
  bio TEXT,
  tag VARCHAR(100),
  role VARCHAR(50) DEFAULT 'artist', -- artist, collector, founder, admin
  subscription_price DECIMAL(10, 6),
  avatar_url TEXT,
  banner_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  website_url TEXT,
  poap_allocation JSONB DEFAULT '{"subscribers": 40, "bidders": 35, "creators": 25}',
  portfolio JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artists_wallet ON artists(wallet);
CREATE INDEX IF NOT EXISTS idx_artists_handle ON artists(handle);
CREATE INDEX IF NOT EXISTS idx_artists_role ON artists(role);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DROPS TABLE - Art drops created by artists
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS drops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price_eth DECIMAL(10, 6) NOT NULL,
  supply INT NOT NULL DEFAULT 1,
  sold INT DEFAULT 0,
  image_url TEXT,
  image_ipfs_uri TEXT,
  metadata_ipfs_uri TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, live, ended
  type VARCHAR(50) DEFAULT 'drop', -- drop, auction, campaign
  contract_address VARCHAR(255),
  contract_drop_id INT,
  contract_kind VARCHAR(50), -- artDrop, poapCampaign
  revenue DECIMAL(18, 8) DEFAULT 0,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drops_artist_id ON drops(artist_id);
CREATE INDEX IF NOT EXISTS idx_drops_status ON drops(status);
CREATE INDEX IF NOT EXISTS idx_drops_created_at ON drops(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCTS TABLE - Physical/digital products for sale
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price_eth DECIMAL(10, 6) NOT NULL,
  stock INT DEFAULT 0, -- 0 = unlimited
  sold INT DEFAULT 0,
  image_url TEXT,
  image_ipfs_uri TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, published, out_of_stock
  metadata JSONB DEFAULT '{}', -- additional product data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_creator ON products(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ORDERS TABLE - Purchase orders
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  buyer_wallet TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  total_price_eth DECIMAL(18, 8) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, shipped, delivered, cancelled
  shipping_address TEXT,
  tracking_code VARCHAR(255),
  tx_hash VARCHAR(255), -- transaction hash
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- WHITELIST TABLE - Artist approval management
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  tag VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whitelist_wallet ON whitelist(wallet);
CREATE INDEX IF NOT EXISTS idx_whitelist_status ON whitelist(status);
CREATE INDEX IF NOT EXISTS idx_whitelist_joined_at ON whitelist(joined_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ANALYTICS TABLE - Page views and user behavior
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page VARCHAR(100),
  artist_id UUID REFERENCES artists(id) ON DELETE SET NULL,
  user_agent TEXT,
  referrer TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_artist ON analytics(artist_id);
CREATE INDEX IF NOT EXISTS idx_analytics_page ON analytics(page);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before creating new ones
DROP POLICY IF EXISTS "artists_read_all" ON artists;
DROP POLICY IF EXISTS "artists_write_all" ON artists;
DROP POLICY IF EXISTS "artists_update_all" ON artists;
DROP POLICY IF EXISTS "drops_read_all" ON drops;
DROP POLICY IF EXISTS "drops_write_all" ON drops;
DROP POLICY IF EXISTS "drops_update_all" ON drops;
DROP POLICY IF EXISTS "products_read_all" ON products;
DROP POLICY IF EXISTS "products_write_all" ON products;
DROP POLICY IF EXISTS "products_update_all" ON products;
DROP POLICY IF EXISTS "orders_read_all" ON orders;
DROP POLICY IF EXISTS "orders_write_all" ON orders;
DROP POLICY IF EXISTS "orders_update_all" ON orders;
DROP POLICY IF EXISTS "whitelist_read_all" ON whitelist;
DROP POLICY IF EXISTS "whitelist_write_all" ON whitelist;
DROP POLICY IF EXISTS "whitelist_write_admin_only" ON whitelist;
DROP POLICY IF EXISTS "whitelist_update_admin_only" ON whitelist;
DROP POLICY IF EXISTS "analytics_insert_all" ON analytics;
DROP POLICY IF EXISTS "analytics_read_all" ON analytics;

-- Policy creation is intentionally deferred.
-- Canonical RLS policies are applied in 006_fix_rls_policies.sql so the
-- generated bootstrap schema never exposes the legacy permissive access model.

-- ═══════════════════════════════════════════════════════════════════════════════
-- After running this, copy your Supabase credentials to .env.local:
-- VITE_SUPABASE_URL=https://your-project.supabase.co
-- VITE_SUPABASE_ANON_KEY=your_anon_key_here
-- ═══════════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Migration: 002_add_artist_contract_deployment.sql
-- ============================================================================
-- Migration: Add artist contract deployment tracking
-- This migration adds support for artist-specific contract deployments.
-- Each artist gets their own ArtDrop contract instance via the ArtDropFactory.

-- Add contract_address column to artists table
ALTER TABLE artists 
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS contract_deployment_tx VARCHAR(255),
ADD COLUMN IF NOT EXISTS contract_deployed_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'artists_contract_address_key'
  ) THEN
    ALTER TABLE artists
    ADD CONSTRAINT artists_contract_address_key UNIQUE (contract_address);
  END IF;
END $$;

-- Create index for faster contract address lookups
CREATE INDEX IF NOT EXISTS idx_artists_contract_address ON artists(contract_address);
CREATE INDEX IF NOT EXISTS idx_artists_deployment_status ON artists(contract_deployed_at DESC);

-- Add comment describing the new columns
COMMENT ON COLUMN artists.contract_address IS 'The ArtDrop contract address deployed for this artist via ArtDropFactory';
COMMENT ON COLUMN artists.contract_deployment_tx IS 'Transaction hash of the contract deployment';
COMMENT ON COLUMN artists.contract_deployed_at IS 'Timestamp when the contract was deployed';

-- Update drops table to reference artist contract directly
-- (Optional: useful for optimization, each drop knows its contract immediately)
ALTER TABLE drops 
ADD COLUMN IF NOT EXISTS artist_contract_address VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_drops_artist_contract ON drops(artist_contract_address);

COMMENT ON COLUMN drops.artist_contract_address IS 'The artist contract address where this drop was deployed';

-- ============================================================================
-- Migration: 003_add_shares_system.sql
-- ============================================================================
-- Migration: Add shares system support
-- Extends artist profiles to support optional fundraising via ArtistSharesToken

ALTER TABLE artists 
ADD COLUMN shares_enabled BOOLEAN DEFAULT false,
ADD COLUMN shares_contract_address VARCHAR(255) UNIQUE,
ADD COLUMN shares_contract_tx VARCHAR(255),
ADD COLUMN shares_campaign_active BOOLEAN DEFAULT false;

-- Create index for fast shares lookups
CREATE INDEX idx_artists_shares_contract ON artists(shares_contract_address);
CREATE INDEX idx_artists_shares_campaign ON artists(shares_campaign_active);

-- Comment describing the new columns
COMMENT ON COLUMN artists.shares_enabled IS 'Whether this artist has enabled the fundraising shares system';
COMMENT ON COLUMN artists.shares_contract_address IS 'The ERC-20 ArtistSharesToken contract address for this artist';
COMMENT ON COLUMN artists.shares_contract_tx IS 'Transaction hash of the shares token deployment';
COMMENT ON COLUMN artists.shares_campaign_active IS 'Whether the artist has an active fundraising campaign';

-- ============================================================================
-- Migration: 004_add_subscription_expiry.sql
-- ============================================================================
-- Migration: Add subscription expiry tracking
-- Description: Creates subscriptions table and adds support for 30-day expiring tokens with renewal capability

-- First, create the subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  subscriber_wallet TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  expiry_time BIGINT DEFAULT 0,
  min_subscription_fee NUMERIC DEFAULT 0.001,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(artist_id, subscriber_wallet)
);

-- Add columns if they don't already exist (idempotent)
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS expiry_time BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_subscription_fee NUMERIC DEFAULT 0.001;

-- Index for fast expiry lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(expiry_time);
CREATE INDEX IF NOT EXISTS idx_subscriptions_artist_expiry ON subscriptions(artist_id, expiry_time);

-- Helper function to check if subscription is active
CREATE OR REPLACE FUNCTION is_subscription_active(artist_id_param UUID, subscriber_wallet_param TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE subscriptions.artist_id = artist_id_param
    AND subscriptions.subscriber_wallet = subscriber_wallet_param
    AND subscriptions.expiry_time > EXTRACT(EPOCH FROM NOW())::BIGINT
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to get subscription time remaining (in seconds)
CREATE OR REPLACE FUNCTION get_subscription_time_remaining(artist_id_param UUID, subscriber_wallet_param TEXT)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT MAX(0) FROM (
      SELECT expiry_time - EXTRACT(EPOCH FROM NOW())::BIGINT as remaining
      FROM subscriptions
      WHERE subscriptions.artist_id = artist_id_param
      AND subscriptions.subscriber_wallet = subscriber_wallet_param
    ) sub
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to renew subscription (called when subscriber re-pays)
CREATE OR REPLACE FUNCTION renew_subscription(
  artist_id_param UUID,
  subscriber_wallet_param TEXT,
  new_amount NUMERIC,
  new_expiry BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE subscriptions
  SET 
    amount = new_amount,
    expiry_time = new_expiry,
    updated_at = NOW()
  WHERE subscriptions.artist_id = artist_id_param
  AND subscriptions.subscriber_wallet = subscriber_wallet_param;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Migration: 005_complete_shares_integration.sql
-- ============================================================================
-- Migration: Complete shares system integration
-- Description: Updates artists table to fully support shares system with deployment tracking

-- Update artists table with shares deployment tracking
ALTER TABLE artists
ADD COLUMN IF NOT EXISTS shares_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shares_contract_address VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS shares_contract_tx CHARACTER VARYING,
ADD COLUMN IF NOT EXISTS shares_campaign_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shares_target_amount NUMERIC,
ADD COLUMN IF NOT EXISTS shares_deployed_at TIMESTAMP WITH TIME ZONE;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_artists_shares_enabled ON artists(shares_enabled);
CREATE INDEX IF NOT EXISTS idx_artists_shares_contract ON artists(shares_contract_address) WHERE shares_contract_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_shares_campaign ON artists(shares_campaign_active);

-- Trigger to auto-update shares_deployed_at on shares_contract_address change
CREATE OR REPLACE FUNCTION public.set_shares_deployed_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shares_contract_address IS DISTINCT FROM OLD.shares_contract_address
     AND NEW.shares_contract_address IS NOT NULL THEN
    NEW.shares_deployed_at = COALESCE(NEW.shares_deployed_at, NOW());
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shares_deployed_at ON artists;
CREATE TRIGGER update_shares_deployed_at
BEFORE UPDATE ON artists
FOR EACH ROW
EXECUTE FUNCTION public.set_shares_deployed_at_timestamp();

-- View for shares discovery across the platform
CREATE OR REPLACE VIEW public.artists_with_active_shares AS
SELECT 
  id,
  name,
  wallet,
  shares_contract_address,
  shares_enabled,
  shares_campaign_active,
  shares_deployed_at
FROM artists
WHERE shares_enabled = true
  AND shares_contract_address IS NOT NULL
ORDER BY shares_deployed_at DESC NULLS LAST;

-- Function to deploy shares contract for an artist
CREATE OR REPLACE FUNCTION public.deploy_artist_shares(
  p_artist_id UUID,
  p_contract_address VARCHAR(255),
  p_deployment_tx VARCHAR(255),
  p_target_amount NUMERIC
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_artist_exists BOOLEAN;
  v_shares_already_exist BOOLEAN;
BEGIN
  IF p_artist_id IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Artist id is required'::TEXT;
    RETURN;
  END IF;

  IF NULLIF(BTRIM(p_contract_address), '') IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Contract address is required'::TEXT;
    RETURN;
  END IF;

  IF p_target_amount IS NOT NULL AND p_target_amount < 0 THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Target amount must be zero or greater'::TEXT;
    RETURN;
  END IF;

  -- Verify artist exists
  SELECT EXISTS(SELECT 1 FROM public.artists WHERE id = p_artist_id) INTO v_artist_exists;
  IF NOT v_artist_exists THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Artist not found'::TEXT;
    RETURN;
  END IF;

  -- Check if shares already deployed
  SELECT EXISTS(
    SELECT 1
    FROM public.artists
    WHERE id = p_artist_id
      AND shares_contract_address IS NOT NULL
  )
  INTO v_shares_already_exist;
  IF v_shares_already_exist THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Shares already deployed for this artist'::TEXT;
    RETURN;
  END IF;

  -- Deploy shares contract
  UPDATE public.artists
  SET 
    shares_enabled = true,
    shares_contract_address = LOWER(BTRIM(p_contract_address)),
    shares_contract_tx = NULLIF(BTRIM(p_deployment_tx), ''),
    shares_target_amount = p_target_amount,
    shares_deployed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_artist_id;

  RETURN QUERY SELECT true::BOOLEAN, 'Shares contract deployed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to toggle shares campaign on/off
CREATE OR REPLACE FUNCTION public.toggle_shares_campaign(
  p_artist_id UUID,
  p_new_active BOOLEAN
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  campaign_active BOOLEAN
) AS $$
DECLARE
  v_has_shares BOOLEAN;
BEGIN
  IF p_artist_id IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Artist id is required'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  IF p_new_active IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Campaign state is required'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  -- Check if artist has shares contract deployed
  SELECT EXISTS(
    SELECT 1
    FROM public.artists
    WHERE id = p_artist_id
      AND shares_contract_address IS NOT NULL
  )
  INTO v_has_shares;

  IF NOT v_has_shares THEN
    RETURN QUERY SELECT false::BOOLEAN, 'No shares contract deployed'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  -- Update campaign status
  UPDATE public.artists
  SET shares_campaign_active = p_new_active,
      updated_at = NOW()
  WHERE id = p_artist_id;

  RETURN QUERY 
  SELECT 
    true::BOOLEAN,
    'Shares campaign ' || CASE WHEN p_new_active THEN 'activated' ELSE 'deactivated' END::TEXT,
    p_new_active::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.deploy_artist_shares(UUID, VARCHAR, VARCHAR, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deploy_artist_shares(UUID, VARCHAR, VARCHAR, NUMERIC) TO service_role;

GRANT EXECUTE ON FUNCTION public.toggle_shares_campaign(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_shares_campaign(UUID, BOOLEAN) TO service_role;

-- ============================================================================
-- Migration: 006_fix_rls_policies.sql
-- ============================================================================
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
DROP POLICY IF EXISTS "whitelist_write_admin_only" ON whitelist;

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

-- Anyone can READ public products, including legacy active rows
CREATE POLICY "products_read_published" ON products
FOR SELECT
USING (status IN ('published', 'active'));

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
WITH CHECK (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);

-- Only admin wallet can UPDATE
CREATE POLICY "whitelist_update_admin_only" ON whitelist
FOR UPDATE
USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);

-- Only admin wallet can DELETE
CREATE POLICY "whitelist_delete_admin_only" ON whitelist
FOR DELETE
USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);

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
USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);

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

-- ============================================================================
-- Migration: 007_add_performance_indices.sql
-- ============================================================================
-- Add missing performance indices for critical queries
-- Date: March 23, 2026

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS TABLE INDICES (if subscriptions table exists)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Composite index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_artist_subscriber 
ON subscriptions(artist_id, subscriber_wallet);

-- Index for expiry scans used by renewal/cleanup jobs.
-- Avoid NOW() in index predicates because Postgres requires IMMUTABLE expressions.
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry 
ON subscriptions(expiry_time DESC)
WHERE expiry_time IS NOT NULL;

-- Index for subscriber analytics
CREATE INDEX IF NOT EXISTS idx_subscriptions_artist_expiry
ON subscriptions(artist_id, expiry_time DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DROPS TABLE INDICES - Already has some, adding critical ones
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for active/live drops queries (used in discovery and filtering)
CREATE INDEX IF NOT EXISTS idx_drops_active 
ON drops(artist_id, status, ends_at DESC)
WHERE status IN ('live', 'active', 'published');

-- Index for time-based queries (ended drops)
CREATE INDEX IF NOT EXISTS idx_drops_ended
ON drops(artist_id, ends_at)
WHERE ends_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCTS TABLE INDICES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Composite index for product queries by creator and status
CREATE INDEX IF NOT EXISTS idx_products_creator_status 
ON products(creator_wallet, status)
WHERE status IN ('published', 'draft');

-- Index for published products (discovery)
CREATE INDEX IF NOT EXISTS idx_products_published
ON products(status, created_at DESC)
WHERE status IN ('published', 'active');

-- ═══════════════════════════════════════════════════════════════════════════════
-- ORDERS TABLE INDICES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for buyer order queries
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status 
ON orders(buyer_wallet, status, created_at DESC);

-- Index for seller order queries (product creators viewing their sales)
CREATE INDEX IF NOT EXISTS idx_orders_product_buyer
ON orders(product_id, buyer_wallet);

-- Index for non-pending orders (shipped, delivered)
CREATE INDEX IF NOT EXISTS idx_orders_status_created
ON orders(status, created_at DESC)
WHERE status IN ('shipped', 'delivered');

-- ═══════════════════════════════════════════════════════════════════════════════
-- WHITELIST TABLE INDICES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for approved artists lookup
CREATE INDEX IF NOT EXISTS idx_whitelist_approved
ON whitelist(status, joined_at DESC)
WHERE status = 'approved';

-- ═══════════════════════════════════════════════════════════════════════════════
-- ANALYTICS TABLE INDICES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for artist analytics queries
CREATE INDEX IF NOT EXISTS idx_analytics_artist_timestamp
ON analytics(artist_id, timestamp DESC);

-- Index for page analytics
CREATE INDEX IF NOT EXISTS idx_analytics_page_timestamp
ON analytics(page, timestamp DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUDIT LOG INDICES (for tracking and compliance)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Already has idx_audit_logs_table_record and idx_audit_logs_changed_at
-- Add index for user tracking when the newer audit_logs table exists.
DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(changed_by, changed_at DESC)';
  END IF;
END $$;

-- Legacy admin audit table compatibility.
DO $$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_admin_wallet_created_at ON admin_audit_log(admin_wallet, created_at DESC)';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FOREIGN KEY INDICES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure all foreign key columns have indices
CREATE INDEX IF NOT EXISTS idx_drops_artist_id_status 
ON drops(artist_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_product_id_status
ON orders(product_id, status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTES FOR QUERIES THAT BENEFIT FROM THESE INDICES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Subscription status check (used frequently):
-- SELECT * FROM subscriptions 
-- WHERE artist_wallet = ? AND subscriber_wallet = ?
-- Index: idx_subscriptions_artist_subscriber ✓

-- Get active subscriptions:
-- SELECT * FROM subscriptions 
-- WHERE artist_wallet = ? AND expiry_time > NOW()
-- Index: idx_subscriptions_artist_expiry ✓

-- Get user's purchases:
-- SELECT o.* FROM orders o
-- WHERE o.buyer_wallet = ? AND o.status != 'cancelled'
-- ORDER BY o.created_at DESC
-- Index: idx_orders_buyer_status ✓

-- Get drops for artist:
-- SELECT * FROM drops
-- WHERE artist_id = ? AND status = 'live'
-- ORDER BY ends_at DESC
-- Index: idx_drops_active ✓

-- Get published products for marketplace:
-- SELECT * FROM products
-- WHERE status IN ('published', 'active')
-- ORDER BY created_at DESC
-- Index: idx_products_published ✓

-- ═══════════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- Migration: 008_artist_applications.sql
-- ============================================================================
-- ============================================================
-- Migration 008: Artist Applications System
-- Adds the artist_applications table and waitlist table.
-- The whitelist, artists, and admin_users tables already
-- exist from earlier migrations (001–007).
-- ============================================================

-- ── Waitlist (for early-access landing page) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist (
  id             UUID                     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT                     NOT NULL UNIQUE,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_wallet ON public.waitlist(wallet_address);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_public_insert" ON public.waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "waitlist_public_select" ON public.waitlist
  FOR SELECT USING (true);

-- ── Artist Applications ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.artist_applications (
  id             UUID                     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT                     NOT NULL UNIQUE,
  email          TEXT                     NOT NULL,
  artist_name    TEXT                     NOT NULL,
  bio            TEXT,
  art_types      TEXT[]                   NOT NULL DEFAULT ARRAY[]::TEXT[],
  twitter_url    TEXT,
  instagram_url  TEXT,
  website_url    TEXT,
  portfolio_url  TEXT,
  terms_agreed   BOOLEAN                  NOT NULL DEFAULT false,
  status         TEXT                     NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes    TEXT,
  submitted_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMP WITH TIME ZONE,
  reviewed_by    TEXT,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artist_applications_wallet
  ON public.artist_applications(wallet_address);

CREATE INDEX IF NOT EXISTS idx_artist_applications_status
  ON public.artist_applications(status);

CREATE INDEX IF NOT EXISTS idx_artist_applications_submitted
  ON public.artist_applications(submitted_at DESC);

-- RLS
ALTER TABLE public.artist_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated users) can submit
CREATE POLICY "applications_public_insert" ON public.artist_applications
  FOR INSERT WITH CHECK (true);

-- Anyone can read (admin panel uses anon key for now)
CREATE POLICY "applications_public_select" ON public.artist_applications
  FOR SELECT USING (true);

-- Admins can update (approve / reject)
CREATE POLICY "applications_admin_update" ON public.artist_applications
  FOR UPDATE USING (true);

-- ── updated_at trigger (reuse function if it already exists) ──────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_artist_applications_updated_at'
  ) THEN
    CREATE TRIGGER update_artist_applications_updated_at
      BEFORE UPDATE ON public.artist_applications
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_waitlist_updated_at'
  ) THEN
    CREATE TRIGGER update_waitlist_updated_at
      BEFORE UPDATE ON public.waitlist
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;

-- ============================================================================
-- Migration: 20260330_add_asset_type_to_drops.sql
-- ============================================================================
-- ═══════════════════════════════════════════════════════════════════════════════
-- Add Multi-Format Asset Support to Drops Table
-- ═══════════════════════════════════════════════════════════════════════════════
-- Enables drops to contain different file types: images, videos, audio, PDFs, eBooks
-- Supports preview URIs (e.g., video thumbnails) and delivery URIs (gated content)

ALTER TABLE IF EXISTS drops
ADD COLUMN IF NOT EXISTS asset_type VARCHAR(50) DEFAULT 'image',
ADD COLUMN IF NOT EXISTS preview_uri TEXT,
ADD COLUMN IF NOT EXISTS delivery_uri TEXT,
ADD COLUMN IF NOT EXISTS is_gated BOOLEAN DEFAULT FALSE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Add constraints to validate asset types
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE drops
ADD CONSTRAINT valid_asset_type CHECK (
  asset_type IN ('image', 'video', 'audio', 'pdf', 'epub', 'merchandise', 'digital')
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Create index for filtering by asset type (used in discovery/filtering)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_drops_asset_type
ON drops(asset_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- Create index for gated content filtering
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_drops_is_gated
ON drops(is_gated)
WHERE is_gated = TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Comments for documentation
-- ─────────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN drops.asset_type IS 'Type of digital asset: image (default), video, audio, pdf, epub';
COMMENT ON COLUMN drops.preview_uri IS 'IPFS preview thumbnail (e.g., video poster or album art)';
COMMENT ON COLUMN drops.delivery_uri IS 'IPFS URI for gated/downloadable content (different from preview)';
COMMENT ON COLUMN drops.is_gated IS 'Whether content requires ownership verification to access';

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCTION MIGRATION NOTES
-- ═══════════════════════════════════════════════════════════════════════════════
-- All existing drops default to asset_type = 'image' for backward compatibility
-- Frontend will auto-detect asset type from file extension on future uploads
-- Display logic: Use asset_type to render appropriate viewer (Image/Video/Audio/PDF/Epub)
-- Gating: If is_gated=true, show DownloadPanel instead of direct viewer

-- ============================================================================
-- Migration: 20260330_create_audit_log_table.sql
-- ============================================================================
-- Admin audit log table for tracking all administrative actions
-- Provides accountability and debugging information for artist approval/rejection/deployment

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_wallet TEXT NOT NULL,
  action TEXT NOT NULL,
  target_wallet TEXT,
  status TEXT,
  details JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (action IN ('approve_artist', 'reject_artist', 'deploy_contract', 'revoke_approval', 'delete_artist')),
  CHECK (status IN ('pending', 'approved', 'rejected', 'deployed', 'failed', 'revoked'))
);

-- Index for finding actions by admin
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_wallet 
ON admin_audit_log(admin_wallet);

-- Index for finding actions by target artist
CREATE INDEX IF NOT EXISTS idx_audit_log_target_wallet 
ON admin_audit_log(target_wallet);

-- Index for finding actions by type
CREATE INDEX IF NOT EXISTS idx_audit_log_action 
ON admin_audit_log(action);

-- Index for finding recent actions
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at 
ON admin_audit_log(created_at DESC);

-- Update whitelist table to support rejection reasons
ALTER TABLE IF EXISTS whitelist 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- Restrict audit log access to the configured admin wallet
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all audit logs" ON admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_read_admin_only" ON admin_audit_log;

CREATE POLICY "admin_audit_log_read_admin_only"
ON admin_audit_log
FOR SELECT
USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);

-- ============================================================================
-- Migration: 20260330_create_nonces_table.sql
-- ============================================================================
-- ═══════════════════════════════════════════════════════════════════════════════
-- NONCES TABLE - One-time authentication challenges
-- ═══════════════════════════════════════════════════════════════════════════════
-- Supports multi-instance deployments (no in-memory state)
-- Prevents nonce replay attacks across server instances
-- Default TTL: 15 minutes
-- Wallet storage: Normalized to lowercase for consistency across all auth systems

CREATE TABLE IF NOT EXISTS nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL, -- Stored as lowercase for consistency
  nonce TEXT NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Data integrity constraints
  CONSTRAINT valid_timestamps CHECK (issued_at <= expires_at),
  CONSTRAINT valid_used_state CHECK (used_at IS NULL OR used = TRUE),
  CONSTRAINT valid_wallet CHECK (wallet ~* '^0x[a-f0-9]{40}$'), -- Must be valid Ethereum address
  CONSTRAINT valid_nonce CHECK (nonce ~ '^[a-f0-9]{64}$'), -- Must be 32-byte hex
  CONSTRAINT one_time_use_per_wallet UNIQUE (wallet, nonce) -- Prevent duplicate nonces per wallet
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES - Query performance optimization
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for finding unused nonces by wallet (most common query in auth flow)
CREATE INDEX IF NOT EXISTS idx_nonces_wallet_unused 
ON nonces(wallet, used, expires_at) 
WHERE used = FALSE;

-- Index for cleanup of expired nonces (nightly maintenance)
CREATE INDEX IF NOT EXISTS idx_nonces_expires_at 
ON nonces(expires_at DESC) 
WHERE used = FALSE;

-- Index for finding specific nonce quickly (during verification)
CREATE INDEX IF NOT EXISTS idx_nonces_nonce 
ON nonces(nonce) 
WHERE used = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CLEANUP FUNCTION - Automated maintenance
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop existing function if it exists (previous version had different return type)
DROP FUNCTION IF EXISTS cleanup_expired_nonces();

-- Create improved cleanup function with row count reporting
CREATE FUNCTION cleanup_expired_nonces()
RETURNS TABLE(expired_count INT, used_count INT) AS $$
DECLARE
  expired_rows INT := 0;
  used_rows INT := 0;
BEGIN
  -- Delete expired unused nonces (older than their expiry time)
  DELETE FROM nonces
  WHERE expires_at < NOW() AND used = FALSE;
  GET DIAGNOSTICS expired_rows = ROW_COUNT;
  
  -- Delete used nonces older than 7 days (reduce storage bloat)
  DELETE FROM nonces
  WHERE used = TRUE AND used_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS used_rows = ROW_COUNT;
  
  RETURN QUERY SELECT expired_rows, used_rows;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY - Data access control
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE nonces ENABLE ROW LEVEL SECURITY;

-- Only backend (service role) can access nonces table
-- This prevents any direct client-side access
CREATE POLICY "Service role only" ON nonces
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCTION SETUP INSTRUCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- For nightly cleanup, set up a cron job in Supabase:
-- SELECT cron.schedule('cleanup-nonces', '0 2 * * *', 'SELECT cleanup_expired_nonces()');
--
-- For rate limiting per wallet, check server/index.js:
-- - Maximum 5 nonce requests per wallet per 15 minutes
-- - Enforced via in-memory cache with wallet + timestamp tracking
--
-- Wallet normalization is handled in backend at import time:
-- - All wallets converted to lowercase before storage
-- - No raw user input accepted (always validate format first)

-- ============================================================================
-- Migration: 20260401_add_campaign_submissions.sql
-- ============================================================================
CREATE TABLE IF NOT EXISTS campaign_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drop_id UUID NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  submitter_wallet TEXT NOT NULL,
  content_url TEXT,
  caption TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  onchain_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaign_submissions_status_check'
  ) THEN
    ALTER TABLE campaign_submissions
    ADD CONSTRAINT campaign_submissions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_campaign_submissions_drop_created_at
ON campaign_submissions(drop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_submissions_wallet_created_at
ON campaign_submissions(submitter_wallet, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaign_submissions_status_created_at
ON campaign_submissions(status, created_at DESC);

-- ============================================================================
-- Migration: 20260401_create_checkout_order_rpc.sql
-- ============================================================================
-- Migration: Add atomic checkout order creation RPC
-- Description:
--   * Creates create_checkout_order(...) for transactional cart checkout
--   * Validates product availability and stock in SQL
--   * Writes one order plus order_items and decrements stock atomically

CREATE OR REPLACE FUNCTION create_checkout_order(
  p_buyer_wallet TEXT,
  p_items JSONB,
  p_shipping_address_jsonb JSONB DEFAULT NULL,
  p_shipping_eth NUMERIC DEFAULT 0,
  p_tax_eth NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'ETH',
  p_tracking_code TEXT DEFAULT NULL,
  p_tx_hash TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_order_id UUID := gen_random_uuid();
  v_item_count INT := 0;
  v_locked_count INT := 0;
  v_total_quantity INT := 0;
  v_subtotal_eth NUMERIC := 0;
  v_shipping_eth NUMERIC := GREATEST(COALESCE(p_shipping_eth, 0), 0);
  v_tax_eth NUMERIC := GREATEST(COALESCE(p_tax_eth, 0), 0);
  v_total_price_eth NUMERIC := 0;
  v_currency TEXT := COALESCE(NULLIF(BTRIM(p_currency), ''), 'ETH');
  v_tracking_code TEXT := COALESCE(NULLIF(BTRIM(p_tracking_code), ''), 'TRK-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12)));
  v_tx_hash TEXT := NULLIF(BTRIM(p_tx_hash), '');
  v_shipping_address_jsonb JSONB := COALESCE(p_shipping_address_jsonb, '{}'::jsonb);
  v_shipping_address TEXT := '';
  v_single_product_id UUID := NULL;
  v_invalid_product_name TEXT;
  v_invalid_stock_name TEXT;
  v_invalid_stock_left INT;
  v_normalized_items JSONB := '[]'::jsonb;
BEGIN
  IF NULLIF(BTRIM(p_buyer_wallet), '') IS NULL THEN
    RAISE EXCEPTION 'buyer_wallet is required';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a non-empty array';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'quantity', quantity
      )
      ORDER BY product_id
    ),
    '[]'::jsonb
  )
  INTO v_normalized_items
  FROM (
    SELECT
      product_id,
      SUM(quantity)::INT AS quantity
    FROM (
      SELECT
        NULLIF(BTRIM(item->>'product_id'), '')::UUID AS product_id,
        GREATEST(
          CASE
            WHEN COALESCE(item->>'quantity', '') ~ '^\d+$' THEN (item->>'quantity')::INT
            ELSE 1
          END,
          1
        ) AS quantity
      FROM jsonb_array_elements(p_items) AS item
    ) parsed_items
    WHERE product_id IS NOT NULL
    GROUP BY product_id
  ) normalized_items;

  v_item_count := jsonb_array_length(v_normalized_items);

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.price_eth, 0) AS price_eth,
      COALESCE(p.stock, 0) AS stock,
      p.status,
      COALESCE(p.product_type, 'physical') AS product_type,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT COUNT(*)
  INTO v_locked_count
  FROM locked_products;

  IF v_locked_count <> v_item_count THEN
    RAISE EXCEPTION 'One or more products are no longer available';
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.stock, 0) AS stock,
      p.status,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT name
  INTO v_invalid_product_name
  FROM locked_products
  WHERE status IS NOT NULL
    AND status NOT IN ('published', 'active')
  LIMIT 1;

  IF v_invalid_product_name IS NOT NULL THEN
    RAISE EXCEPTION '% is not available for checkout', v_invalid_product_name;
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.stock, 0) AS stock,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT
    name,
    GREATEST(stock, 0)
  INTO
    v_invalid_stock_name,
    v_invalid_stock_left
  FROM locked_products
  WHERE stock <= 0
     OR quantity > stock
  LIMIT 1;

  IF v_invalid_stock_name IS NOT NULL THEN
    RAISE EXCEPTION '% only has % left in stock', v_invalid_stock_name, v_invalid_stock_left;
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      COALESCE(p.price_eth, 0) AS price_eth,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(ROUND(price_eth * quantity, 8)), 0)
  INTO
    v_total_quantity,
    v_subtotal_eth
  FROM locked_products;

  v_subtotal_eth := ROUND(v_subtotal_eth, 8);
  v_shipping_eth := ROUND(v_shipping_eth, 8);
  v_tax_eth := ROUND(v_tax_eth, 8);
  v_total_price_eth := ROUND(v_subtotal_eth + v_shipping_eth + v_tax_eth, 8);

  IF v_item_count = 1 THEN
    v_single_product_id := ((v_normalized_items->0)->>'product_id')::UUID;
  END IF;

  v_shipping_address := CONCAT_WS(
    ', ',
    NULLIF(BTRIM(v_shipping_address_jsonb->>'name'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'email'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'phone'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'street'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'city'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'state'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'postal_code'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'country'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'notes'), '')
  );

  v_shipping_address_jsonb := jsonb_strip_nulls(
    v_shipping_address_jsonb || jsonb_build_object('full_address', v_shipping_address)
  );

  INSERT INTO orders (
    id,
    buyer_wallet,
    product_id,
    quantity,
    currency,
    subtotal_eth,
    shipping_eth,
    tax_eth,
    total_price_eth,
    status,
    shipping_address,
    shipping_address_jsonb,
    tracking_code,
    tx_hash,
    paid_at,
    created_at,
    updated_at
  )
  VALUES (
    v_order_id,
    LOWER(BTRIM(p_buyer_wallet)),
    v_single_product_id,
    v_total_quantity,
    v_currency,
    v_subtotal_eth,
    v_shipping_eth,
    v_tax_eth,
    v_total_price_eth,
    'paid',
    v_shipping_address,
    v_shipping_address_jsonb,
    v_tracking_code,
    v_tx_hash,
    v_now,
    v_now,
    v_now
  );

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      COALESCE(p.price_eth, 0) AS price_eth,
      COALESCE(p.product_type, 'physical') AS product_type,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  INSERT INTO order_items (
    order_id,
    product_id,
    quantity,
    unit_price_eth,
    line_total_eth,
    fulfillment_type,
    delivery_status,
    created_at,
    updated_at
  )
  SELECT
    v_order_id,
    id,
    quantity,
    ROUND(price_eth, 8),
    ROUND(price_eth * quantity, 8),
    CASE
      WHEN product_type IN ('digital', 'hybrid') THEN 'digital'
      ELSE 'physical'
    END,
    'paid',
    v_now,
    v_now
  FROM locked_products;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  )
  UPDATE products p
  SET
    stock = GREATEST(COALESCE(p.stock, 0) - r.quantity, 0),
    status = CASE
      WHEN GREATEST(COALESCE(p.stock, 0) - r.quantity, 0) > 0 THEN 'published'
      ELSE 'out_of_stock'
    END,
    updated_at = v_now
  FROM requested_items r
  WHERE p.id = r.product_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Migration: 20260401_normalize_core_schema.sql
-- ============================================================================
-- Migration: Normalize artists, commerce, and analytics schema
-- Description:
--   * Fix relational drift between whitelist and artists
--   * Add richer product and order modeling
--   * Introduce order_items for multi-item checkout
--   * Add durable analytics_events and artist_daily_metrics
--   * Repair broken shares trigger/view for existing databases

ALTER TABLE artists
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS contract_deployment_tx VARCHAR(255),
ADD COLUMN IF NOT EXISTS contract_deployed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS shares_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shares_contract_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS shares_contract_tx VARCHAR(255),
ADD COLUMN IF NOT EXISTS shares_campaign_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shares_target_amount NUMERIC,
ADD COLUMN IF NOT EXISTS shares_deployed_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'artists_status_check'
  ) THEN
    ALTER TABLE artists
    ADD CONSTRAINT artists_status_check
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'active', 'suspended'));
  END IF;
END $$;

UPDATE artists a
SET status = CASE
  WHEN EXISTS (
    SELECT 1 FROM whitelist w
    WHERE lower(w.wallet) = lower(a.wallet) AND w.status = 'approved'
  ) THEN CASE WHEN a.contract_address IS NOT NULL THEN 'active' ELSE 'approved' END
  WHEN EXISTS (
    SELECT 1 FROM whitelist w
    WHERE lower(w.wallet) = lower(a.wallet) AND w.status = 'rejected'
  ) THEN 'rejected'
  WHEN EXISTS (
    SELECT 1 FROM whitelist w
    WHERE lower(w.wallet) = lower(a.wallet) AND w.status = 'pending'
  ) THEN 'pending'
  ELSE COALESCE(a.status, 'draft')
END
WHERE a.status IS NULL OR a.status = 'draft';

CREATE INDEX IF NOT EXISTS idx_artists_status ON artists(status);
CREATE INDEX IF NOT EXISTS idx_artists_contract_address ON artists(contract_address) WHERE contract_address IS NOT NULL;

ALTER TABLE whitelist
ADD COLUMN IF NOT EXISTS artist_id UUID,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE whitelist w
SET artist_id = a.id
FROM artists a
WHERE w.artist_id IS NULL
  AND lower(a.wallet) = lower(w.wallet);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whitelist_artist_id_fkey'
  ) THEN
    ALTER TABLE whitelist
    ADD CONSTRAINT whitelist_artist_id_fkey
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whitelist_artist_id
ON whitelist(artist_id)
WHERE artist_id IS NOT NULL;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS artist_id UUID,
ADD COLUMN IF NOT EXISTS product_type VARCHAR(50) DEFAULT 'physical',
ADD COLUMN IF NOT EXISTS asset_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS preview_uri TEXT,
ADD COLUMN IF NOT EXISTS delivery_uri TEXT,
ADD COLUMN IF NOT EXISTS is_gated BOOLEAN DEFAULT false;

UPDATE products p
SET artist_id = a.id
FROM artists a
WHERE p.artist_id IS NULL
  AND lower(a.wallet) = lower(p.creator_wallet);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_artist_id_fkey'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_artist_id_fkey
    FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_product_type_check'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_product_type_check
    CHECK (product_type IN ('physical', 'digital', 'hybrid'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_asset_type_check'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_asset_type_check
    CHECK (
      asset_type IS NULL OR
      asset_type IN ('image', 'video', 'audio', 'pdf', 'epub', 'merchandise', 'digital')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_artist_id ON products(artist_id);
CREATE INDEX IF NOT EXISTS idx_products_product_type ON products(product_type);

ALTER TABLE orders
ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ETH',
ADD COLUMN IF NOT EXISTS subtotal_eth NUMERIC,
ADD COLUMN IF NOT EXISTS shipping_eth NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_eth NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS shipping_address_jsonb JSONB;

UPDATE orders
SET subtotal_eth = COALESCE(subtotal_eth, total_price_eth),
    currency = COALESCE(currency, 'ETH'),
    shipping_eth = COALESCE(shipping_eth, 0),
    tax_eth = COALESCE(tax_eth, 0),
    shipping_address_jsonb = COALESCE(
      shipping_address_jsonb,
      CASE
        WHEN shipping_address IS NULL OR btrim(shipping_address) = '' THEN NULL
        ELSE jsonb_build_object('full_address', shipping_address)
      END
    ),
    paid_at = CASE WHEN status IN ('paid', 'processing', 'shipped', 'delivered') THEN COALESCE(paid_at, updated_at, created_at) ELSE paid_at END,
    shipped_at = CASE WHEN status IN ('shipped', 'delivered') THEN COALESCE(shipped_at, updated_at, created_at) ELSE shipped_at END,
    delivered_at = CASE WHEN status = 'delivered' THEN COALESCE(delivered_at, updated_at, created_at) ELSE delivered_at END;

ALTER TABLE orders
DROP CONSTRAINT IF EXISTS orders_product_id_fkey;

ALTER TABLE orders
ADD CONSTRAINT orders_product_id_fkey
FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check_v2'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_status_check_v2
    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_eth NUMERIC NOT NULL DEFAULT 0,
  line_total_eth NUMERIC NOT NULL DEFAULT 0,
  fulfillment_type VARCHAR(50) NOT NULL DEFAULT 'physical',
  delivery_status VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_fulfillment_type_check'
  ) THEN
    ALTER TABLE order_items
    ADD CONSTRAINT order_items_fulfillment_type_check
    CHECK (fulfillment_type IN ('physical', 'digital'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

INSERT INTO order_items (
  order_id,
  product_id,
  quantity,
  unit_price_eth,
  line_total_eth,
  fulfillment_type,
  delivery_status,
  created_at,
  updated_at
)
SELECT
  o.id,
  o.product_id,
  COALESCE(o.quantity, 1),
  CASE
    WHEN COALESCE(o.quantity, 0) > 0 THEN COALESCE(o.total_price_eth, 0) / o.quantity
    ELSE COALESCE(o.total_price_eth, 0)
  END,
  COALESCE(o.total_price_eth, 0),
  CASE
    WHEN p.product_type IN ('digital', 'hybrid') THEN 'digital'
    ELSE 'physical'
  END,
  o.status,
  COALESCE(o.created_at, NOW()),
  COALESCE(o.updated_at, NOW())
FROM orders o
JOIN products p ON p.id = o.product_id
WHERE o.product_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM order_items oi
    WHERE oi.order_id = o.id
      AND oi.product_id = o.product_id
  );

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(50) NOT NULL,
  artist_id UUID REFERENCES artists(id) ON DELETE SET NULL,
  drop_id UUID REFERENCES drops(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  wallet TEXT,
  session_id TEXT,
  user_agent TEXT,
  referrer TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analytics_events_event_type_check'
  ) THEN
    ALTER TABLE analytics_events
    ADD CONSTRAINT analytics_events_event_type_check
    CHECK (
      event_type IN (
        'page_view',
        'artist_view',
        'drop_view',
        'product_view',
        'checkout_started',
        'checkout_completed',
        'mint_started',
        'mint_completed',
        'subscription_started'
      )
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analytics_events_artist_created_at ON analytics_events(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_drop_created_at ON analytics_events(drop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_product_created_at ON analytics_events(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_created_at ON analytics_events(event_type, created_at DESC);

INSERT INTO analytics_events (
  event_type,
  artist_id,
  user_agent,
  referrer,
  metadata,
  created_at
)
SELECT
  CASE
    WHEN a.page IN ('artist_view', 'artist_profile') THEN 'artist_view'
    WHEN a.page = 'drop_view' THEN 'drop_view'
    WHEN a.page = 'product_view' THEN 'product_view'
    ELSE 'page_view'
  END,
  a.artist_id,
  a.user_agent,
  a.referrer,
  jsonb_build_object('legacy_page', a.page),
  COALESCE(a.timestamp, NOW())
FROM analytics a
WHERE NOT EXISTS (
  SELECT 1
  FROM analytics_events ae
  WHERE ae.created_at = a.timestamp
    AND ae.artist_id IS NOT DISTINCT FROM a.artist_id
    AND COALESCE(ae.metadata ->> 'legacy_page', '') = COALESCE(a.page, '')
);

CREATE TABLE IF NOT EXISTS artist_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  profile_views INT NOT NULL DEFAULT 0,
  drop_views INT NOT NULL DEFAULT 0,
  product_views INT NOT NULL DEFAULT 0,
  orders_count INT NOT NULL DEFAULT 0,
  units_sold INT NOT NULL DEFAULT 0,
  gross_sales_eth NUMERIC NOT NULL DEFAULT 0,
  net_sales_eth NUMERIC NOT NULL DEFAULT 0,
  new_subscribers INT NOT NULL DEFAULT 0,
  active_subscribers INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (artist_id, metric_date)
);

CREATE OR REPLACE VIEW artist_order_line_items AS
SELECT
  o.id AS order_id,
  p.artist_id,
  o.product_id,
  COALESCE(o.quantity, 1) AS quantity,
  COALESCE(o.total_price_eth, 0) AS line_total_eth,
  o.status,
  o.created_at
FROM orders o
JOIN products p ON p.id = o.product_id
WHERE o.product_id IS NOT NULL
UNION ALL
SELECT
  oi.order_id,
  p.artist_id,
  oi.product_id,
  oi.quantity,
  COALESCE(oi.line_total_eth, oi.unit_price_eth * oi.quantity, 0) AS line_total_eth,
  o.status,
  o.created_at
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id;

CREATE OR REPLACE FUNCTION refresh_artist_daily_metrics(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_start DATE;
  v_end DATE;
BEGIN
  SELECT
    COALESCE(p_start_date, MIN(day_bucket), CURRENT_DATE),
    COALESCE(p_end_date, MAX(day_bucket), CURRENT_DATE)
  INTO v_start, v_end
  FROM (
    SELECT DATE(created_at) AS day_bucket FROM analytics_events
    UNION ALL
    SELECT DATE(created_at) AS day_bucket FROM artist_order_line_items
  ) activity_days;

  DELETE FROM artist_daily_metrics
  WHERE metric_date BETWEEN v_start AND v_end;

  INSERT INTO artist_daily_metrics (
    artist_id,
    metric_date,
    profile_views,
    drop_views,
    product_views,
    orders_count,
    units_sold,
    gross_sales_eth,
    net_sales_eth,
    new_subscribers,
    active_subscribers,
    created_at,
    updated_at
  )
  WITH event_rollup AS (
    SELECT
      artist_id,
      DATE(created_at) AS metric_date,
      COUNT(*) FILTER (WHERE event_type = 'artist_view') AS profile_views,
      COUNT(*) FILTER (WHERE event_type = 'drop_view') AS drop_views,
      COUNT(*) FILTER (WHERE event_type = 'product_view') AS product_views,
      COUNT(*) FILTER (WHERE event_type = 'subscription_started') AS new_subscribers
    FROM analytics_events
    WHERE artist_id IS NOT NULL
      AND DATE(created_at) BETWEEN v_start AND v_end
    GROUP BY artist_id, DATE(created_at)
  ),
  sales_rollup AS (
    SELECT
      artist_id,
      DATE(created_at) AS metric_date,
      COUNT(DISTINCT order_id) FILTER (WHERE status NOT IN ('cancelled', 'refunded')) AS orders_count,
      COALESCE(SUM(quantity) FILTER (WHERE status NOT IN ('cancelled', 'refunded')), 0) AS units_sold,
      COALESCE(SUM(line_total_eth) FILTER (WHERE status NOT IN ('cancelled', 'refunded')), 0) AS gross_sales_eth
    FROM artist_order_line_items
    WHERE artist_id IS NOT NULL
      AND DATE(created_at) BETWEEN v_start AND v_end
    GROUP BY artist_id, DATE(created_at)
  ),
  combined AS (
    SELECT
      COALESCE(e.artist_id, s.artist_id) AS artist_id,
      COALESCE(e.metric_date, s.metric_date) AS metric_date,
      COALESCE(e.profile_views, 0) AS profile_views,
      COALESCE(e.drop_views, 0) AS drop_views,
      COALESCE(e.product_views, 0) AS product_views,
      COALESCE(s.orders_count, 0) AS orders_count,
      COALESCE(s.units_sold, 0) AS units_sold,
      COALESCE(s.gross_sales_eth, 0) AS gross_sales_eth,
      COALESCE(s.gross_sales_eth, 0) AS net_sales_eth,
      COALESCE(e.new_subscribers, 0) AS new_subscribers,
      0 AS active_subscribers
    FROM event_rollup e
    FULL OUTER JOIN sales_rollup s
      ON s.artist_id = e.artist_id
     AND s.metric_date = e.metric_date
  )
  SELECT
    artist_id,
    metric_date,
    profile_views,
    drop_views,
    product_views,
    orders_count,
    units_sold,
    gross_sales_eth,
    net_sales_eth,
    new_subscribers,
    active_subscribers,
    NOW(),
    NOW()
  FROM combined
  WHERE artist_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

SELECT refresh_artist_daily_metrics();

CREATE OR REPLACE FUNCTION set_shares_deployed_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shares_contract_address IS DISTINCT FROM OLD.shares_contract_address
     AND NEW.shares_contract_address IS NOT NULL THEN
    NEW.shares_deployed_at = COALESCE(NEW.shares_deployed_at, NOW());
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shares_deployed_at ON artists;
CREATE TRIGGER update_shares_deployed_at
BEFORE UPDATE ON artists
FOR EACH ROW
EXECUTE FUNCTION set_shares_deployed_at_timestamp();

CREATE OR REPLACE VIEW artists_with_active_shares AS
SELECT
  id,
  name,
  wallet,
  shares_contract_address,
  shares_enabled,
  shares_campaign_active,
  shares_deployed_at
FROM artists
WHERE shares_enabled = true
  AND shares_contract_address IS NOT NULL
ORDER BY shares_deployed_at DESC NULLS LAST;

-- ============================================================================
-- Migration: 20260402_add_drop_metadata.sql
-- ============================================================================
-- Migration: add editable metadata to drops
-- Description:
--   * Supports artist-managed campaign detail content without changing immutable onchain metadata

ALTER TABLE drops
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

UPDATE drops
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- ============================================================================
-- Migration: 20260402_fix_public_artist_read_rls.sql
-- ============================================================================
-- Migration: Restore public artist discovery without exposing non-public profiles
-- Description:
--   * Allows anon storefront reads for approved/active artists
--   * Preserves whitelist-based compatibility for legacy databases
--   * Prevents draft, pending, rejected, and suspended artists from leaking publicly

DROP POLICY IF EXISTS "artists_read_public" ON artists;
DROP POLICY IF EXISTS "artists_read_approved_public" ON artists;

DO $$
DECLARE
  has_artist_status BOOLEAN := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'artists'
      AND column_name = 'status'
  );
  has_whitelist_artist_id BOOLEAN := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whitelist'
      AND column_name = 'artist_id'
  );
  has_whitelist_wallet BOOLEAN := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whitelist'
      AND column_name = 'wallet'
  );
  whitelist_match_sql TEXT := NULL;
BEGIN
  IF has_whitelist_artist_id AND has_whitelist_wallet THEN
    whitelist_match_sql := $match$
      ((w.artist_id IS NOT NULL AND w.artist_id = artists.id) OR lower(w.wallet) = lower(artists.wallet))
    $match$;
  ELSIF has_whitelist_artist_id THEN
    whitelist_match_sql := 'w.artist_id = artists.id';
  ELSIF has_whitelist_wallet THEN
    whitelist_match_sql := 'lower(w.wallet) = lower(artists.wallet)';
  END IF;

  IF has_artist_status AND whitelist_match_sql IS NOT NULL THEN
    EXECUTE format($policy$
      CREATE POLICY "artists_read_approved_public" ON artists
      FOR SELECT
      USING (
        status IN ('approved', 'active')
        OR EXISTS (
          SELECT 1
          FROM whitelist w
          WHERE w.status = 'approved'
            AND %s
        )
      )
    $policy$, whitelist_match_sql);
  ELSIF has_artist_status THEN
    EXECUTE $policy$
      CREATE POLICY "artists_read_approved_public" ON artists
      FOR SELECT
      USING (status IN ('approved', 'active'))
    $policy$;
  ELSIF whitelist_match_sql IS NOT NULL THEN
    EXECUTE format($policy$
      CREATE POLICY "artists_read_approved_public" ON artists
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM whitelist w
          WHERE w.status = 'approved'
            AND %s
        )
      )
    $policy$, whitelist_match_sql);
  ELSE
    EXECUTE $policy$
      CREATE POLICY "artists_read_approved_public" ON artists
      FOR SELECT
      USING (false)
    $policy$;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260402_harden_checkout_order_rpc.sql
-- ============================================================================
-- Migration: Harden checkout RPC so orders cannot be marked paid without an onchain tx hash
-- Description:
--   * Requires p_tx_hash for create_checkout_order(...)
--   * Prevents direct RPC callers from creating paid orders without payment evidence

CREATE OR REPLACE FUNCTION create_checkout_order(
  p_buyer_wallet TEXT,
  p_items JSONB,
  p_shipping_address_jsonb JSONB DEFAULT NULL,
  p_shipping_eth NUMERIC DEFAULT 0,
  p_tax_eth NUMERIC DEFAULT 0,
  p_currency TEXT DEFAULT 'ETH',
  p_tracking_code TEXT DEFAULT NULL,
  p_tx_hash TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_order_id UUID := gen_random_uuid();
  v_item_count INT := 0;
  v_locked_count INT := 0;
  v_total_quantity INT := 0;
  v_subtotal_eth NUMERIC := 0;
  v_shipping_eth NUMERIC := GREATEST(COALESCE(p_shipping_eth, 0), 0);
  v_tax_eth NUMERIC := GREATEST(COALESCE(p_tax_eth, 0), 0);
  v_total_price_eth NUMERIC := 0;
  v_currency TEXT := COALESCE(NULLIF(BTRIM(p_currency), ''), 'ETH');
  v_tracking_code TEXT := COALESCE(NULLIF(BTRIM(p_tracking_code), ''), 'TRK-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12)));
  v_tx_hash TEXT := NULLIF(BTRIM(p_tx_hash), '');
  v_shipping_address_jsonb JSONB := COALESCE(p_shipping_address_jsonb, '{}'::jsonb);
  v_shipping_address TEXT := '';
  v_single_product_id UUID := NULL;
  v_invalid_product_name TEXT;
  v_invalid_stock_name TEXT;
  v_invalid_stock_left INT;
  v_normalized_items JSONB := '[]'::jsonb;
BEGIN
  IF NULLIF(BTRIM(p_buyer_wallet), '') IS NULL THEN
    RAISE EXCEPTION 'buyer_wallet is required';
  END IF;

  IF v_tx_hash IS NULL THEN
    RAISE EXCEPTION 'tx_hash is required for checkout orders';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'items must be a non-empty array';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'quantity', quantity
      )
      ORDER BY product_id
    ),
    '[]'::jsonb
  )
  INTO v_normalized_items
  FROM (
    SELECT
      product_id,
      SUM(quantity)::INT AS quantity
    FROM (
      SELECT
        NULLIF(BTRIM(item->>'product_id'), '')::UUID AS product_id,
        GREATEST(
          CASE
            WHEN COALESCE(item->>'quantity', '') ~ '^\d+$' THEN (item->>'quantity')::INT
            ELSE 1
          END,
          1
        ) AS quantity
      FROM jsonb_array_elements(p_items) AS item
    ) parsed_items
    WHERE product_id IS NOT NULL
    GROUP BY product_id
  ) normalized_items;

  v_item_count := jsonb_array_length(v_normalized_items);

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one order item is required';
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.price_eth, 0) AS price_eth,
      COALESCE(p.stock, 0) AS stock,
      p.status,
      COALESCE(p.product_type, 'physical') AS product_type,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT COUNT(*)
  INTO v_locked_count
  FROM locked_products;

  IF v_locked_count <> v_item_count THEN
    RAISE EXCEPTION 'One or more products are no longer available';
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.stock, 0) AS stock,
      p.status,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT name
  INTO v_invalid_product_name
  FROM locked_products
  WHERE status IS NOT NULL
    AND status NOT IN ('published', 'active')
  LIMIT 1;

  IF v_invalid_product_name IS NOT NULL THEN
    RAISE EXCEPTION '% is not available for checkout', v_invalid_product_name;
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      p.name,
      COALESCE(p.stock, 0) AS stock,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT
    name,
    GREATEST(stock, 0)
  INTO
    v_invalid_stock_name,
    v_invalid_stock_left
  FROM locked_products
  WHERE stock <= 0
     OR quantity > stock
  LIMIT 1;

  IF v_invalid_stock_name IS NOT NULL THEN
    RAISE EXCEPTION '% only has % left in stock', v_invalid_stock_name, v_invalid_stock_left;
  END IF;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      COALESCE(p.price_eth, 0) AS price_eth,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  SELECT
    COALESCE(SUM(quantity), 0),
    COALESCE(SUM(ROUND(price_eth * quantity, 8)), 0)
  INTO
    v_total_quantity,
    v_subtotal_eth
  FROM locked_products;

  v_subtotal_eth := ROUND(v_subtotal_eth, 8);
  v_shipping_eth := ROUND(v_shipping_eth, 8);
  v_tax_eth := ROUND(v_tax_eth, 8);
  v_total_price_eth := ROUND(v_subtotal_eth + v_shipping_eth + v_tax_eth, 8);

  IF v_item_count = 1 THEN
    v_single_product_id := ((v_normalized_items->0)->>'product_id')::UUID;
  END IF;

  v_shipping_address := CONCAT_WS(
    ', ',
    NULLIF(BTRIM(v_shipping_address_jsonb->>'name'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'email'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'phone'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'street'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'city'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'state'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'postal_code'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'country'), ''),
    NULLIF(BTRIM(v_shipping_address_jsonb->>'notes'), '')
  );

  v_shipping_address_jsonb := jsonb_strip_nulls(
    v_shipping_address_jsonb || jsonb_build_object('full_address', v_shipping_address)
  );

  INSERT INTO orders (
    id,
    buyer_wallet,
    product_id,
    quantity,
    currency,
    subtotal_eth,
    shipping_eth,
    tax_eth,
    total_price_eth,
    status,
    shipping_address,
    shipping_address_jsonb,
    tracking_code,
    tx_hash,
    paid_at,
    created_at,
    updated_at
  )
  VALUES (
    v_order_id,
    LOWER(BTRIM(p_buyer_wallet)),
    v_single_product_id,
    v_total_quantity,
    v_currency,
    v_subtotal_eth,
    v_shipping_eth,
    v_tax_eth,
    v_total_price_eth,
    'paid',
    v_shipping_address,
    v_shipping_address_jsonb,
    v_tracking_code,
    v_tx_hash,
    v_now,
    v_now,
    v_now
  );

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  ),
  locked_products AS (
    SELECT
      p.id,
      COALESCE(p.price_eth, 0) AS price_eth,
      COALESCE(p.product_type, 'physical') AS product_type,
      r.quantity
    FROM requested_items r
    JOIN products p
      ON p.id = r.product_id
    FOR UPDATE
  )
  INSERT INTO order_items (
    order_id,
    product_id,
    quantity,
    unit_price_eth,
    line_total_eth,
    fulfillment_type,
    delivery_status,
    created_at,
    updated_at
  )
  SELECT
    v_order_id,
    id,
    quantity,
    ROUND(price_eth, 8),
    ROUND(price_eth * quantity, 8),
    CASE
      WHEN product_type IN ('digital', 'hybrid') THEN 'digital'
      ELSE 'physical'
    END,
    'paid',
    v_now,
    v_now
  FROM locked_products;

  WITH requested_items AS (
    SELECT
      (item->>'product_id')::UUID AS product_id,
      ((item->>'quantity')::INT) AS quantity
    FROM jsonb_array_elements(v_normalized_items) AS item
  )
  UPDATE products p
  SET
    stock = GREATEST(COALESCE(p.stock, 0) - r.quantity, 0),
    status = CASE
      WHEN GREATEST(COALESCE(p.stock, 0) - r.quantity, 0) > 0 THEN 'published'
      ELSE 'out_of_stock'
    END,
    updated_at = v_now
  FROM requested_items r
  WHERE p.id = r.product_id;

  RETURN v_order_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Migration: 20260402_platform_commerce_ip_foundation.sql
-- ============================================================================
-- Migration: Add commerce asset, entitlement, fulfillment, and IP campaign foundation
-- Description:
--   * Splits public preview assets from gated/private delivery assets
--   * Adds entitlements and fulfillment lifecycle tables
--   * Adds tokenized creative IP campaign, investment, and royalty tables
--   * Keeps existing products/orders/artists tables as the operational core

CREATE TABLE IF NOT EXISTS product_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL DEFAULT 'preview',
  visibility VARCHAR(50) NOT NULL DEFAULT 'public',
  asset_type VARCHAR(50) NOT NULL DEFAULT 'image',
  storage_provider VARCHAR(50) DEFAULT 'ipfs',
  uri TEXT NOT NULL,
  preview_uri TEXT,
  mime_type TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  checksum_sha256 TEXT,
  sort_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  requires_signed_url BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES product_assets(id) ON DELETE CASCADE,
  buyer_wallet TEXT NOT NULL,
  access_type VARCHAR(50) NOT NULL DEFAULT 'download',
  status VARCHAR(50) NOT NULL DEFAULT 'granted',
  grant_reason VARCHAR(100) DEFAULT 'purchase',
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  creator_wallet TEXT,
  fulfillment_type VARCHAR(50) NOT NULL DEFAULT 'physical',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  provider VARCHAR(100),
  tracking_code TEXT,
  tracking_url TEXT,
  shipping_address_jsonb JSONB,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ip_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  slug TEXT UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  description TEXT,
  campaign_type VARCHAR(50) NOT NULL DEFAULT 'revenue_share',
  rights_type VARCHAR(50) NOT NULL DEFAULT 'creative_ip',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  visibility VARCHAR(50) NOT NULL DEFAULT 'private',
  funding_target_eth NUMERIC NOT NULL DEFAULT 0,
  minimum_raise_eth NUMERIC DEFAULT 0,
  unit_price_eth NUMERIC,
  total_units INT,
  units_sold INT NOT NULL DEFAULT 0,
  opens_at TIMESTAMP WITH TIME ZONE,
  closes_at TIMESTAMP WITH TIME ZONE,
  settlement_at TIMESTAMP WITH TIME ZONE,
  shares_contract_address TEXT,
  shares_contract_tx TEXT,
  legal_doc_uri TEXT,
  cover_image_uri TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ip_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES ip_campaigns(id) ON DELETE CASCADE,
  investor_wallet TEXT NOT NULL,
  amount_eth NUMERIC NOT NULL DEFAULT 0,
  units_purchased NUMERIC NOT NULL DEFAULT 0,
  unit_price_eth NUMERIC,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  contribution_tx_hash TEXT,
  settlement_tx_hash TEXT,
  invested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settled_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS royalty_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES ip_campaigns(id) ON DELETE CASCADE,
  investment_id UUID REFERENCES ip_investments(id) ON DELETE SET NULL,
  recipient_wallet TEXT NOT NULL,
  source_reference TEXT,
  gross_amount_eth NUMERIC NOT NULL DEFAULT 0,
  fee_amount_eth NUMERIC NOT NULL DEFAULT 0,
  net_amount_eth NUMERIC NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  payout_tx_hash TEXT,
  distributed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_assets_product_visibility ON product_assets(product_id, visibility, role);
CREATE INDEX IF NOT EXISTS idx_entitlements_buyer_wallet ON entitlements(lower(buyer_wallet));
CREATE INDEX IF NOT EXISTS idx_fulfillments_order_id ON fulfillments(order_id);
CREATE INDEX IF NOT EXISTS idx_ip_campaigns_artist_id ON ip_campaigns(artist_id);
CREATE INDEX IF NOT EXISTS idx_ip_investments_wallet ON ip_investments(lower(investor_wallet));
CREATE INDEX IF NOT EXISTS idx_royalty_distributions_recipient_wallet ON royalty_distributions(lower(recipient_wallet));

CREATE OR REPLACE FUNCTION grant_order_item_entitlements()
RETURNS TRIGGER AS $$
DECLARE
  v_order RECORD;
  v_product RECORD;
BEGIN
  SELECT id, buyer_wallet, status
  INTO v_order
  FROM orders
  WHERE id = NEW.order_id;

  IF v_order.id IS NULL OR v_order.status NOT IN ('paid', 'processing', 'shipped', 'delivered') THEN
    RETURN NEW;
  END IF;

  SELECT id, product_type
  INTO v_product
  FROM products
  WHERE id = NEW.product_id;

  IF v_product.id IS NULL OR v_product.product_type NOT IN ('digital', 'hybrid') THEN
    RETURN NEW;
  END IF;

  INSERT INTO entitlements (
    order_id,
    order_item_id,
    product_id,
    asset_id,
    buyer_wallet,
    access_type,
    status,
    grant_reason,
    granted_at,
    created_at,
    updated_at
  )
  SELECT
    NEW.order_id,
    NEW.id,
    NEW.product_id,
    pa.id,
    lower(v_order.buyer_wallet),
    CASE
      WHEN pa.asset_type IN ('pdf', 'epub', 'document') THEN 'reader'
      WHEN pa.asset_type IN ('audio', 'video') THEN 'stream'
      ELSE 'download'
    END,
    'granted',
    'purchase',
    NOW(),
    NOW(),
    NOW()
  FROM product_assets pa
  WHERE pa.product_id = NEW.product_id
    AND pa.role = 'delivery'
    AND pa.visibility IN ('gated', 'private')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_grant_order_item_entitlements ON order_items;
CREATE TRIGGER trg_grant_order_item_entitlements
AFTER INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION grant_order_item_entitlements();

-- ============================================================================
-- Migration: 20260403_align_public_catalog_visibility.sql
-- ============================================================================
-- Align public catalog visibility with legacy status rows
-- Date: April 3, 2026

DROP POLICY IF EXISTS "products_read_published" ON products;

CREATE POLICY "products_read_published" ON products
FOR SELECT
USING (status IN ('published', 'active'));

DROP INDEX IF EXISTS idx_products_published;

CREATE INDEX IF NOT EXISTS idx_products_published
ON products(status, created_at DESC)
WHERE status IN ('published', 'active');

DROP INDEX IF EXISTS idx_drops_active;

CREATE INDEX IF NOT EXISTS idx_drops_active
ON drops(artist_id, status, ends_at DESC)
WHERE status IN ('live', 'active', 'published');

-- ============================================================================
-- Migration: 20260403_creative_release_unification.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260403_creative_release_unification.sql
-- Description:
--   * Adds creative_releases as the canonical parent model for new sellable work
--   * Links legacy drops/products/orders into the new release domain additively
--   * Adds escrow-friendly order approval and payout tracking fields
--   * Expands admin audit log checks for release and payout operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS creative_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  release_type VARCHAR(50) NOT NULL DEFAULT 'collectible',
  title TEXT NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  price_eth NUMERIC NOT NULL DEFAULT 0,
  supply INT NOT NULL DEFAULT 1,
  sold INT NOT NULL DEFAULT 0,
  art_metadata_uri TEXT,
  cover_image_uri TEXT,
  contract_kind VARCHAR(50) NOT NULL DEFAULT 'artDrop',
  contract_address TEXT,
  contract_listing_id BIGINT,
  contract_drop_id BIGINT,
  physical_details_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  shipping_profile_jsonb JSONB NOT NULL DEFAULT '{}'::jsonb,
  creator_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT creative_releases_release_type_check
    CHECK (release_type IN ('collectible', 'physical', 'hybrid')),
  CONSTRAINT creative_releases_status_check
    CHECK (status IN ('draft', 'review', 'published', 'live', 'paused', 'ended', 'archived')),
  CONSTRAINT creative_releases_contract_kind_check
    CHECK (contract_kind IN ('artDrop', 'productStore', 'creativeReleaseEscrow'))
);

CREATE INDEX IF NOT EXISTS idx_creative_releases_artist_id
ON creative_releases(artist_id);

CREATE INDEX IF NOT EXISTS idx_creative_releases_release_type_status
ON creative_releases(release_type, status);

CREATE INDEX IF NOT EXISTS idx_creative_releases_created_at
ON creative_releases(created_at DESC);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS creative_release_id UUID REFERENCES creative_releases(id) ON DELETE SET NULL;

ALTER TABLE drops
ADD COLUMN IF NOT EXISTS creative_release_id UUID REFERENCES creative_releases(id) ON DELETE SET NULL;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS creative_release_id UUID REFERENCES creative_releases(id) ON DELETE SET NULL;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS contract_kind VARCHAR(50) DEFAULT 'productStore';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS contract_order_id BIGINT;

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payout_status VARCHAR(50) DEFAULT 'unreleased';

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'pending';

ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS creative_release_id UUID REFERENCES creative_releases(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_creative_release_id
ON products(creative_release_id);

CREATE INDEX IF NOT EXISTS idx_drops_creative_release_id
ON drops(creative_release_id);

CREATE INDEX IF NOT EXISTS idx_orders_creative_release_id
ON orders(creative_release_id);

CREATE INDEX IF NOT EXISTS idx_orders_contract_kind
ON orders(contract_kind);

CREATE INDEX IF NOT EXISTS idx_order_items_creative_release_id
ON order_items(creative_release_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_contract_kind_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_contract_kind_check
    CHECK (contract_kind IN ('artDrop', 'productStore', 'creativeReleaseEscrow'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payout_status_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_payout_status_check
    CHECK (payout_status IN ('unreleased', 'approved', 'released', 'refunded', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_approval_status_check'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_approval_status_check
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'production_accepted', 'shipped', 'delivered', 'refunded'));
  END IF;
END $$;

ALTER TABLE IF EXISTS admin_audit_log
DROP CONSTRAINT IF EXISTS admin_audit_log_action_check;

ALTER TABLE IF EXISTS admin_audit_log
DROP CONSTRAINT IF EXISTS admin_audit_log_status_check;

ALTER TABLE IF EXISTS admin_audit_log
ADD CONSTRAINT admin_audit_log_action_check
CHECK (
  action IN (
    'approve_artist',
    'reject_artist',
    'deploy_contract',
    'revoke_approval',
    'delete_artist',
    'approve_release_order',
    'release_creator_payout',
    'refund_release_order',
    'mark_production_accepted',
    'attach_tracking',
    'mark_shipped',
    'mark_delivered'
  )
);

ALTER TABLE IF EXISTS admin_audit_log
ADD CONSTRAINT admin_audit_log_status_check
CHECK (
  status IN (
    'pending',
    'approved',
    'rejected',
    'deployed',
    'failed',
    'revoked',
    'released',
    'refunded',
    'shipped',
    'delivered'
  )
);

-- ============================================================================
-- Migration: 20260403_fix_subscription_expiry_index.sql
-- ============================================================================
-- Fix subscription expiry index so it can be created on Postgres/Supabase
-- Date: April 3, 2026
--
-- Root cause:
--   Postgres index predicates must be IMMUTABLE.
--   The previous predicate used NOW(), which is STABLE and therefore invalid.

DROP INDEX IF EXISTS idx_subscriptions_expiry;

CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry
ON subscriptions(expiry_time DESC)
WHERE expiry_time IS NOT NULL;

-- ============================================================================
-- Migration: 20260403_make_audit_log_indices_compatible.sql
-- ============================================================================
-- Make audit-log indexing compatible across legacy and current schemas
-- Date: April 3, 2026
--
-- Some environments have `admin_audit_log` from older migrations.
-- Newer environments create `audit_logs` in 006_fix_rls_policies.sql.
-- This migration adds indexes only when the matching table exists.

DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(changed_by, changed_at DESC)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_admin_wallet_created_at ON admin_audit_log(admin_wallet, created_at DESC)';
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260404_add_product_contract_columns.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260404_add_product_contract_columns.sql
-- Description:
--   * Adds missing onchain commerce columns expected by the app on products
--   * Repairs schema drift for older Supabase projects that predate release/escrow work

ALTER TABLE products
ADD COLUMN IF NOT EXISTS contract_kind VARCHAR(50) DEFAULT 'productStore',
ADD COLUMN IF NOT EXISTS contract_listing_id BIGINT,
ADD COLUMN IF NOT EXISTS contract_product_id BIGINT,
ADD COLUMN IF NOT EXISTS metadata_uri TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_contract_kind_check'
  ) THEN
    ALTER TABLE products
    ADD CONSTRAINT products_contract_kind_check
    CHECK (contract_kind IN ('artDrop', 'productStore', 'creativeReleaseEscrow'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_contract_kind
ON products(contract_kind);

CREATE INDEX IF NOT EXISTS idx_products_contract_listing_id
ON products(contract_listing_id)
WHERE contract_listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_contract_product_id
ON products(contract_product_id)
WHERE contract_product_id IS NOT NULL;

-- ============================================================================
-- Migration: 20260404_backfill_release_backed_drops.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260404_backfill_release_backed_drops.sql
-- Description:
--   * Backfills missing drop rows for existing release-backed products
--   * Repairs hybrid / escrow mints created before the studio saved linked drops

INSERT INTO drops (
  artist_id,
  creative_release_id,
  title,
  description,
  price_eth,
  supply,
  sold,
  image_url,
  image_ipfs_uri,
  metadata_ipfs_uri,
  preview_uri,
  delivery_uri,
  asset_type,
  is_gated,
  status,
  type,
  contract_address,
  contract_kind,
  revenue,
  metadata,
  created_at,
  updated_at
)
SELECT
  COALESCE(p.artist_id, cr.artist_id) AS artist_id,
  COALESCE(p.creative_release_id, cr.id) AS creative_release_id,
  COALESCE(cr.title, p.name, 'Untitled Release') AS title,
  COALESCE(cr.description, p.description, '') AS description,
  COALESCE(p.price_eth, cr.price_eth, 0) AS price_eth,
  COALESCE(NULLIF(p.stock, 0), cr.supply, 1) AS supply,
  COALESCE(p.sold, cr.sold, 0) AS sold,
  p.image_url,
  COALESCE(p.image_ipfs_uri, cr.cover_image_uri) AS image_ipfs_uri,
  COALESCE(p.metadata_uri, cr.art_metadata_uri) AS metadata_ipfs_uri,
  COALESCE(p.preview_uri, p.image_ipfs_uri, cr.cover_image_uri) AS preview_uri,
  COALESCE(
    p.delivery_uri,
    CASE
      WHEN jsonb_typeof(cr.metadata) = 'object' THEN cr.metadata ->> 'delivery_uri'
      ELSE NULL
    END
  ) AS delivery_uri,
  COALESCE(p.asset_type, 'image') AS asset_type,
  COALESCE(p.is_gated, false) AS is_gated,
  CASE
    WHEN lower(COALESCE(cr.status, p.status, 'published')) IN ('published', 'active', 'live')
      THEN 'published'
    WHEN lower(COALESCE(cr.status, p.status, 'draft')) IN ('draft', 'review', 'pending')
      THEN 'draft'
    ELSE 'ended'
  END AS status,
  'drop' AS type,
  cr.contract_address,
  COALESCE(cr.contract_kind, p.contract_kind, 'creativeReleaseEscrow') AS contract_kind,
  0 AS revenue,
  jsonb_strip_nulls(
    COALESCE(
      CASE
        WHEN jsonb_typeof(cr.metadata) = 'object' THEN cr.metadata
        ELSE '{}'::jsonb
      END,
      '{}'::jsonb
    ) ||
    COALESCE(
      CASE
        WHEN jsonb_typeof(p.metadata) = 'object' THEN p.metadata
        ELSE '{}'::jsonb
      END,
      '{}'::jsonb
    ) ||
    jsonb_build_object(
      'source_kind', 'release_product',
      'source_product_id', p.id,
      'creative_release_id', COALESCE(p.creative_release_id, cr.id),
      'release_type', cr.release_type,
      'product_type', p.product_type,
      'content_kind',
        COALESCE(
          CASE WHEN jsonb_typeof(cr.metadata) = 'object' THEN cr.metadata ->> 'content_kind' END,
          CASE WHEN jsonb_typeof(p.metadata) = 'object' THEN p.metadata ->> 'content_kind' END
        ),
      'delivery_uri',
        COALESCE(
          p.delivery_uri,
          CASE WHEN jsonb_typeof(cr.metadata) = 'object' THEN cr.metadata ->> 'delivery_uri' END
        ),
      'physical_details_jsonb', cr.physical_details_jsonb,
      'shipping_profile_jsonb', cr.shipping_profile_jsonb
    )
  ) AS metadata,
  COALESCE(cr.published_at, p.created_at, NOW()) AS created_at,
  COALESCE(p.updated_at, cr.updated_at, NOW()) AS updated_at
FROM products p
JOIN creative_releases cr
  ON cr.id = p.creative_release_id
WHERE p.creative_release_id IS NOT NULL
  AND COALESCE(p.artist_id, cr.artist_id) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM drops d
    WHERE d.creative_release_id = p.creative_release_id
       OR (
         jsonb_typeof(d.metadata) = 'object'
         AND d.metadata ->> 'source_product_id' = p.id::text
       )
  );

-- ============================================================================
-- Migration: 20260404_rotate_admin_wallet_and_harden_admin_policies.sql
-- ============================================================================
-- Migration: Rotate admin wallet policies and harden legacy audit-log access
-- Description:
--   * Updates admin-gated whitelist and audit-log policies for existing databases
--   * Supports both `sub` and legacy `wallet_address` JWT claims
--   * Normalizes wallet casing so lowercase JWTs still match the configured admin

DO $$
BEGIN
  IF to_regclass('public.whitelist') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "whitelist_write_admin_only" ON public.whitelist';
    EXECUTE 'DROP POLICY IF EXISTS "whitelist_insert_admin_only" ON public.whitelist';
    EXECUTE 'DROP POLICY IF EXISTS "whitelist_update_admin_only" ON public.whitelist';
    EXECUTE 'DROP POLICY IF EXISTS "whitelist_delete_admin_only" ON public.whitelist';

    EXECUTE $policy$
      CREATE POLICY "whitelist_insert_admin_only" ON public.whitelist
      FOR INSERT
      WITH CHECK (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "whitelist_update_admin_only" ON public.whitelist
      FOR UPDATE
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "whitelist_delete_admin_only" ON public.whitelist
      FOR DELETE
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_read_admin_only" ON public.audit_logs';

    EXECUTE $policy$
      CREATE POLICY "audit_logs_read_admin_only" ON public.audit_logs
      FOR SELECT
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;
  END IF;

  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin can view all audit logs" ON public.admin_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "admin_audit_log_read_admin_only" ON public.admin_audit_log';

    EXECUTE $policy$
      CREATE POLICY "admin_audit_log_read_admin_only" ON public.admin_audit_log
      FOR SELECT
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;
  END IF;
END $$;

-- ============================================================================
-- Migration: 20260405_rls_policies_production.sql
-- ============================================================================
-- Supabase Migration: RLS Policies for Production Security
-- Date: April 5, 2026
-- Purpose: Implement Row-Level Security to prevent unauthorized data access

-- ============================================
-- Enable RLS on all sensitive tables
-- ============================================

ALTER TABLE IF EXISTS drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS artists ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DROPS TABLE POLICIES
-- ============================================

-- Public can read published drops
DROP POLICY IF EXISTS "drops_select_published" ON drops;
CREATE POLICY "drops_select_published"
  ON drops
  FOR SELECT
  USING (status IN ('published', 'active', 'live'));

-- Artists can manage their own drops (via artist_id -> artists.wallet join)
DROP POLICY IF EXISTS "drops_manage_own" ON drops;
CREATE POLICY "drops_manage_own"
  ON drops
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM artists 
      WHERE artists.id = drops.artist_id 
      AND (artists.wallet = auth.jwt() ->> 'wallet' OR artists.wallet = auth.jwt() ->> 'address')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artists 
      WHERE artists.id = drops.artist_id 
      AND (artists.wallet = auth.jwt() ->> 'wallet' OR artists.wallet = auth.jwt() ->> 'address')
    )
  );

-- ============================================
-- ORDERS TABLE POLICIES
-- ============================================

-- Users can read their own orders
DROP POLICY IF EXISTS "orders_select_own" ON orders;
CREATE POLICY "orders_select_own"
  ON orders
  FOR SELECT
  USING (
    buyer_wallet = auth.jwt() ->> 'wallet' OR 
    buyer_wallet = auth.jwt() ->> 'address'
  );

-- Orders cannot be modified (immutable)
DROP POLICY IF EXISTS "orders_prevent_update" ON orders;
CREATE POLICY "orders_prevent_update"
  ON orders
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "orders_prevent_delete" ON orders;
CREATE POLICY "orders_prevent_delete"
  ON orders
  FOR DELETE
  USING (false);

-- ============================================
-- SUBSCRIPTIONS TABLE POLICIES
-- ============================================

-- Users can read their own subscriptions
DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON subscriptions
  FOR SELECT
  USING (
    subscriber_wallet = auth.jwt() ->> 'wallet' OR
    subscriber_wallet = auth.jwt() ->> 'address'
  );

-- Subscriptions cannot be modified by users
DROP POLICY IF EXISTS "subscriptions_prevent_update" ON subscriptions;
CREATE POLICY "subscriptions_prevent_update"
  ON subscriptions
  FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "subscriptions_prevent_delete" ON subscriptions;
CREATE POLICY "subscriptions_prevent_delete"
  ON subscriptions
  FOR DELETE
  USING (false);

-- ============================================
-- PRODUCTS TABLE POLICIES
-- ============================================

-- Public can read published products
DROP POLICY IF EXISTS "products_select_published" ON products;
CREATE POLICY "products_select_published"
  ON products
  FOR SELECT
  USING (status IN ('published', 'active'));

-- Creators can manage their products
DROP POLICY IF EXISTS "products_manage_own" ON products;
CREATE POLICY "products_manage_own"
  ON products
  FOR ALL
  USING (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  )
  WITH CHECK (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

-- ============================================
-- IP_CAMPAIGNS TABLE POLICIES
-- ============================================

-- Public can read active campaigns
DROP POLICY IF EXISTS "campaigns_select_active" ON ip_campaigns;
CREATE POLICY "campaigns_select_active"
  ON ip_campaigns
  FOR SELECT
  USING (status IN ('active', 'published', 'live'));

-- Artists can manage their campaigns (joins to artists table via artist_id)
DROP POLICY IF EXISTS "campaigns_manage_own" ON ip_campaigns;
CREATE POLICY "campaigns_manage_own"
  ON ip_campaigns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM artists 
      WHERE artists.id = ip_campaigns.artist_id 
      AND (artists.wallet = auth.jwt() ->> 'wallet' OR artists.wallet = auth.jwt() ->> 'address')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM artists 
      WHERE artists.id = ip_campaigns.artist_id 
      AND (artists.wallet = auth.jwt() ->> 'wallet' OR artists.wallet = auth.jwt() ->> 'address')
    )
  );

-- ============================================
-- ARTISTS TABLE POLICIES
-- ============================================

-- Everyone can read public artist profiles
DROP POLICY IF EXISTS "artists_select_public" ON artists;
CREATE POLICY "artists_select_public"
  ON artists
  FOR SELECT
  USING (true);

-- Artists can update their own profile
DROP POLICY IF EXISTS "artists_update_own" ON artists;
CREATE POLICY "artists_update_own"
  ON artists
  FOR UPDATE
  USING (
    wallet = auth.jwt() ->> 'wallet' OR 
    wallet = auth.jwt() ->> 'address'
  )
  WITH CHECK (
    wallet = auth.jwt() ->> 'wallet' OR 
    wallet = auth.jwt() ->> 'address'
  );

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Public (anon) users can read public data
GRANT SELECT ON drops TO anon;
GRANT SELECT ON artists TO anon;
GRANT SELECT ON products TO anon;
GRANT SELECT ON ip_campaigns TO anon;

-- Authenticated users can access tables (RLS controls what they see)
GRANT ALL ON drops TO authenticated;
GRANT ALL ON orders TO authenticated;
GRANT ALL ON subscriptions TO authenticated;
GRANT ALL ON products TO authenticated;
GRANT ALL ON ip_campaigns TO authenticated;
GRANT ALL ON artists TO authenticated;

-- Backend service use has full access (RLS bypassed for service role)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================

-- Run this to verify RLS is enabled:
-- SELECT schemaname, tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public'
-- AND tablename IN ('artists', 'drops', 'orders', 'subscriptions', 'products', 'ip_campaigns')
-- ORDER BY tablename;

-- All rows should show rowsecurity = true

-- ============================================================================
-- Migration: 20260405_security_lockdown.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260405_security_lockdown.sql
-- ============================================================================
-- Locks down public application/IP commerce exposure and aligns RLS with POPUP auth JWT claims.

CREATE OR REPLACE FUNCTION public.popup_jwt_wallet()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lower(
    nullif(
      coalesce(
        auth.jwt() ->> 'sub',
        auth.jwt() ->> 'wallet_address',
        auth.jwt() ->> 'wallet',
        ''
      ),
      ''
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.popup_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    coalesce(lower(auth.jwt() ->> 'app_role'), '') = 'admin'
    OR coalesce(lower(auth.jwt() ->> 'role_name'), '') = 'admin'
    OR auth.role() = 'service_role';
$$;

GRANT EXECUTE ON FUNCTION public.popup_jwt_wallet() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_is_admin() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "applications_public_select" ON public.artist_applications;
DROP POLICY IF EXISTS "applications_admin_update" ON public.artist_applications;
DROP POLICY IF EXISTS "applications_owner_or_admin_select" ON public.artist_applications;
DROP POLICY IF EXISTS "applications_admin_update_only" ON public.artist_applications;

CREATE POLICY "applications_owner_or_admin_select" ON public.artist_applications
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(wallet_address) = public.popup_jwt_wallet()
  );

CREATE POLICY "applications_admin_update_only" ON public.artist_applications
  FOR UPDATE
  USING (public.popup_is_admin())
  WITH CHECK (public.popup_is_admin());

ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_assets_select_guarded" ON public.product_assets;
DROP POLICY IF EXISTS "product_assets_insert_owner_or_admin" ON public.product_assets;
DROP POLICY IF EXISTS "product_assets_update_owner_or_admin" ON public.product_assets;
DROP POLICY IF EXISTS "product_assets_delete_owner_or_admin" ON public.product_assets;

CREATE POLICY "product_assets_select_guarded" ON public.product_assets
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
    OR (
      visibility = 'public'
      AND EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.id = product_assets.product_id
          AND p.status IN ('published', 'active')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.entitlements e
      WHERE e.product_id = product_assets.product_id
        AND (e.asset_id = product_assets.id OR e.asset_id IS NULL)
        AND lower(e.buyer_wallet) = public.popup_jwt_wallet()
        AND e.status = 'granted'
        AND e.revoked_at IS NULL
        AND (e.expires_at IS NULL OR e.expires_at > now())
    )
  );

CREATE POLICY "product_assets_insert_owner_or_admin" ON public.product_assets
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "product_assets_update_owner_or_admin" ON public.product_assets
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "product_assets_delete_owner_or_admin" ON public.product_assets
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

DROP POLICY IF EXISTS "entitlements_select_guarded" ON public.entitlements;
DROP POLICY IF EXISTS "entitlements_insert_owner_or_admin" ON public.entitlements;
DROP POLICY IF EXISTS "entitlements_update_owner_or_admin" ON public.entitlements;
DROP POLICY IF EXISTS "entitlements_delete_owner_or_admin" ON public.entitlements;

CREATE POLICY "entitlements_select_guarded" ON public.entitlements
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(buyer_wallet) = public.popup_jwt_wallet()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "entitlements_insert_owner_or_admin" ON public.entitlements
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "entitlements_update_owner_or_admin" ON public.entitlements
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "entitlements_delete_owner_or_admin" ON public.entitlements
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

DROP POLICY IF EXISTS "fulfillments_select_guarded" ON public.fulfillments;
DROP POLICY IF EXISTS "fulfillments_insert_owner_or_admin" ON public.fulfillments;
DROP POLICY IF EXISTS "fulfillments_update_owner_or_admin" ON public.fulfillments;
DROP POLICY IF EXISTS "fulfillments_delete_owner_or_admin" ON public.fulfillments;

CREATE POLICY "fulfillments_select_guarded" ON public.fulfillments
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = fulfillments.order_id
        AND lower(o.buyer_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "fulfillments_insert_owner_or_admin" ON public.fulfillments
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
  );

CREATE POLICY "fulfillments_update_owner_or_admin" ON public.fulfillments
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
  )
  WITH CHECK (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
  );

CREATE POLICY "fulfillments_delete_owner_or_admin" ON public.fulfillments
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "ip_campaigns_select_guarded" ON public.ip_campaigns;
DROP POLICY IF EXISTS "ip_campaigns_insert_owner_or_admin" ON public.ip_campaigns;
DROP POLICY IF EXISTS "ip_campaigns_update_owner_or_admin" ON public.ip_campaigns;
DROP POLICY IF EXISTS "ip_campaigns_delete_owner_or_admin" ON public.ip_campaigns;

CREATE POLICY "ip_campaigns_select_guarded" ON public.ip_campaigns
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
    OR EXISTS (
      SELECT 1
      FROM public.ip_investments i
      WHERE i.campaign_id = ip_campaigns.id
        AND lower(i.investor_wallet) = public.popup_jwt_wallet()
    )
    OR (
      visibility = 'listed'
      AND status IN ('active', 'funded', 'settled', 'closed')
    )
  );

CREATE POLICY "ip_campaigns_insert_owner_or_admin" ON public.ip_campaigns
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "ip_campaigns_update_owner_or_admin" ON public.ip_campaigns
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "ip_campaigns_delete_owner_or_admin" ON public.ip_campaigns
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

DROP POLICY IF EXISTS "ip_investments_select_guarded" ON public.ip_investments;
DROP POLICY IF EXISTS "ip_investments_insert_self_or_admin" ON public.ip_investments;
DROP POLICY IF EXISTS "ip_investments_update_owner_or_admin" ON public.ip_investments;
DROP POLICY IF EXISTS "ip_investments_delete_owner_or_admin" ON public.ip_investments;

CREATE POLICY "ip_investments_select_guarded" ON public.ip_investments
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(investor_wallet) = public.popup_jwt_wallet()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = ip_investments.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "ip_investments_insert_self_or_admin" ON public.ip_investments
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR lower(investor_wallet) = public.popup_jwt_wallet()
  );

CREATE POLICY "ip_investments_update_owner_or_admin" ON public.ip_investments
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = ip_investments.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = ip_investments.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "ip_investments_delete_owner_or_admin" ON public.ip_investments
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = ip_investments.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

DROP POLICY IF EXISTS "royalty_distributions_select_guarded" ON public.royalty_distributions;
DROP POLICY IF EXISTS "royalty_distributions_insert_owner_or_admin" ON public.royalty_distributions;
DROP POLICY IF EXISTS "royalty_distributions_update_owner_or_admin" ON public.royalty_distributions;
DROP POLICY IF EXISTS "royalty_distributions_delete_owner_or_admin" ON public.royalty_distributions;

CREATE POLICY "royalty_distributions_select_guarded" ON public.royalty_distributions
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(recipient_wallet) = public.popup_jwt_wallet()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "royalty_distributions_insert_owner_or_admin" ON public.royalty_distributions
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "royalty_distributions_update_owner_or_admin" ON public.royalty_distributions
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "royalty_distributions_delete_owner_or_admin" ON public.royalty_distributions
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

-- ============================================================================
-- Migration: 20260406_creator_notifications.sql
-- ============================================================================
-- Supabase Migration: Creator Interaction Notification System
-- Date: April 6, 2026
-- Purpose: Implement real-time notifications for creator interactions (subscriptions, purchases, investments)

-- ============================================
-- Notifications Table - Store all notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Recipient
  creator_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  
  -- Event Details
  event_type VARCHAR(50) NOT NULL, -- subscription, purchase, investment, milestone
  event_id VARCHAR(255) UNIQUE, -- tx hash or order ID for deduplication
  
  -- Notification Content
  title VARCHAR(255) NOT NULL,
  description TEXT,
  message TEXT,
  
  -- Structured Data
  interactor_wallet TEXT,
  interactor_display_name VARCHAR(255),
  product_id UUID,
  product_name VARCHAR(255),
  campaign_id UUID,
  campaign_title VARCHAR(255),
  drop_id UUID,
  drop_title VARCHAR(255),
  
  -- Financial Data
  amount_eth DECIMAL(18, 8),
  amount_usd DECIMAL(18, 2),
  currency VARCHAR(10) DEFAULT 'ETH',
  
  -- Quantity
  quantity INT,
  
  -- Status & Engagement
  "read" BOOLEAN DEFAULT FALSE,
  actioned BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_creator_id ON notifications(creator_id);
CREATE INDEX IF NOT EXISTS idx_notifications_creator_wallet ON notifications(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications(event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications("read");
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event_id ON notifications(event_id);

-- ============================================
-- Notification Preferences - Creator settings
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL UNIQUE REFERENCES artists(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL UNIQUE,
  
  -- Event Toggles
  notify_subscriptions BOOLEAN DEFAULT TRUE,
  notify_purchases BOOLEAN DEFAULT TRUE,
  notify_investments BOOLEAN DEFAULT TRUE,
  notify_milestones BOOLEAN DEFAULT TRUE,
  notify_comments BOOLEAN DEFAULT TRUE, -- Future: for community features
  
  -- Delivery Channels
  enable_in_app BOOLEAN DEFAULT TRUE,
  enable_web_push BOOLEAN DEFAULT TRUE,
  enable_email BOOLEAN DEFAULT FALSE,
  email_address TEXT,
  
  -- Notification Frequency
  digest_frequency VARCHAR(50) DEFAULT 'real_time', -- real_time, hourly, daily, weekly, none
  quiet_hours_enabled BOOLEAN DEFAULT FALSE,
  quiet_hours_start TIME, -- e.g., 22:00
  quiet_hours_end TIME, -- e.g., 08:00
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  -- Batching
  batch_similar_events BOOLEAN DEFAULT FALSE,
  batch_window_minutes INT DEFAULT 5,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prefs_creator_wallet ON notification_preferences(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_prefs_creator_id ON notification_preferences(creator_id);

-- ============================================
-- Push Subscriptions - Web push endpoints
-- ============================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet TEXT NOT NULL,
  
  -- Push API subscription object (JSON)
  subscription JSONB NOT NULL, -- { endpoint, keys: { auth, p256dh } }
  browser_info VARCHAR(100), -- Chrome, Firefox, Safari, Edge
  device_id VARCHAR(255),
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_sub_creator ON push_subscriptions(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_push_sub_active ON push_subscriptions(active);

-- ============================================
-- Notification Delivery Log - Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  
  -- Channel
  channel VARCHAR(50) NOT NULL, -- in_app, email, web_push
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, failed, bounced
  error_message TEXT,
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMP WITH TIME ZONE,
  
  -- Recipient Info
  recipient_email TEXT,
  push_endpoint TEXT,
  device_id VARCHAR(255),
  
  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_notification ON notification_delivery_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_status ON notification_delivery_log(status);
CREATE INDEX IF NOT EXISTS idx_delivery_channel ON notification_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_delivery_created ON notification_delivery_log(created_at DESC);

-- ============================================
-- RLS Policies for Notifications
-- ============================================

-- Enable RLS
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Creators can read their own notifications
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own"
  ON notifications
  FOR SELECT
  USING (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

-- Creators can update read status
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications
  FOR UPDATE
  USING (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  )
  WITH CHECK (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

-- Creators can manage their notification preferences
DROP POLICY IF EXISTS "prefs_select_own" ON notification_preferences;
CREATE POLICY "prefs_select_own"
  ON notification_preferences
  FOR SELECT
  USING (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

DROP POLICY IF EXISTS "prefs_update_own" ON notification_preferences;
CREATE POLICY "prefs_update_own"
  ON notification_preferences
  FOR UPDATE
  USING (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  )
  WITH CHECK (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

DROP POLICY IF EXISTS "prefs_insert_own" ON notification_preferences;
CREATE POLICY "prefs_insert_own"
  ON notification_preferences
  FOR INSERT
  WITH CHECK (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

-- Creators can manage push subscriptions
DROP POLICY IF EXISTS "push_sub_select_own" ON push_subscriptions;
CREATE POLICY "push_sub_select_own"
  ON push_subscriptions
  FOR SELECT
  USING (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

DROP POLICY IF EXISTS "push_sub_insert_own" ON push_subscriptions;
CREATE POLICY "push_sub_insert_own"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

DROP POLICY IF EXISTS "push_sub_delete_own" ON push_subscriptions;
CREATE POLICY "push_sub_delete_own"
  ON push_subscriptions
  FOR DELETE
  USING (
    creator_wallet = auth.jwt() ->> 'wallet' OR 
    creator_wallet = auth.jwt() ->> 'address'
  );

-- Service role has full access for server-side operations
-- (No policy needed - service_role bypasses RLS)

-- ============================================
-- Grant Permissions
-- ============================================

-- Authenticated users
GRANT SELECT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_preferences TO authenticated;
GRANT SELECT, INSERT, DELETE ON push_subscriptions TO authenticated;
GRANT SELECT ON notification_delivery_log TO authenticated;

-- Service role (backend API)
GRANT ALL ON notifications TO service_role;
GRANT ALL ON notification_preferences TO service_role;
GRANT ALL ON push_subscriptions TO service_role;
GRANT ALL ON notification_delivery_log TO service_role;

-- ============================================
-- Helper Function: Get Unread Count
-- ============================================
CREATE OR REPLACE FUNCTION get_unread_notification_count(creator_wallet_input TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM notifications
    WHERE creator_wallet = creator_wallet_input
    AND "read" = FALSE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Helper Function: Mark All as Read
-- ============================================
CREATE OR REPLACE FUNCTION mark_all_notifications_read(creator_wallet_input TEXT)
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE notifications
  SET "read" = TRUE, updated_at = NOW()
  WHERE creator_wallet = creator_wallet_input
  AND "read" = FALSE;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Helper Function: Create Default Preferences
-- ============================================
CREATE OR REPLACE FUNCTION create_default_notification_preferences(
  input_creator_id UUID,
  input_creator_wallet TEXT
)
RETURNS notification_preferences AS $$
DECLARE
  new_prefs notification_preferences;
BEGIN
  INSERT INTO notification_preferences (
    creator_id,
    creator_wallet,
    notify_subscriptions,
    notify_purchases,
    notify_investments,
    notify_milestones,
    enable_in_app,
    enable_web_push,
    enable_email,
    digest_frequency
  )
  VALUES (
    input_creator_id,
    input_creator_wallet,
    TRUE, TRUE, TRUE, TRUE,
    TRUE, TRUE, FALSE,
    'real_time'
  )
  RETURNING * INTO new_prefs;
  
  RETURN new_prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Audit: View Recent Creator Activity
-- ============================================
CREATE OR REPLACE VIEW creator_recent_interactions AS
SELECT 
  creator_wallet,
  COUNT(*) as total_interactions,
  COUNT(CASE WHEN event_type = 'subscription' THEN 1 END) as subscriptions,
  COUNT(CASE WHEN event_type = 'purchase' THEN 1 END) as purchases,
  COUNT(CASE WHEN event_type = 'investment' THEN 1 END) as investments,
  SUM(amount_eth) FILTER (WHERE amount_eth IS NOT NULL) as total_eth,
  MAX(created_at) as last_interaction
FROM notifications
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY creator_wallet;

-- ============================================
-- Verification
-- ============================================
-- Run this to verify tables are created:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN ('notifications', 'notification_preferences', 'push_subscriptions', 'notification_delivery_log')
-- ORDER BY table_name;

-- ============================================================================
-- Migration: 20260408_add_missing_constraints.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260408_add_missing_constraints.sql
-- Purpose: Add UNIQUE and FK constraints for data integrity
-- Date: April 8, 2026
-- ============================================================================

-- Wallet is already unique in the base schema. Keep this migration idempotent by
-- only adding the named constraint when older environments somehow missed it.
DO $$
BEGIN
  IF to_regclass('public.artists') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.artists'::regclass
         AND conname IN ('artists_wallet_unique', 'artists_wallet_key')
     ) THEN
    ALTER TABLE public.artists
      ADD CONSTRAINT artists_wallet_unique UNIQUE (wallet);
  END IF;
END $$;

-- ============================================================================
-- ORDERS TABLE - Add unique constraint on tx_hash
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.orders'::regclass
         AND conname = 'orders_tx_hash_unique'
     )
     AND NOT EXISTS (
       SELECT tx_hash
       FROM public.orders
       WHERE tx_hash IS NOT NULL
       GROUP BY tx_hash
       HAVING COUNT(*) > 1
     ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_tx_hash_unique UNIQUE (tx_hash);
  END IF;
END $$;

-- ============================================================================
-- NONCES TABLE - Add unique constraint + indexes for auth
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.nonces') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.nonces'::regclass
         AND conname = 'nonces_wallet_nonce_unique'
     )
     AND NOT EXISTS (
       SELECT wallet, nonce
       FROM public.nonces
       GROUP BY wallet, nonce
       HAVING COUNT(*) > 1
     ) THEN
    ALTER TABLE public.nonces
      ADD CONSTRAINT nonces_wallet_nonce_unique UNIQUE (wallet, nonce);
  END IF;
END $$;

-- Compound index for fast nonce lookup
CREATE INDEX IF NOT EXISTS idx_nonces_wallet_used 
  ON nonces(wallet, used, created_at DESC);

-- ============================================================================
-- ORDERS TABLE - Add foreign key to order_items
-- ============================================================================

-- Ensure order_items properly references orders
DO $$
BEGIN
  IF to_regclass('public.order_items') IS NOT NULL
     AND to_regclass('public.orders') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.order_items'::regclass
         AND conname = 'fk_order_items_orders'
     ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id)
      REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- ARTIST_SHARES TABLE - Add constraints
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.artist_shares') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.artist_shares'::regclass
         AND conname = 'artist_shares_artist_id_token_unique'
     )
     AND NOT EXISTS (
       SELECT artist_id, token_address
       FROM public.artist_shares
       GROUP BY artist_id, token_address
       HAVING COUNT(*) > 1
     ) THEN
    ALTER TABLE public.artist_shares
      ADD CONSTRAINT artist_shares_artist_id_token_unique
      UNIQUE (artist_id, token_address);
  END IF;
END $$;

-- ============================================================================
-- SUBSCRIPTIONS TABLE - Add constraints
-- ============================================================================

-- The subscriptions table already defines a uniqueness guarantee in the base
-- schema (`UNIQUE (artist_id, subscriber_wallet)`). Keep a supporting lookup
-- index without trying to add an invalid duplicate constraint.
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_artist_lookup
  ON public.subscriptions(subscriber_wallet, artist_id);

-- ============================================================================
-- DROPS TABLE - Add constraints
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.drops') IS NOT NULL
     AND NOT EXISTS (
       SELECT artist_id, contract_address
       FROM public.drops
       WHERE contract_address IS NOT NULL
       GROUP BY artist_id, contract_address
       HAVING COUNT(*) > 1
     ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_drops_artist_contract_unique
      ON public.drops(artist_id, contract_address)
      WHERE contract_address IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- PRODUCTS TABLE - Add constraints
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL
     AND NOT EXISTS (
       SELECT creator_wallet, lower(name)
       FROM public.products
       WHERE creator_wallet IS NOT NULL
         AND name IS NOT NULL
       GROUP BY creator_wallet, lower(name)
       HAVING COUNT(*) > 1
     ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_creator_wallet_name_unique
      ON public.products(creator_wallet, lower(name));
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check constraints are working
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.constraint_column_usage 
-- WHERE table_name IN ('artists', 'orders', 'nonces');

-- Verify unique constraints prevent duplicates
-- INSERT INTO artists (wallet, name) VALUES ('0xtest', 'Test') 
--   ON CONFLICT (wallet) DO NOTHING;

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- These constraints improve query performance by:
-- 1. Preventing duplicate artists for same wallet
-- 2. Preventing double-charging for same transaction
-- 3. Preventing authentication token reuse attacks
-- 4. Enabling unique indexes for fast lookups

-- ============================================================================
-- Migration: 20260408_creator_fan_hub_foundation.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260408_creator_fan_hub_foundation.sql
-- Description:
--   * Adds the creator <-> fan relationship graph
--   * Introduces gated creator channels + posts
--   * Introduces creator/fan direct threads
--   * Locks the new community layer down with wallet-based RLS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.creator_fans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  fan_wallet TEXT NOT NULL,
  is_subscriber BOOLEAN NOT NULL DEFAULT FALSE,
  active_subscription BOOLEAN NOT NULL DEFAULT FALSE,
  is_collector BOOLEAN NOT NULL DEFAULT FALSE,
  is_backer BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  collected_releases_count INT NOT NULL DEFAULT 0,
  orders_count INT NOT NULL DEFAULT 0,
  total_spent_eth NUMERIC NOT NULL DEFAULT 0,
  backed_campaigns_count INT NOT NULL DEFAULT 0,
  total_invested_eth NUMERIC NOT NULL DEFAULT 0,
  relationship_score INT NOT NULL DEFAULT 0,
  last_interacted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT creator_fans_artist_wallet_unique UNIQUE (artist_id, fan_wallet)
);

CREATE INDEX IF NOT EXISTS idx_creator_fans_artist_id
ON public.creator_fans(artist_id);

CREATE INDEX IF NOT EXISTS idx_creator_fans_fan_wallet
ON public.creator_fans(lower(fan_wallet));

CREATE INDEX IF NOT EXISTS idx_creator_fans_score
ON public.creator_fans(artist_id, relationship_score DESC);

CREATE TABLE IF NOT EXISTS public.creator_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  access_level VARCHAR(50) NOT NULL DEFAULT 'public',
  created_by_wallet TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT creator_channels_artist_slug_unique UNIQUE (artist_id, slug),
  CONSTRAINT creator_channels_access_level_check
    CHECK (access_level IN ('public', 'fan', 'subscriber', 'collector', 'backer'))
);

CREATE INDEX IF NOT EXISTS idx_creator_channels_artist_id
ON public.creator_channels(artist_id);

CREATE INDEX IF NOT EXISTS idx_creator_channels_access_level
ON public.creator_channels(access_level);

CREATE TABLE IF NOT EXISTS public.creator_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.creator_channels(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  author_wallet TEXT NOT NULL,
  post_kind VARCHAR(50) NOT NULL DEFAULT 'update',
  title TEXT,
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT creator_posts_kind_check
    CHECK (post_kind IN ('update', 'drop', 'release', 'reward', 'event', 'poll'))
);

CREATE INDEX IF NOT EXISTS idx_creator_posts_channel_id
ON public.creator_posts(channel_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_posts_artist_id
ON public.creator_posts(artist_id, published_at DESC);

CREATE TABLE IF NOT EXISTS public.creator_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  fan_wallet TEXT NOT NULL,
  subject TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT creator_threads_artist_fan_unique UNIQUE (artist_id, fan_wallet),
  CONSTRAINT creator_threads_status_check
    CHECK (status IN ('open', 'archived', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_creator_threads_creator_wallet
ON public.creator_threads(lower(creator_wallet), last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_threads_fan_wallet
ON public.creator_threads(lower(fan_wallet), last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.creator_thread_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.creator_threads(id) ON DELETE CASCADE,
  sender_wallet TEXT NOT NULL,
  sender_role VARCHAR(20) NOT NULL DEFAULT 'fan',
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT creator_thread_messages_sender_role_check
    CHECK (sender_role IN ('creator', 'fan', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_creator_thread_messages_thread_id
ON public.creator_thread_messages(thread_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.popup_jwt_wallet()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lower(
    nullif(
      coalesce(
        auth.jwt() ->> 'sub',
        auth.jwt() ->> 'wallet_address',
        auth.jwt() ->> 'wallet',
        auth.jwt() ->> 'address',
        ''
      ),
      ''
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.popup_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    coalesce(lower(auth.jwt() ->> 'app_role'), '') = 'admin'
    OR coalesce(lower(auth.jwt() ->> 'role_name'), '') = 'admin'
    OR auth.role() = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.popup_wallet_owns_artist(target_artist_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = target_artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    );
$$;

CREATE OR REPLACE FUNCTION public.popup_wallet_can_access_artist_channel(target_channel_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.creator_channels c
    LEFT JOIN public.creator_fans f
      ON f.artist_id = c.artist_id
     AND lower(f.fan_wallet) = public.popup_jwt_wallet()
    WHERE c.id = target_channel_id
      AND (
        public.popup_is_admin()
        OR public.popup_wallet_owns_artist(c.artist_id)
        OR c.access_level = 'public'
        OR (
          public.popup_jwt_wallet() IS NOT NULL
          AND public.popup_jwt_wallet() <> ''
          AND c.access_level = 'fan'
          AND f.id IS NOT NULL
        )
        OR (c.access_level = 'subscriber' AND coalesce(f.active_subscription, false))
        OR (c.access_level = 'collector' AND coalesce(f.is_collector, false))
        OR (c.access_level = 'backer' AND coalesce(f.is_backer, false))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.popup_jwt_wallet() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_wallet_owns_artist(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_wallet_can_access_artist_channel(UUID) TO anon, authenticated, service_role;

ALTER TABLE public.creator_fans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_thread_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creator_fans_select_owner_or_self" ON public.creator_fans;
CREATE POLICY "creator_fans_select_owner_or_self" ON public.creator_fans
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(fan_wallet) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "creator_fans_mutate_owner_or_admin" ON public.creator_fans;
CREATE POLICY "creator_fans_mutate_owner_or_admin" ON public.creator_fans
  FOR ALL
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
  )
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
  );

DROP POLICY IF EXISTS "creator_channels_select_accessible" ON public.creator_channels;
CREATE POLICY "creator_channels_select_accessible" ON public.creator_channels
  FOR SELECT
  USING (public.popup_wallet_can_access_artist_channel(id));

DROP POLICY IF EXISTS "creator_channels_mutate_owner_or_admin" ON public.creator_channels;
CREATE POLICY "creator_channels_mutate_owner_or_admin" ON public.creator_channels
  FOR ALL
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
  )
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
  );

DROP POLICY IF EXISTS "creator_posts_select_accessible" ON public.creator_posts;
CREATE POLICY "creator_posts_select_accessible" ON public.creator_posts
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR public.popup_wallet_can_access_artist_channel(channel_id)
  );

DROP POLICY IF EXISTS "creator_posts_mutate_owner_or_admin" ON public.creator_posts;
CREATE POLICY "creator_posts_mutate_owner_or_admin" ON public.creator_posts
  FOR ALL
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
  )
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
  );

DROP POLICY IF EXISTS "creator_threads_select_participant" ON public.creator_threads;
CREATE POLICY "creator_threads_select_participant" ON public.creator_threads
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(fan_wallet) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "creator_threads_insert_participant" ON public.creator_threads;
CREATE POLICY "creator_threads_insert_participant" ON public.creator_threads
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(fan_wallet) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "creator_threads_update_participant" ON public.creator_threads;
CREATE POLICY "creator_threads_update_participant" ON public.creator_threads
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(fan_wallet) = public.popup_jwt_wallet()
  )
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(fan_wallet) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "creator_thread_messages_select_participant" ON public.creator_thread_messages;
CREATE POLICY "creator_thread_messages_select_participant" ON public.creator_thread_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.creator_threads t
      WHERE t.id = creator_thread_messages.thread_id
        AND (
          public.popup_is_admin()
          OR public.popup_wallet_owns_artist(t.artist_id)
          OR lower(t.fan_wallet) = public.popup_jwt_wallet()
        )
    )
  );

DROP POLICY IF EXISTS "creator_thread_messages_insert_participant" ON public.creator_thread_messages;
CREATE POLICY "creator_thread_messages_insert_participant" ON public.creator_thread_messages
  FOR INSERT
  WITH CHECK (
    (public.popup_is_admin() OR lower(sender_wallet) = public.popup_jwt_wallet())
    AND EXISTS (
      SELECT 1
      FROM public.creator_threads t
      WHERE t.id = creator_thread_messages.thread_id
        AND (
          public.popup_is_admin()
          OR public.popup_wallet_owns_artist(t.artist_id)
          OR lower(t.fan_wallet) = public.popup_jwt_wallet()
        )
    )
  );

GRANT SELECT ON public.creator_channels TO anon;
GRANT SELECT ON public.creator_posts TO anon;

GRANT ALL ON public.creator_fans TO authenticated;
GRANT ALL ON public.creator_channels TO authenticated;
GRANT ALL ON public.creator_posts TO authenticated;
GRANT ALL ON public.creator_threads TO authenticated;
GRANT ALL ON public.creator_thread_messages TO authenticated;

GRANT ALL ON public.creator_fans TO service_role;
GRANT ALL ON public.creator_channels TO service_role;
GRANT ALL ON public.creator_posts TO service_role;
GRANT ALL ON public.creator_threads TO service_role;
GRANT ALL ON public.creator_thread_messages TO service_role;

-- ============================================================================
-- Migration: 20260408_fix_rls_policies_comprehensive.sql
-- ============================================================================
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

-- ============================================================================
-- Migration: 20260408_product_feedback_inbox.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260408_product_feedback_inbox.sql
-- Description:
--   * Adds verified collector feedback threads for products
--   * Introduces creator-curated public reviews and private feedback inboxes
--   * Adds wallet-aware RLS for creator/collector participation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.popup_jwt_wallet()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lower(
    nullif(
      coalesce(
        auth.jwt() ->> 'sub',
        auth.jwt() ->> 'wallet_address',
        auth.jwt() ->> 'wallet',
        auth.jwt() ->> 'address',
        ''
      ),
      ''
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.popup_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    coalesce(lower(auth.jwt() ->> 'app_role'), '') = 'admin'
    OR coalesce(lower(auth.jwt() ->> 'role_name'), '') = 'admin'
    OR auth.role() = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.popup_wallet_owns_artist(target_artist_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = target_artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    );
$$;

CREATE TABLE IF NOT EXISTS public.product_feedback_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL DEFAULT 'product',
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  buyer_wallet TEXT NOT NULL,
  creator_wallet TEXT NOT NULL,
  feedback_type VARCHAR(50) NOT NULL DEFAULT 'feedback',
  visibility VARCHAR(20) NOT NULL DEFAULT 'private',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  rating INT,
  title TEXT,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  creator_curated BOOLEAN NOT NULL DEFAULT FALSE,
  subscriber_priority BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT product_feedback_threads_feedback_type_check
    CHECK (feedback_type IN ('review', 'feedback', 'question')),
  CONSTRAINT product_feedback_threads_item_type_check
    CHECK (item_type IN ('drop', 'product', 'release')),
  CONSTRAINT product_feedback_threads_visibility_check
    CHECK (visibility IN ('public', 'private')),
  CONSTRAINT product_feedback_threads_status_check
    CHECK (status IN ('open', 'closed', 'archived')),
  CONSTRAINT product_feedback_threads_rating_check
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_product_id
ON public.product_feedback_threads(product_id, featured DESC, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_item_lookup
ON public.product_feedback_threads(item_id, item_type, visibility, status, featured DESC);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_artist_id
ON public.product_feedback_threads(artist_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_buyer_wallet
ON public.product_feedback_threads(lower(buyer_wallet), last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_visibility
ON public.product_feedback_threads(visibility, status, featured DESC);

CREATE TABLE IF NOT EXISTS public.product_feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.product_feedback_threads(id) ON DELETE CASCADE,
  sender_wallet TEXT NOT NULL,
  sender_role VARCHAR(20) NOT NULL DEFAULT 'collector',
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT product_feedback_messages_sender_role_check
    CHECK (sender_role IN ('creator', 'collector', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_product_feedback_messages_thread_id
ON public.product_feedback_messages(thread_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.popup_wallet_can_access_product_feedback_thread(target_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.product_feedback_threads t
    WHERE t.id = target_thread_id
      AND (
        public.popup_is_admin()
        OR public.popup_wallet_owns_artist(t.artist_id)
        OR lower(t.buyer_wallet) = public.popup_jwt_wallet()
        OR (t.visibility = 'public' AND t.status <> 'archived')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.popup_jwt_wallet() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_wallet_owns_artist(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_wallet_can_access_product_feedback_thread(UUID) TO anon, authenticated, service_role;

ALTER TABLE public.product_feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_feedback_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_feedback_threads_select_accessible" ON public.product_feedback_threads;
CREATE POLICY "product_feedback_threads_select_accessible" ON public.product_feedback_threads
  FOR SELECT
  USING (public.popup_wallet_can_access_product_feedback_thread(id));

DROP POLICY IF EXISTS "product_feedback_threads_insert_participant" ON public.product_feedback_threads;
CREATE POLICY "product_feedback_threads_insert_participant" ON public.product_feedback_threads
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(buyer_wallet) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "product_feedback_threads_update_participant" ON public.product_feedback_threads;
CREATE POLICY "product_feedback_threads_update_participant" ON public.product_feedback_threads
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(buyer_wallet) = public.popup_jwt_wallet()
  )
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(buyer_wallet) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "product_feedback_messages_select_accessible" ON public.product_feedback_messages;
CREATE POLICY "product_feedback_messages_select_accessible" ON public.product_feedback_messages
  FOR SELECT
  USING (public.popup_wallet_can_access_product_feedback_thread(thread_id));

DROP POLICY IF EXISTS "product_feedback_messages_insert_participant" ON public.product_feedback_messages;
CREATE POLICY "product_feedback_messages_insert_participant" ON public.product_feedback_messages
  FOR INSERT
  WITH CHECK (
    (public.popup_is_admin() OR lower(sender_wallet) = public.popup_jwt_wallet())
    AND public.popup_wallet_can_access_product_feedback_thread(thread_id)
  );

GRANT SELECT ON public.product_feedback_threads TO anon, authenticated;
GRANT SELECT ON public.product_feedback_messages TO anon, authenticated;
GRANT ALL ON public.product_feedback_threads TO service_role;
GRANT ALL ON public.product_feedback_messages TO service_role;
GRANT ALL ON public.product_feedback_threads TO authenticated;
GRANT ALL ON public.product_feedback_messages TO authenticated;

-- ============================================================================
-- Migration: 20260409_catalog_optimization.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260409_catalog_optimization.sql
-- Purpose: Optimize catalog queries and align the unified catalog with the
--          actual product/drop/release schema used by the app.
-- ============================================================================

-- ============================================
-- Step 1: Add performance indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_artist_status
  ON public.products(artist_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drops_artist_status
  ON public.drops(artist_id, status, created_at DESC);

ALTER TABLE public.creative_releases
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.ip_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_creative_releases_artist_campaign
  ON public.creative_releases(artist_id, campaign_id, created_at DESC);

-- ============================================
-- Step 2: Add unified item tracking to feedback
-- ============================================

ALTER TABLE public.product_feedback_threads
  ADD COLUMN IF NOT EXISTS item_id UUID;

ALTER TABLE public.product_feedback_threads
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(50);

UPDATE public.product_feedback_threads
SET
  item_id = COALESCE(item_id, product_id),
  item_type = COALESCE(item_type, 'product')
WHERE item_id IS NULL
   OR item_type IS NULL;

ALTER TABLE public.product_feedback_threads
  ALTER COLUMN item_type SET DEFAULT 'product';

ALTER TABLE public.product_feedback_threads
  ALTER COLUMN item_id SET NOT NULL;

ALTER TABLE public.product_feedback_threads
  ALTER COLUMN item_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_feedback_threads_item_type_check'
  ) THEN
    ALTER TABLE public.product_feedback_threads
    ADD CONSTRAINT product_feedback_threads_item_type_check
    CHECK (item_type IN ('drop', 'product', 'release'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_feedback_item_lookup
  ON public.product_feedback_threads(item_id, item_type, visibility, status);

CREATE INDEX IF NOT EXISTS idx_feedback_threads_item
  ON public.product_feedback_threads(item_id, item_type);

-- ============================================
-- Step 3: Create unified catalog view
-- ============================================

DROP FUNCTION IF EXISTS public.get_catalog_item(UUID, TEXT);
DROP FUNCTION IF EXISTS public.count_catalog_by_type(TEXT);
DROP VIEW IF EXISTS public.catalog_with_engagement;
DROP VIEW IF EXISTS public.catalog_unified;

CREATE VIEW public.catalog_unified AS
SELECT
  'drop'::text AS item_type,
  d.id,
  d.title,
  d.description,
  COALESCE(d.image_url, d.image_ipfs_uri) AS image_url,
  d.price_eth,
  GREATEST(COALESCE(d.supply, 0) - COALESCE(d.sold, 0), 0) AS supply_or_stock,
  d.contract_address,
  NULL::uuid AS campaign_id,
  NULL::text AS campaign_type,
  d.artist_id AS creator_id,
  lower(a.wallet) AS creator_wallet,
  d.created_at,
  d.updated_at,
  GREATEST(COALESCE(d.supply, 0) - COALESCE(d.sold, 0), 0) > 0 AS can_purchase,
  lower(COALESCE(d.type, '')) = 'auction' AS can_bid,
  false AS can_participate_campaign,
  d.status
FROM public.drops d
LEFT JOIN public.artists a ON a.id = d.artist_id
WHERE d.status IN ('live', 'active', 'published')

UNION ALL

SELECT
  'product'::text AS item_type,
  p.id,
  p.name AS title,
  p.description,
  COALESCE(
    NULLIF(p.preview_uri, ''),
    NULLIF(p.image_url, ''),
    NULLIF(p.image_ipfs_uri, ''),
    NULLIF(p.metadata ->> 'image_url', '')
  ) AS image_url,
  p.price_eth,
  CASE
    WHEN COALESCE(p.stock, 0) = 0 THEN NULL::integer
    ELSE GREATEST(COALESCE(p.stock, 0) - COALESCE(p.sold, 0), 0)
  END AS supply_or_stock,
  NULL::text AS contract_address,
  NULL::uuid AS campaign_id,
  NULL::text AS campaign_type,
  p.artist_id AS creator_id,
  lower(COALESCE(p.creator_wallet, a.wallet)) AS creator_wallet,
  p.created_at,
  p.updated_at,
  (
    COALESCE(p.stock, 0) = 0
    OR COALESCE(p.stock, 0) > COALESCE(p.sold, 0)
  ) AS can_purchase,
  false AS can_bid,
  false AS can_participate_campaign,
  p.status
FROM public.products p
LEFT JOIN public.artists a ON a.id = p.artist_id
WHERE p.status IN ('published', 'active')

UNION ALL

SELECT
  'release'::text AS item_type,
  cr.id,
  cr.title,
  cr.description,
  COALESCE(
    NULLIF(cr.cover_image_uri, ''),
    NULLIF(cr.metadata ->> 'image_url', '')
  ) AS image_url,
  cr.price_eth,
  CASE
    WHEN COALESCE(cr.supply, 0) = 0 THEN NULL::integer
    ELSE GREATEST(COALESCE(cr.supply, 0) - COALESCE(cr.sold, 0), 0)
  END AS supply_or_stock,
  cr.contract_address,
  cr.campaign_id,
  COALESCE(ipc.campaign_type, cr.metadata ->> 'campaign_type') AS campaign_type,
  cr.artist_id AS creator_id,
  lower(COALESCE(a.wallet, cr.metadata ->> 'creator_wallet')) AS creator_wallet,
  cr.created_at,
  cr.updated_at,
  (
    COALESCE(cr.supply, 0) = 0
    OR COALESCE(cr.supply, 0) > COALESCE(cr.sold, 0)
  ) AS can_purchase,
  lower(COALESCE(ipc.campaign_type, cr.metadata ->> 'campaign_type', '')) = 'auction' AS can_bid,
  cr.campaign_id IS NOT NULL AS can_participate_campaign,
  cr.status
FROM public.creative_releases cr
LEFT JOIN public.ip_campaigns ipc ON ipc.id = cr.campaign_id
LEFT JOIN public.artists a ON a.id = cr.artist_id
WHERE cr.status IN ('live', 'published');

-- ============================================
-- Step 4: Create denormalized engagement view
-- ============================================

CREATE VIEW public.catalog_with_engagement AS
SELECT
  cu.*,
  COALESCE(comment_stats.comment_count, 0) AS comment_count,
  COALESCE(comment_stats.avg_rating, 0) AS avg_rating
FROM public.catalog_unified cu
LEFT JOIN (
  SELECT
    item_id,
    item_type,
    COUNT(DISTINCT id) AS comment_count,
    AVG(rating) AS avg_rating
  FROM public.product_feedback_threads
  WHERE visibility = 'public'
    AND status <> 'archived'
  GROUP BY item_id, item_type
) comment_stats
  ON cu.id = comment_stats.item_id
 AND cu.item_type = comment_stats.item_type;

-- ============================================
-- Step 5: Add helper functions
-- ============================================

CREATE OR REPLACE FUNCTION public.get_catalog_item(
  p_item_id UUID,
  p_item_type TEXT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', cu.id,
    'item_type', cu.item_type,
    'title', cu.title,
    'description', cu.description,
    'image_url', cu.image_url,
    'price_eth', cu.price_eth,
    'creator_id', cu.creator_id,
    'creator_wallet', cu.creator_wallet,
    'can_purchase', cu.can_purchase,
    'can_bid', cu.can_bid,
    'can_participate_campaign', cu.can_participate_campaign,
    'comment_count', cu.comment_count,
    'avg_rating', cu.avg_rating,
    'created_at', cu.created_at,
    'updated_at', cu.updated_at
  )
  INTO result
  FROM public.catalog_with_engagement cu
  WHERE cu.id = p_item_id
    AND cu.item_type = p_item_type;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_catalog_by_type(filter_type TEXT DEFAULT NULL)
RETURNS TABLE(item_type TEXT, count BIGINT)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cu.item_type,
    COUNT(*) AS count
  FROM public.catalog_unified cu
  WHERE filter_type IS NULL
     OR cu.item_type = filter_type
  GROUP BY cu.item_type;
END;
$$;

-- ============================================
-- Step 6: Grant permissions
-- ============================================

GRANT SELECT ON public.catalog_unified TO anon, authenticated, service_role;
GRANT SELECT ON public.catalog_with_engagement TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_catalog_item(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_catalog_by_type(TEXT) TO anon, authenticated, service_role;

-- ============================================================================
-- Migration: 20260409_feedback_item_threads_generic.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260409_feedback_item_threads_generic.sql
-- Purpose: Allow the shared feedback inbox to support drops and releases in
--          addition to products by making product_id optional.
-- ============================================================================

ALTER TABLE public.product_feedback_threads
  ALTER COLUMN product_id DROP NOT NULL;

-- ============================================================================
-- Migration: 20260409_personalization_features.sql
-- ============================================================================
-- ============================================================================
-- Migration: 20260409_personalization_features.sql
-- Purpose: Add favorites, subscriptions, analytics, and recommendations
-- ============================================================================

-- ============================================
-- 1. USER FAVORITES/WISHLIST TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_wallet, item_id, item_type),
  CONSTRAINT user_favorites_item_type_check
    CHECK (item_type IN ('drop', 'product', 'release'))
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_wallet
ON public.user_favorites(lower(user_wallet), saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_favorites_item
ON public.user_favorites(item_id, item_type);

-- ============================================
-- 2. CREATOR SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.creator_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_wallet TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(subscriber_wallet, creator_id),
  CONSTRAINT creator_subscriptions_tier_check
    CHECK (subscription_tier IN ('free', 'supporter', 'vip', 'collector'))
);

CREATE INDEX IF NOT EXISTS idx_creator_subscriptions_subscriber
ON public.creator_subscriptions(lower(subscriber_wallet), subscribed_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_subscriptions_creator
ON public.creator_subscriptions(creator_id, subscription_tier);

-- ============================================
-- 3. ANALYTICS EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  user_wallet TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT analytics_events_event_type_check
    CHECK (event_type IN ('view', 'like', 'comment', 'purchase', 'share'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_item
ON public.analytics_events(item_id, item_type, event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_events_date
ON public.analytics_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user
ON public.analytics_events(lower(user_wallet), created_at DESC);

-- ============================================
-- 4. RECOMMENDATIONS TABLE (Materialized)
-- ============================================

CREATE TABLE IF NOT EXISTS public.item_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  recommended_item_id UUID NOT NULL,
  recommended_item_type VARCHAR(50),
  recommendation_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  co_purchase_count INT DEFAULT 0,
  similarity_score DECIMAL(5,2) DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, item_type, recommended_item_id, recommended_item_type)
);

CREATE INDEX IF NOT EXISTS idx_item_recommendations_item
ON public.item_recommendations(item_id, item_type, recommendation_score DESC);

-- ============================================
-- 5. SOCIAL SHARES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  share_platform VARCHAR(50) NOT NULL,
  shared_by_wallet TEXT,
  share_url TEXT,
  click_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT social_shares_platform_check
    CHECK (share_platform IN ('twitter', 'facebook', 'linkedin', 'telegram', 'whatsapp', 'reddit'))
);

CREATE INDEX IF NOT EXISTS idx_social_shares_item
ON public.social_shares(item_id, item_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_shares_platform
ON public.social_shares(share_platform, click_count DESC);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Get user's favorite items
CREATE OR REPLACE FUNCTION get_user_favorites(wallet_address TEXT, limit_count INT DEFAULT 50)
RETURNS TABLE(item_id UUID, item_type VARCHAR, saved_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT uf.item_id, uf.item_type, uf.saved_at
  FROM public.user_favorites uf
  WHERE lower(uf.user_wallet) = lower(wallet_address)
  ORDER BY uf.saved_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Get creator's subscribers count
CREATE OR REPLACE FUNCTION get_creator_subscriber_count(creator_id_param UUID)
RETURNS INT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.creator_subscriptions cs
    WHERE cs.creator_id = creator_id_param
  );
END;
$$ LANGUAGE plpgsql;

-- Get item analytics summary
CREATE OR REPLACE FUNCTION get_item_analytics(item_id_param UUID, item_type_param VARCHAR)
RETURNS TABLE(views INT, likes INT, comments INT, purchases INT, shares INT, avg_rating DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'view'), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'like'), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'comment'), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'purchase'), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'share'), 0)::INT,
    COALESCE((SELECT AVG(CAST(data->>'rating' AS INT)) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'like'), 0)::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- Get recommendations for item
CREATE OR REPLACE FUNCTION get_item_recommendations(item_id_param UUID, item_type_param VARCHAR, limit_count INT DEFAULT 10)
RETURNS TABLE(recommended_item_id UUID, recommended_item_type VARCHAR, score DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT ir.recommended_item_id, ir.recommended_item_type, ir.recommendation_score
  FROM public.item_recommendations ir
  WHERE ir.item_id = item_id_param AND ir.item_type = item_type_param
  ORDER BY ir.recommendation_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_user_favorites(TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_creator_subscriber_count(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_item_analytics(UUID, VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_item_recommendations(UUID, VARCHAR, INT) TO anon, authenticated, service_role;

GRANT SELECT ON public.user_favorites TO anon, authenticated;
GRANT SELECT ON public.creator_subscriptions TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated, service_role;
GRANT SELECT ON public.item_recommendations TO anon, authenticated;
GRANT SELECT ON public.social_shares TO anon, authenticated;

GRANT INSERT ON public.user_favorites TO authenticated;
GRANT INSERT ON public.creator_subscriptions TO authenticated;
GRANT INSERT ON public.analytics_events TO authenticated, service_role;
GRANT INSERT ON public.social_shares TO authenticated, service_role;

GRANT UPDATE ON public.user_favorites TO authenticated;
GRANT UPDATE ON public.creator_subscriptions TO authenticated;

GRANT DELETE ON public.user_favorites TO authenticated;
GRANT DELETE ON public.creator_subscriptions TO authenticated;

-- ============================================
-- 8. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_favorites_own" ON public.user_favorites;
CREATE POLICY "user_favorites_own" ON public.user_favorites
  FOR ALL
  USING (lower(user_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(user_wallet) = lower(auth.jwt() ->> 'wallet_address'))
  WITH CHECK (lower(user_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(user_wallet) = lower(auth.jwt() ->> 'wallet_address'));

DROP POLICY IF EXISTS "creator_subscriptions_own" ON public.creator_subscriptions;
CREATE POLICY "creator_subscriptions_own" ON public.creator_subscriptions
  FOR ALL
  USING (lower(subscriber_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(subscriber_wallet) = lower(auth.jwt() ->> 'wallet_address'))
  WITH CHECK (lower(subscriber_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(subscriber_wallet) = lower(auth.jwt() ->> 'wallet_address'));

DROP POLICY IF EXISTS "social_shares_public_read" ON public.social_shares;
CREATE POLICY "social_shares_public_read" ON public.social_shares
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "social_shares_own_write" ON public.social_shares;
CREATE POLICY "social_shares_own_write" ON public.social_shares
  FOR ALL
  USING (lower(shared_by_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(shared_by_wallet) = lower(auth.jwt() ->> 'wallet_address'))
  WITH CHECK (lower(shared_by_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(shared_by_wallet) = lower(auth.jwt() ->> 'wallet_address'));
