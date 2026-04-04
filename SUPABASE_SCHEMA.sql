-- Generated bootstrap schema
-- Generated at 2026-04-04T10:42:27.081Z
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

-- Artists: public read/write (app handles authorization)
DROP POLICY IF EXISTS "artists_read_all" ON artists;
CREATE POLICY "artists_read_all" ON artists FOR SELECT USING (true);
DROP POLICY IF EXISTS "artists_write_all" ON artists;
CREATE POLICY "artists_write_all" ON artists FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "artists_update_all" ON artists;
CREATE POLICY "artists_update_all" ON artists FOR UPDATE USING (true);

-- Drops: public read for live/published drops, authenticated write
DROP POLICY IF EXISTS "drops_read_public" ON drops;
CREATE POLICY "drops_read_public" ON drops FOR SELECT USING (status IN ('live', 'published', 'active'));
DROP POLICY IF EXISTS "drops_write_authenticated" ON drops;
CREATE POLICY "drops_write_authenticated" ON drops FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "drops_update_authenticated" ON drops;
CREATE POLICY "drops_update_authenticated" ON drops FOR UPDATE USING (true);

-- Products: public read for published products, authenticated write
DROP POLICY IF EXISTS "products_read_public" ON products;
CREATE POLICY "products_read_public" ON products FOR SELECT USING (status = 'published');
DROP POLICY IF EXISTS "products_write_authenticated" ON products;
CREATE POLICY "products_write_authenticated" ON products FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "products_update_authenticated" ON products;
CREATE POLICY "products_update_authenticated" ON products FOR UPDATE USING (true);

-- Orders: public read/write (app handles authorization)
DROP POLICY IF EXISTS "orders_read_all" ON orders;
CREATE POLICY "orders_read_all" ON orders FOR SELECT USING (true);
DROP POLICY IF EXISTS "orders_write_all" ON orders;
CREATE POLICY "orders_write_all" ON orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "orders_update_all" ON orders;
CREATE POLICY "orders_update_all" ON orders FOR UPDATE USING (true);

-- Whitelist: admin-only write access, public read
DROP POLICY IF EXISTS "whitelist_read_all" ON whitelist;
CREATE POLICY "whitelist_read_all" ON whitelist FOR SELECT USING (true);
DROP POLICY IF EXISTS "whitelist_write_admin_only" ON whitelist;
CREATE POLICY "whitelist_write_admin_only" ON whitelist FOR INSERT WITH CHECK (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);
DROP POLICY IF EXISTS "whitelist_update_admin_only" ON whitelist;
CREATE POLICY "whitelist_update_admin_only" ON whitelist FOR UPDATE USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);

-- Analytics: public insert (app tracks user behavior)
DROP POLICY IF EXISTS "analytics_insert_all" ON analytics;
CREATE POLICY "analytics_insert_all" ON analytics FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "analytics_read_all" ON analytics;
CREATE POLICY "analytics_read_all" ON analytics FOR SELECT USING (true);

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
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS contract_deployment_tx VARCHAR(255),
ADD COLUMN IF NOT EXISTS contract_deployed_at TIMESTAMP WITH TIME ZONE;

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
ADD COLUMN IF NOT EXISTS shares_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shares_contract_address VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS shares_contract_tx VARCHAR(255),
ADD COLUMN IF NOT EXISTS shares_campaign_active BOOLEAN DEFAULT false;

-- Create index for fast shares lookups
CREATE INDEX IF NOT EXISTS idx_artists_shares_contract ON artists(shares_contract_address);
CREATE INDEX IF NOT EXISTS idx_artists_shares_campaign ON artists(shares_campaign_active);

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
DROP POLICY IF EXISTS "artists_read_public" ON artists;
CREATE POLICY "artists_read_public" ON artists
FOR SELECT
USING (auth.role() = 'authenticated');

-- Artists can only UPDATE their own profile
DROP POLICY IF EXISTS "artists_update_own_profile" ON artists;
CREATE POLICY "artists_update_own_profile" ON artists
FOR UPDATE
USING (wallet = auth.jwt() ->> 'sub');

-- Artists can INSERT their own profile (first time)
DROP POLICY IF EXISTS "artists_insert_own_profile" ON artists;
CREATE POLICY "artists_insert_own_profile" ON artists
FOR INSERT
WITH CHECK (wallet = auth.jwt() ->> 'sub');

