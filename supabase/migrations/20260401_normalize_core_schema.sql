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
