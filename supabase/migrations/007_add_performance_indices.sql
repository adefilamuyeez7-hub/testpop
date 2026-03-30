-- Add missing performance indices for critical queries
-- Date: March 23, 2026

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS TABLE INDICES (if subscriptions table exists)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Composite index for subscription lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_artist_subscriber 
ON subscriptions(artist_wallet, subscriber_wallet);

-- Index for expiry checks (used in renewal and active status queries)
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry 
ON subscriptions(artist_wallet, expiry_time DESC)
WHERE expiry_time > EXTRACT(EPOCH FROM NOW());

-- Index for subscriber analytics
CREATE INDEX IF NOT EXISTS idx_subscriptions_artist_expiry
ON subscriptions(artist_wallet, expiry_time DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DROPS TABLE INDICES - Already has some, adding critical ones
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for active/live drops queries (used in discovery and filtering)
CREATE INDEX IF NOT EXISTS idx_drops_active 
ON drops(artist_id, status, ends_at DESC)
WHERE status != 'draft';

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
WHERE status = 'published';

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
-- Add index for user tracking
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp
ON audit_logs(changed_by, changed_at DESC);

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
-- Index: idx_subscriptions_expiry ✓

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
-- WHERE status = 'published'
-- ORDER BY created_at DESC
-- Index: idx_products_published ✓

-- ═══════════════════════════════════════════════════════════════════════════════
