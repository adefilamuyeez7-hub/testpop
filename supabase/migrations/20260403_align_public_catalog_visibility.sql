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
