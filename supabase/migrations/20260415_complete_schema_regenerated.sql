-- POPUP Platform - Complete Database Schema & RLS Policies
-- Migration: 20260415_complete_schema_regenerated.sql
-- Date: April 15, 2026
-- 
-- This migration creates the complete POPUP database schema with:
-- - All core tables (users, artists, drops, products, orders, campaigns, etc.)
-- - Row-Level Security (RLS) policies for data protection
-- - Proper indexes for performance
-- - Foreign key relationships
-- - Audit logging tables

-- ═══════════════════════════════════════════════════════════════════════════
-- ENABLE EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════
-- AUTHENTICATION & USER MANAGEMENT
-- ═══════════════════════════════════════════════════════════════════════════

-- Nonces for challenge-based authentication
CREATE TABLE IF NOT EXISTS nonces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet VARCHAR(42) NOT NULL UNIQUE,
  nonce VARCHAR(64) NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_wallet CHECK (wallet ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX idx_nonces_wallet ON nonces(wallet);
CREATE INDEX idx_nonces_expires_at ON nonces(expires_at);

-- Whitelist for artist approvals
CREATE TABLE IF NOT EXISTS whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet VARCHAR(42) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason TEXT,
  approved_by VARCHAR(42),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT valid_wallet CHECK (wallet ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX idx_whitelist_wallet ON whitelist(wallet);
CREATE INDEX idx_whitelist_status ON whitelist(status);
CREATE INDEX idx_whitelist_created_at ON whitelist(created_at);

-- Artist Profiles
CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet VARCHAR(42) NOT NULL UNIQUE,
  name VARCHAR(200),
  handle VARCHAR(50) UNIQUE,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  website_url TEXT,
  portfolio JSONB DEFAULT '[]'::JSONB,
  contract_address VARCHAR(42),
  contract_deployment_tx VARCHAR(66),
  subscription_price NUMERIC(20, 8),
  poap_allocation INTEGER,
  role VARCHAR(20) DEFAULT 'artist',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_wallet CHECK (wallet ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_role CHECK (role IN ('artist', 'collector', 'admin')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_artists_wallet ON artists(wallet);
CREATE INDEX idx_artists_handle ON artists(handle);
CREATE INDEX idx_artists_status ON artists(status);

-- Artist Applications
CREATE TABLE IF NOT EXISTS artist_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address VARCHAR(42) NOT NULL,
  artist_name VARCHAR(200),
  bio TEXT,
  art_types TEXT[] DEFAULT '{}',
  portfolio_url TEXT,
  twitter_url TEXT,
  instagram_url TEXT,
  website_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(42),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT valid_wallet CHECK (wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX idx_applications_wallet ON artist_applications(wallet_address);
CREATE INDEX idx_applications_status ON artist_applications(status);
CREATE INDEX idx_applications_submitted_at ON artist_applications(submitted_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- PRODUCTS & DROPS
-- ═══════════════════════════════════════════════════════════════════════════

-- Drops (Collections)
CREATE TABLE IF NOT EXISTS drops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES artists(id),
  creative_release_id UUID,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  price_eth NUMERIC(20, 8),
  supply INTEGER,
  sold INTEGER DEFAULT 0,
  revenue NUMERIC(20, 8) DEFAULT 0,
  image_url TEXT,
  image_ipfs_uri TEXT,
  metadata_ipfs_uri TEXT,
  asset_type VARCHAR(50),
  preview_uri TEXT,
  delivery_uri TEXT,
  is_gated BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'draft',
  type VARCHAR(50),
  metadata JSONB DEFAULT '{}'::JSONB,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'live', 'published', 'ended'))
);

CREATE INDEX idx_drops_artist_id ON drops(artist_id);
CREATE INDEX idx_drops_status ON drops(status);
CREATE INDEX idx_drops_created_at ON drops(created_at);
CREATE INDEX idx_drops_ends_at ON drops(ends_at);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES artists(id),
  creator_wallet VARCHAR(42) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  price NUMERIC(20, 8) NOT NULL,
  supply INTEGER,
  sold INTEGER DEFAULT 0,
  revenue NUMERIC(20, 8) DEFAULT 0,
  product_type VARCHAR(50),
  image_url TEXT,
  image_ipfs_uri TEXT,
  metadata_ipfs_uri TEXT,
  asset_type VARCHAR(50),
  preview_uri TEXT,
  delivery_uri TEXT,
  is_gated BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'draft',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_wallet CHECK (creator_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'published'))
);

CREATE INDEX idx_products_creator_wallet ON products(creator_wallet);
CREATE INDEX idx_products_artist_id ON products(artist_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- ORDERS & PURCHASES
-- ═══════════════════════════════════════════════════════════════════════════

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id),
  buyer_wallet VARCHAR(42) NOT NULL,
  quantity INTEGER DEFAULT 1,
  tx_hash VARCHAR(66),
  total_price NUMERIC(20, 8),
  status VARCHAR(50) DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  approval_status VARCHAR(50) DEFAULT 'pending',
  payout_status VARCHAR(50) DEFAULT 'pending',
  shipping_address_jsonb JSONB DEFAULT '{}'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_buyer CHECK (buyer_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered')),
  CONSTRAINT valid_approval CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT valid_payout CHECK (payout_status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX idx_orders_buyer_wallet ON orders(buyer_wallet);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_paid_at ON orders(paid_at);

-- Order Items (for bulk orders)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_purchase NUMERIC(20, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscriber_wallet VARCHAR(42) NOT NULL,
  artist_id UUID NOT NULL REFERENCES artists(id),
  status VARCHAR(50) DEFAULT 'active',
  tx_hash VARCHAR(66),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT valid_wallet CHECK (subscriber_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'cancelled'))
);

CREATE INDEX idx_subscriptions_subscriber_wallet ON subscriptions(subscriber_wallet);
CREATE INDEX idx_subscriptions_artist_id ON subscriptions(artist_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ═══════════════════════════════════════════════════════════════════════════
-- CAMPAIGNS & INVESTMENTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Campaigns
CREATE TABLE IF NOT EXISTS ip_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drop_id UUID REFERENCES drops(id),
  artist_id UUID NOT NULL REFERENCES artists(id),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  budget_eth NUMERIC(20, 8),
  raised_eth NUMERIC(20, 8) DEFAULT 0,
  target_audience TEXT,
  status VARCHAR(50) DEFAULT 'active',
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('active', 'ended', 'cancelled'))
);

CREATE INDEX idx_campaigns_artist_id ON ip_campaigns(artist_id);
CREATE INDEX idx_campaigns_status ON ip_campaigns(status);
CREATE INDEX idx_campaigns_created_at ON ip_campaigns(created_at);

-- Campaign Submissions
CREATE TABLE IF NOT EXISTS campaign_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES ip_campaigns(id),
  artist_wallet VARCHAR(42) NOT NULL,
  content_url TEXT,
  content_type VARCHAR(50),
  caption TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_wallet CHECK (artist_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_submissions_campaign_id ON campaign_submissions(campaign_id);
CREATE INDEX idx_submissions_artist_wallet ON campaign_submissions(artist_wallet);

-- IP Investments
CREATE TABLE IF NOT EXISTS ip_investments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES ip_campaigns(id),
  investor_wallet VARCHAR(42) NOT NULL,
  amount_eth NUMERIC(20, 8) NOT NULL,
  tx_hash VARCHAR(66),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_wallet CHECK (investor_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'cancelled'))
);

