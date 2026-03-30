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
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE SET NULL,
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
DROP POLICY IF EXISTS "analytics_insert_all" ON analytics;
DROP POLICY IF EXISTS "analytics_read_all" ON analytics;

-- Artists: public read/write (app handles authorization)
CREATE POLICY "artists_read_all" ON artists FOR SELECT USING (true);
CREATE POLICY "artists_write_all" ON artists FOR INSERT WITH CHECK (true);
CREATE POLICY "artists_update_all" ON artists FOR UPDATE USING (true);

-- Drops: public read/write (app handles authorization)
CREATE POLICY "drops_read_all" ON drops FOR SELECT USING (true);
CREATE POLICY "drops_write_all" ON drops FOR INSERT WITH CHECK (true);
CREATE POLICY "drops_update_all" ON drops FOR UPDATE USING (true);

-- Products: public read/write (app handles authorization)
CREATE POLICY "products_read_all" ON products FOR SELECT USING (true);
CREATE POLICY "products_write_all" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update_all" ON products FOR UPDATE USING (true);

-- Orders: public read/write (app handles authorization)
CREATE POLICY "orders_read_all" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_write_all" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update_all" ON orders FOR UPDATE USING (true);

-- Whitelist: admin-only write access, public read
CREATE POLICY "whitelist_read_all" ON whitelist FOR SELECT USING (true);
CREATE POLICY "whitelist_write_admin_only" ON whitelist FOR INSERT WITH CHECK (
  (auth.jwt() ->> 'wallet_address')::text = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092'
);
CREATE POLICY "whitelist_update_admin_only" ON whitelist FOR UPDATE USING (
  (auth.jwt() ->> 'wallet_address')::text = '0x4B393730eFc0E3C1E0C0944fbC05EdEF4eE58092'
);

-- Analytics: public insert (app tracks user behavior)
CREATE POLICY "analytics_insert_all" ON analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_read_all" ON analytics FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- After running this, copy your Supabase credentials to .env.local:
-- VITE_SUPABASE_URL=https://your-project.supabase.co
-- VITE_SUPABASE_ANON_KEY=your_anon_key_here
-- ═══════════════════════════════════════════════════════════════════════════════
