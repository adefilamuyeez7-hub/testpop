-- Supabase Database Schema for THEPOPUP

CREATE TABLE IF NOT EXISTS artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  name VARCHAR(255),
  handle VARCHAR(100) UNIQUE,
  bio TEXT,
  tag VARCHAR(100),
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

CREATE INDEX idx_artists_wallet ON artists(wallet);
CREATE INDEX idx_artists_handle ON artists(handle);

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
  status VARCHAR(50) DEFAULT 'draft',
  type VARCHAR(50) DEFAULT 'drop',
  contract_address VARCHAR(255),
  contract_drop_id INT,
  contract_kind VARCHAR(50),
  revenue DECIMAL(18, 8) DEFAULT 0,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_drops_artist_id ON drops(artist_id);
CREATE INDEX idx_drops_status ON drops(status);
CREATE INDEX idx_drops_created_at ON drops(created_at DESC);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price_eth DECIMAL(10, 6) NOT NULL,
  stock INT DEFAULT 0,
  sold INT DEFAULT 0,
  image_url TEXT,
  image_ipfs_uri TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_products_creator ON products(creator_wallet);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  buyer_wallet TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  total_price_eth DECIMAL(18, 8) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  shipping_address TEXT,
  tracking_code VARCHAR(255),
  tx_hash VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_orders_buyer ON orders(buyer_wallet);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

CREATE TABLE IF NOT EXISTS whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  tag VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_whitelist_wallet ON whitelist(wallet);
CREATE INDEX idx_whitelist_status ON whitelist(status);
CREATE INDEX idx_whitelist_joined_at ON whitelist(joined_at DESC);

CREATE TABLE IF NOT EXISTS analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page VARCHAR(100),
  artist_id UUID REFERENCES artists(id) ON DELETE SET NULL,
  user_agent TEXT,
  referrer TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_analytics_artist ON analytics(artist_id);
CREATE INDEX idx_analytics_page ON analytics(page);
CREATE INDEX idx_analytics_timestamp ON analytics(timestamp DESC);

ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.request_wallet() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'wallet', ''))
$$;

CREATE OR REPLACE FUNCTION public.request_role() RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'role', ''))
$$;

CREATE POLICY "artists_read_all" ON artists FOR SELECT USING (true);
CREATE POLICY "artists_insert_own" ON artists FOR INSERT WITH CHECK (public.request_wallet() = lower(wallet));
CREATE POLICY "artists_update_own" ON artists FOR UPDATE USING (public.request_wallet() = lower(wallet));

CREATE POLICY "drops_read_public" ON drops FOR SELECT USING (
  status != 'draft'
  OR EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = drops.artist_id
      AND lower(artists.wallet) = public.request_wallet()
  )
);
CREATE POLICY "drops_create_own" ON drops FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = artist_id
      AND lower(artists.wallet) = public.request_wallet()
  )
);
CREATE POLICY "drops_update_own" ON drops FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = drops.artist_id
      AND lower(artists.wallet) = public.request_wallet()
  )
);
CREATE POLICY "drops_delete_own" ON drops FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM artists
    WHERE artists.id = drops.artist_id
      AND lower(artists.wallet) = public.request_wallet()
  )
);

CREATE POLICY "products_read_published" ON products FOR SELECT USING (status = 'published');
CREATE POLICY "products_read_own_draft" ON products FOR SELECT USING (lower(creator_wallet) = public.request_wallet());
CREATE POLICY "products_create_own" ON products FOR INSERT WITH CHECK (lower(creator_wallet) = public.request_wallet());
CREATE POLICY "products_update_own" ON products FOR UPDATE USING (lower(creator_wallet) = public.request_wallet());

CREATE POLICY "orders_read_buyer" ON orders FOR SELECT USING (lower(buyer_wallet) = public.request_wallet());
CREATE POLICY "orders_read_creator" ON orders FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = orders.product_id
      AND lower(products.creator_wallet) = public.request_wallet()
  )
);
CREATE POLICY "orders_create_own" ON orders FOR INSERT WITH CHECK (lower(buyer_wallet) = public.request_wallet());
CREATE POLICY "orders_update_creator" ON orders FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM products
    WHERE products.id = orders.product_id
      AND lower(products.creator_wallet) = public.request_wallet()
  )
);

CREATE POLICY "whitelist_read_all" ON whitelist FOR SELECT USING (true);
CREATE POLICY "whitelist_write_admin_only" ON whitelist FOR ALL USING (public.request_role() = 'admin')
WITH CHECK (public.request_role() = 'admin');

CREATE POLICY "analytics_insert_all" ON analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_read_related" ON analytics FOR SELECT USING (
  artist_id IS NULL
  OR artist_id IN (
    SELECT id FROM artists WHERE lower(wallet) = public.request_wallet()
  )
);

-- Frontend reads may use the anon key.
-- Any write or privileged action must go through your backend-issued JWT flow.