CREATE INDEX idx_investments_campaign_id ON ip_investments(campaign_id);
CREATE INDEX idx_investments_investor_wallet ON ip_investments(investor_wallet);
CREATE INDEX idx_investments_created_at ON ip_investments(created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS & ENTITLEMENTS
-- ═══════════════════════════════════════════════════════════════════════════

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_wallet VARCHAR(42) NOT NULL,
  sender_wallet VARCHAR(42),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'info',
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_wallet CHECK (recipient_wallet ~ '^0x[a-fA-F0-9]{40}$'),
  CONSTRAINT valid_type CHECK (type IN ('info', 'success', 'warning', 'error'))
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_wallet);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Entitlements (POAPs, badges, etc.)
CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_wallet VARCHAR(42) NOT NULL,
  order_id UUID REFERENCES orders(id),
  entitlement_type VARCHAR(50),
  contract_address VARCHAR(42),
  token_id VARCHAR(256),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_wallet CHECK (buyer_wallet ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX idx_entitlements_buyer_wallet ON entitlements(buyer_wallet);
CREATE INDEX idx_entitlements_type ON entitlements(entitlement_type);
CREATE INDEX idx_entitlements_created_at ON entitlements(created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- AUDIT & LOGGING
-- ═══════════════════════════════════════════════════════════════════════════

-- Admin Audit Log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_wallet VARCHAR(42) NOT NULL,
  action VARCHAR(200) NOT NULL,
  target_wallet VARCHAR(42),
  status VARCHAR(50),
  details JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_admin CHECK (admin_wallet ~ '^0x[a-fA-F0-9]{40}$')
);

CREATE INDEX idx_audit_admin_wallet ON admin_audit_log(admin_wallet);
CREATE INDEX idx_audit_action ON admin_audit_log(action);
CREATE INDEX idx_audit_created_at ON admin_audit_log(created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ip_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ═════════════════════════════════════════════════════════════════════════
-- ORDERS - Users can only view/modify their own orders
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (buyer_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "Users can insert their own orders"
  ON orders FOR INSERT
  WITH CHECK (buyer_wallet = auth.jwt() ->> 'wallet');

CREATE POLICY "Users can update their own orders"
  ON orders FOR UPDATE
  USING (buyer_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "Admins can delete orders"
  ON orders FOR DELETE
  USING (auth.jwt() ->> 'app_role' = 'admin');

-- ═════════════════════════════════════════════════════════════════════════
-- ORDER ITEMS - Accessible through orders
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view order items for their orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.buyer_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin')
    )
  );

-- ═════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS - Users can view their own subscriptions
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions FOR SELECT
  USING (subscriber_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "Users can create subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (subscriber_wallet = auth.jwt() ->> 'wallet');

-- ═════════════════════════════════════════════════════════════════════════
-- PRODUCTS - Public read, creator/admin write
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view published products"
  ON products FOR SELECT
  USING (status = 'published' OR creator_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "Artists can create products"
  ON products FOR INSERT
  WITH CHECK (creator_wallet = auth.jwt() ->> 'wallet');

CREATE POLICY "Creators can update their own products"
  ON products FOR UPDATE
  USING (creator_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin');

-- ═════════════════════════════════════════════════════════════════════════
-- DROPS - Public read, artist/admin write
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view published drops"
  ON drops FOR SELECT
  USING (status IN ('published', 'live') OR 
    EXISTS (SELECT 1 FROM artists WHERE artists.id = drops.artist_id AND artists.wallet = auth.jwt() ->> 'wallet') OR
    auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "Artists can insert drops"
  ON drops FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM artists WHERE artists.id = drops.artist_id AND artists.wallet = auth.jwt() ->> 'wallet') OR
    auth.jwt() ->> 'app_role' = 'admin'
  );

CREATE POLICY "Artists can update their own drops"
  ON drops FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM artists WHERE artists.id = drops.artist_id AND artists.wallet = auth.jwt() ->> 'wallet') OR
    auth.jwt() ->> 'app_role' = 'admin'
  );

-- ═════════════════════════════════════════════════════════════════════════
-- ARTISTS - Public read, admin/owner write
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view artists"
  ON artists FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert artists"
  ON artists FOR INSERT
  WITH CHECK (auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "Artists and admins can update profiles"
  ON artists FOR UPDATE
  USING (wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin');

-- ═════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS - Users view their own
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (recipient_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (recipient_wallet = auth.jwt() ->> 'wallet');

-- ═════════════════════════════════════════════════════════════════════════
-- ENTITLEMENTS - Users view their own
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Users can view their own entitlements"
  ON entitlements FOR SELECT
  USING (buyer_wallet = auth.jwt() ->> 'wallet' OR auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "System can create entitlements"
  ON entitlements FOR INSERT
  WITH CHECK (true);

-- ═════════════════════════════════════════════════════════════════════════
-- CAMPAIGNS - Public read for published, creator/admin write
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Anyone can view published campaigns"
  ON ip_campaigns FOR SELECT
  USING (status = 'active' OR 
    EXISTS (SELECT 1 FROM artists WHERE artists.id = ip_campaigns.artist_id AND artists.wallet = auth.jwt() ->> 'wallet') OR
    auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "Artists can create campaigns"
  ON ip_campaigns FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM artists WHERE artists.id = ip_campaigns.artist_id AND artists.wallet = auth.jwt() ->> 'wallet') OR
    auth.jwt() ->> 'app_role' = 'admin'
  );

-- ═════════════════════════════════════════════════════════════════════════
-- ADMIN AUDIT LOG - Admin only
-- ═════════════════════════════════════════════════════════════════════════

CREATE POLICY "Admins can view audit logs"
  ON admin_audit_log FOR SELECT
  USING (auth.jwt() ->> 'app_role' = 'admin');

CREATE POLICY "System can insert audit logs"
  ON admin_audit_log FOR INSERT
  WITH CHECK (true);

-- ═════════════════════════════════════════════════════════════════════════
-- PUBLIC TABLES (no RLS needed)
-- ═════════════════════════════════════════════════════════════════════════

-- Whitelist, nonces, artist_applications: keep accessible for auth flow
-- But restrict by app logic, not RLS

-- ═══════════════════════════════════════════════════════════════════════════
-- SCHEMA COMPLETE
-- ═══════════════════════════════════════════════════════════════════════════
-- 
-- Next steps:
-- 1. Deploy this migration to Supabase
-- 2. Verify all 15 tables created: SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- 3. Verify RLS enabled: SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- 4. Run integration tests to verify RLS policies work correctly
-- 5. Monitor for any migration issues in Supabase dashboard

COMMIT;