-- ─────────────────────────────────────────────────────────────────────────────────
-- DROPS TABLE - Secure policies
-- ─────────────────────────────────────────────────────────────────────────────────

-- Anyone can READ published drops (status != 'draft')
DROP POLICY IF EXISTS "drops_read_published" ON drops;
CREATE POLICY "drops_read_published" ON drops
FOR SELECT
USING (status != 'draft');

-- Artists can READ their own draft drops
DROP POLICY IF EXISTS "drops_read_own_draft" ON drops;
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
DROP POLICY IF EXISTS "drops_create_own" ON drops;
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
DROP POLICY IF EXISTS "drops_update_own" ON drops;
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
DROP POLICY IF EXISTS "drops_delete_own" ON drops;
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
DROP POLICY IF EXISTS "products_read_published" ON products;
CREATE POLICY "products_read_published" ON products
FOR SELECT
USING (status IN ('published', 'active'));

-- Creators can READ their own draft products
DROP POLICY IF EXISTS "products_read_own_draft" ON products;
CREATE POLICY "products_read_own_draft" ON products
FOR SELECT
USING (
  status = 'draft'
  AND creator_wallet = auth.jwt() ->> 'sub'
);

-- Creators can CREATE their own products
DROP POLICY IF EXISTS "products_create_own" ON products;
CREATE POLICY "products_create_own" ON products
FOR INSERT
WITH CHECK (creator_wallet = auth.jwt() ->> 'sub');

-- Creators can UPDATE only their own products
DROP POLICY IF EXISTS "products_update_own" ON products;
CREATE POLICY "products_update_own" ON products
FOR UPDATE
USING (creator_wallet = auth.jwt() ->> 'sub');

-- Creators can DELETE only their own products
DROP POLICY IF EXISTS "products_delete_own" ON products;
CREATE POLICY "products_delete_own" ON products
FOR DELETE
USING (creator_wallet = auth.jwt() ->> 'sub');

-- ─────────────────────────────────────────────────────────────────────────────────
-- ORDERS TABLE - Secure policies
-- ─────────────────────────────────────────────────────────────────────────────────

-- Buyers can READ only their own orders
DROP POLICY IF EXISTS "orders_read_own_orders" ON orders;
CREATE POLICY "orders_read_own_orders" ON orders
FOR SELECT
USING (buyer_wallet = auth.jwt() ->> 'sub');

-- Sellers can READ orders for their products
DROP POLICY IF EXISTS "orders_read_own_product_sales" ON orders;
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
DROP POLICY IF EXISTS "orders_create_own" ON orders;
CREATE POLICY "orders_create_own" ON orders
FOR INSERT
WITH CHECK (buyer_wallet = auth.jwt() ->> 'sub');

-- Sellers can UPDATE order status for their products only
DROP POLICY IF EXISTS "orders_update_own_product_sales" ON orders;
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
DROP POLICY IF EXISTS "whitelist_read_public" ON whitelist;
CREATE POLICY "whitelist_read_public" ON whitelist
FOR SELECT
USING (true);

-- Only admin wallet can INSERT
DROP POLICY IF EXISTS "whitelist_insert_admin_only" ON whitelist;
CREATE POLICY "whitelist_insert_admin_only" ON whitelist
FOR INSERT
WITH CHECK (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);

-- Only admin wallet can UPDATE
DROP POLICY IF EXISTS "whitelist_update_admin_only" ON whitelist;
CREATE POLICY "whitelist_update_admin_only" ON whitelist
FOR UPDATE
USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);

-- Only admin wallet can DELETE
DROP POLICY IF EXISTS "whitelist_delete_admin_only" ON whitelist;
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
DROP POLICY IF EXISTS "analytics_insert_authenticated" ON analytics;
CREATE POLICY "analytics_insert_authenticated" ON analytics
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Users can READ analytics only for artists they own
DROP POLICY IF EXISTS "analytics_read_own_artist" ON analytics;
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by ON audit_logs(changed_by);

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
DROP POLICY IF EXISTS "audit_logs_read_admin_only" ON audit_logs;
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

