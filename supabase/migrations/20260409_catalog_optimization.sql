-- ============================================================================
-- Migration: 20260409_catalog_optimization.sql
-- Purpose: Optimize catalog queries and enable Release/Drop consolidation
-- ============================================================================

-- ============================================
-- Step 1: Add Performance Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_creator_status 
  ON products(creator_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drops_artist_status 
  ON drops(artist_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_creative_releases_artist_campaign 
  ON creative_releases(artist_id, campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_item_lookup 
  ON product_feedback_threads(product_id, visibility, status);

-- ============================================
-- Step 2: Create Unified Catalog View
-- ============================================

CREATE OR REPLACE VIEW catalog_unified AS
SELECT 
  'drop'::text as item_type,
  drops.id,
  drops.title,
  drops.description,
  drops.image_url,
  drops.price_eth,
  drops.supply as supply_or_stock,
  drops.contract_address,
  NULL::uuid as campaign_id,
  NULL::text as campaign_type,
  drops.artist_id as creator_id,
  drops.artist_wallet as creator_wallet,
  drops.created_at,
  drops.updated_at,
  COALESCE(drops.supply, 0) > 0 as can_purchase,
  true as can_bid,
  false as can_participate_campaign,
  'live' as status
FROM drops
WHERE drops.status = 'live'

UNION ALL

SELECT 
  'product'::text,
  products.id,
  products.name as title,
  products.description,
  (products.metadata->>'image_url')::text as image_url,
  products.price_eth,
  products.stock as supply_or_stock,
  NULL::text,
  NULL::uuid,
  NULL::text,
  products.creator_id,
  products.creator_wallet,
  products.created_at,
  products.updated_at,
  COALESCE(products.stock, 0) > 0 as can_purchase,
  false as can_bid,
  false as can_participate_campaign,
  'live' as status
FROM products
WHERE products.stock > 0

UNION ALL

SELECT 
  'release'::text,
  creative_releases.id,
  creative_releases.title,
  creative_releases.description,
  creative_releases.image_url,
  COALESCE((creative_releases.metadata->>'price_eth')::numeric, 0),
  NULL::integer,
  NULL::text,
  creative_releases.campaign_id,
  COALESCE((creative_releases.metadata->>'campaign_type')::text, 'funding'),
  creative_releases.artist_id,
  COALESCE(campaigns.creator_wallet, creative_releases.metadata->>'creator_wallet'),
  creative_releases.created_at,
  creative_releases.updated_at,
  true as can_purchase,
  CASE WHEN creative_releases.metadata->>'campaign_type' = 'auction' THEN true ELSE false END,
  true as can_participate_campaign,
  'live' as status
FROM creative_releases
LEFT JOIN campaigns ON creative_releases.campaign_id = campaigns.id
WHERE creative_releases.status = 'live';

-- ============================================
-- Step 3: Add Item Type Tracking to Feedback
-- ============================================

ALTER TABLE product_feedback_threads 
  ADD COLUMN IF NOT EXISTS item_id UUID;

ALTER TABLE product_feedback_threads 
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(50);

-- Create index for unified item lookups
CREATE INDEX IF NOT EXISTS idx_feedback_threads_item 
  ON product_feedback_threads(item_id, item_type);

-- ============================================
-- Step 4: Create Denormalized Comment Count View
-- ============================================

CREATE OR REPLACE VIEW catalog_with_engagement AS
SELECT 
  cu.*,
  COALESCE(comment_stats.comment_count, 0) as comment_count,
  COALESCE(comment_stats.avg_rating, 0) as avg_rating
FROM catalog_unified cu
LEFT JOIN (
  SELECT 
    product_id,
    COUNT(DISTINCT id) as comment_count,
    AVG(CASE WHEN rating IS NOT NULL THEN rating ELSE NULL END) as avg_rating
  FROM product_feedback_threads
  WHERE visibility = 'public'
  GROUP BY product_id
) comment_stats ON cu.id = comment_stats.product_id;

-- ============================================
-- Step 5: Add Helper Functions
-- ============================================

-- Get item details with all metadata
CREATE OR REPLACE FUNCTION get_catalog_item(item_id UUID, item_type TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', id,
    'type', item_type,
    'title', title,
    'description', description,
    'image_url', image_url,
    'price_eth', price_eth,
    'creator_id', creator_id,
    'creator_wallet', creator_wallet,
    'can_purchase', can_purchase,
    'can_bid', can_bid,
    'can_participate_campaign', can_participate_campaign,
    'comment_count', comment_count,
    'avg_rating', avg_rating,
    'created_at', created_at,
    'updated_at', updated_at
  ) INTO result
  FROM catalog_with_engagement
  WHERE id = item_id AND item_type = item_type;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Count items by type
CREATE OR REPLACE FUNCTION count_catalog_by_type(filter_type TEXT DEFAULT NULL)
RETURNS TABLE(item_type TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cu.item_type,
    COUNT(*) as count
  FROM catalog_unified cu
  WHERE (filter_type IS NULL OR cu.item_type = filter_type)
  GROUP BY cu.item_type;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 6: Grant Permissions
-- ============================================

GRANT SELECT ON catalog_unified TO anon, authenticated, service_role;
GRANT SELECT ON catalog_with_engagement TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_catalog_item(UUID, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION count_catalog_by_type(TEXT) TO anon, authenticated, service_role;
