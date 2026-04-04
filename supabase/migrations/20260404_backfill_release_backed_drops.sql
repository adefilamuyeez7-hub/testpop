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