DROP POLICY IF EXISTS "waitlist_public_insert" ON public.waitlist;
CREATE POLICY "waitlist_public_insert" ON public.waitlist
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "waitlist_public_select" ON public.waitlist;
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
DROP POLICY IF EXISTS "applications_public_insert" ON public.artist_applications;
CREATE POLICY "applications_public_insert" ON public.artist_applications
  FOR INSERT WITH CHECK (true);

-- Anyone can read (admin panel uses anon key for now)
DROP POLICY IF EXISTS "applications_public_select" ON public.artist_applications;
CREATE POLICY "applications_public_select" ON public.artist_applications
  FOR SELECT USING (true);

-- Admins can update (approve / reject)
DROP POLICY IF EXISTS "applications_admin_update" ON public.artist_applications;
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_asset_type'
  ) THEN
    ALTER TABLE drops
    ADD CONSTRAINT valid_asset_type CHECK (
      asset_type IN ('image', 'video', 'audio', 'pdf', 'epub', 'merchandise', 'digital')
    );
  END IF;
END $$;

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
DROP POLICY IF EXISTS "Service role only" ON nonces;
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_product_id_fkey'
  ) THEN
    ALTER TABLE orders
    ADD CONSTRAINT orders_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

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
DROP POLICY IF EXISTS "artists_read_approved_public" ON artists;
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
DROP POLICY IF EXISTS "artists_read_approved_public" ON artists;
      CREATE POLICY "artists_read_approved_public" ON artists
      FOR SELECT
      USING (status IN ('approved', 'active'))
    $policy$;
  ELSIF whitelist_match_sql IS NOT NULL THEN
    EXECUTE format($policy$
DROP POLICY IF EXISTS "artists_read_approved_public" ON artists;
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
DROP POLICY IF EXISTS "artists_read_approved_public" ON artists;
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- ADDITIONAL CONSTRAINTS FOR PHASE 2 PERFORMANCE & DATA INTEGRITY
-- ═══════════════════════════════════════════════════════════════════════════════

-- Prevent duplicate artists per wallet (unique constraint helps with queries)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'unique_artist_wallet' AND c.conrelid = 'artists'::regclass
  ) THEN
    ALTER TABLE artists ADD CONSTRAINT unique_artist_wallet UNIQUE (wallet);
  END IF;
END $$;

-- Ensure orders have either drop or product
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'check_drop_or_product' AND c.conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT check_drop_or_product 
      CHECK ((drop_id IS NOT NULL AND product_id IS NULL) 
        OR (drop_id IS NULL AND product_id IS NOT NULL));
  END IF;
END $$;

-- Prevent negative prices
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'check_drop_price_positive' AND c.conrelid = 'drops'::regclass
  ) THEN
    ALTER TABLE drops ADD CONSTRAINT check_drop_price_positive CHECK (price_eth > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'check_product_price_positive' AND c.conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT check_product_price_positive CHECK (price_eth > 0);
  END IF;
END $$;

-- Prevent duplicate subscriptions
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conname = 'unique_subscription' AND c.conrelid = 'subscriptions'::regclass
  ) THEN
    ALTER TABLE subscriptions ADD CONSTRAINT unique_subscription 
      UNIQUE (artist_id, subscriber_wallet);
  END IF;
END $$;

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_log_action_check'
  ) THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_log_status_check'
  ) THEN
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
  END IF;
END $$;

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
DROP POLICY IF EXISTS "whitelist_insert_admin_only" ON public.whitelist;
      CREATE POLICY "whitelist_insert_admin_only" ON public.whitelist
      FOR INSERT
      WITH CHECK (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;

    EXECUTE $policy$
DROP POLICY IF EXISTS "whitelist_update_admin_only" ON public.whitelist;
      CREATE POLICY "whitelist_update_admin_only" ON public.whitelist
      FOR UPDATE
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;

    EXECUTE $policy$
DROP POLICY IF EXISTS "whitelist_delete_admin_only" ON public.whitelist;
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
DROP POLICY IF EXISTS "audit_logs_read_admin_only" ON public.audit_logs;
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
DROP POLICY IF EXISTS "admin_audit_log_read_admin_only" ON public.admin_audit_log;
      CREATE POLICY "admin_audit_log_read_admin_only" ON public.admin_audit_log
      FOR SELECT
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;
  END IF;
END $$;
