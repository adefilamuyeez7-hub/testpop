-- Fix subscription expiry index so it can be created on Postgres/Supabase
-- Date: April 3, 2026
--
-- Root cause:
--   Postgres index predicates must be IMMUTABLE.
--   The previous predicate used NOW(), which is STABLE and therefore invalid.

DROP INDEX IF EXISTS idx_subscriptions_expiry;

CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry
ON subscriptions(expiry_time DESC)
WHERE expiry_time IS NOT NULL;
