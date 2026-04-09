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

CREATE OR REPLACE VIEW public.catalog_unified AS
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
  p.contract_address,
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

CREATE OR REPLACE VIEW public.catalog_with_engagement AS
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
