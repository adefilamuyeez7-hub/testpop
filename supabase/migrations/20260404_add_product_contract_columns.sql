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
