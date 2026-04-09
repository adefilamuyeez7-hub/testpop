-- ============================================================================
-- Migration: 20260409_personalization_features.sql
-- Purpose: Add favorites, subscriptions, analytics, and recommendations
-- ============================================================================

-- ============================================
-- 1. USER FAVORITES/WISHLIST TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet TEXT NOT NULL,
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_wallet, item_id, item_type),
  CONSTRAINT user_favorites_item_type_check
    CHECK (item_type IN ('drop', 'product', 'release'))
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_wallet
ON public.user_favorites(lower(user_wallet), saved_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_favorites_item
ON public.user_favorites(item_id, item_type);

-- ============================================
-- 2. CREATOR SUBSCRIPTIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.creator_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_wallet TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  creator_wallet TEXT NOT NULL,
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(subscriber_wallet, creator_id),
  CONSTRAINT creator_subscriptions_tier_check
    CHECK (subscription_tier IN ('free', 'supporter', 'vip', 'collector'))
);

CREATE INDEX IF NOT EXISTS idx_creator_subscriptions_subscriber
ON public.creator_subscriptions(lower(subscriber_wallet), subscribed_at DESC);

CREATE INDEX IF NOT EXISTS idx_creator_subscriptions_creator
ON public.creator_subscriptions(creator_id, subscription_tier);

-- ============================================
-- 3. ANALYTICS EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  user_wallet TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT analytics_events_event_type_check
    CHECK (event_type IN ('view', 'like', 'comment', 'purchase', 'share'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_item
ON public.analytics_events(item_id, item_type, event_type);

CREATE INDEX IF NOT EXISTS idx_analytics_events_date
ON public.analytics_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user
ON public.analytics_events(lower(user_wallet), created_at DESC);

-- ============================================
-- 4. RECOMMENDATIONS TABLE (Materialized)
-- ============================================

CREATE TABLE IF NOT EXISTS public.item_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  recommended_item_id UUID NOT NULL,
  recommended_item_type VARCHAR(50),
  recommendation_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  co_purchase_count INT DEFAULT 0,
  similarity_score DECIMAL(5,2) DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(item_id, item_type, recommended_item_id, recommended_item_type)
);

CREATE INDEX IF NOT EXISTS idx_item_recommendations_item
ON public.item_recommendations(item_id, item_type, recommendation_score DESC);

-- ============================================
-- 5. SOCIAL SHARES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  share_platform VARCHAR(50) NOT NULL,
  shared_by_wallet TEXT,
  share_url TEXT,
  click_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT social_shares_platform_check
    CHECK (
      share_platform IN (
        'twitter',
        'facebook',
        'linkedin',
        'telegram',
        'whatsapp',
        'reddit',
        'copy',
        'native'
      )
    )
);

ALTER TABLE public.social_shares
  ADD COLUMN IF NOT EXISTS item_id UUID;

ALTER TABLE public.social_shares
  ADD COLUMN IF NOT EXISTS item_type VARCHAR(50);

ALTER TABLE public.social_shares
  ADD COLUMN IF NOT EXISTS share_platform VARCHAR(50);

ALTER TABLE public.social_shares
  ADD COLUMN IF NOT EXISTS shared_by_wallet TEXT;

ALTER TABLE public.social_shares
  ADD COLUMN IF NOT EXISTS share_url TEXT;

ALTER TABLE public.social_shares
  ADD COLUMN IF NOT EXISTS click_count INT DEFAULT 0;

ALTER TABLE public.social_shares
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

UPDATE public.social_shares
SET click_count = COALESCE(click_count, 0),
    created_at = COALESCE(created_at, NOW())
WHERE click_count IS NULL
   OR created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_social_shares_item
ON public.social_shares(item_id, item_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_shares_platform
ON public.social_shares(share_platform, click_count DESC);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Get user's favorite items
CREATE OR REPLACE FUNCTION get_user_favorites(wallet_address TEXT, limit_count INT DEFAULT 50)
RETURNS TABLE(item_id UUID, item_type VARCHAR, saved_at TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT uf.item_id, uf.item_type, uf.saved_at
  FROM public.user_favorites uf
  WHERE lower(uf.user_wallet) = lower(wallet_address)
  ORDER BY uf.saved_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Get creator's subscribers count
CREATE OR REPLACE FUNCTION get_creator_subscriber_count(creator_id_param UUID)
RETURNS INT AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM public.creator_subscriptions cs
    WHERE cs.creator_id = creator_id_param
  );
END;
$$ LANGUAGE plpgsql;

-- Get item analytics summary
CREATE OR REPLACE FUNCTION get_item_analytics(item_id_param UUID, item_type_param VARCHAR)
RETURNS TABLE(views INT, likes INT, comments INT, purchases INT, shares INT, avg_rating DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'view'), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'like'), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'comment'), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'purchase'), 0)::INT,
    COALESCE((SELECT COUNT(*) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'share'), 0)::INT,
    COALESCE((SELECT AVG(CAST(data->>'rating' AS INT)) FROM public.analytics_events WHERE item_id = item_id_param AND item_type = item_type_param AND event_type = 'like'), 0)::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- Get recommendations for item
CREATE OR REPLACE FUNCTION get_item_recommendations(item_id_param UUID, item_type_param VARCHAR, limit_count INT DEFAULT 10)
RETURNS TABLE(recommended_item_id UUID, recommended_item_type VARCHAR, score DECIMAL) AS $$
BEGIN
  RETURN QUERY
  SELECT ir.recommended_item_id, ir.recommended_item_type, ir.recommendation_score
  FROM public.item_recommendations ir
  WHERE ir.item_id = item_id_param AND ir.item_type = item_type_param
  ORDER BY ir.recommendation_score DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION get_user_favorites(TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_creator_subscriber_count(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_item_analytics(UUID, VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_item_recommendations(UUID, VARCHAR, INT) TO anon, authenticated, service_role;

GRANT SELECT ON public.user_favorites TO anon, authenticated;
GRANT SELECT ON public.creator_subscriptions TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated, service_role;
GRANT SELECT ON public.item_recommendations TO anon, authenticated;
GRANT SELECT ON public.social_shares TO anon, authenticated;

GRANT INSERT ON public.user_favorites TO authenticated;
GRANT INSERT ON public.creator_subscriptions TO authenticated;
GRANT INSERT ON public.analytics_events TO authenticated, service_role;
GRANT INSERT ON public.social_shares TO authenticated, service_role;

GRANT UPDATE ON public.user_favorites TO authenticated;
GRANT UPDATE ON public.creator_subscriptions TO authenticated;

GRANT DELETE ON public.user_favorites TO authenticated;
GRANT DELETE ON public.creator_subscriptions TO authenticated;

-- ============================================
-- 8. ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_favorites_own" ON public.user_favorites;
CREATE POLICY "user_favorites_own" ON public.user_favorites
  FOR ALL
  USING (lower(user_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(user_wallet) = lower(auth.jwt() ->> 'wallet_address'))
  WITH CHECK (lower(user_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(user_wallet) = lower(auth.jwt() ->> 'wallet_address'));

DROP POLICY IF EXISTS "creator_subscriptions_own" ON public.creator_subscriptions;
CREATE POLICY "creator_subscriptions_own" ON public.creator_subscriptions
  FOR ALL
  USING (lower(subscriber_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(subscriber_wallet) = lower(auth.jwt() ->> 'wallet_address'))
  WITH CHECK (lower(subscriber_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(subscriber_wallet) = lower(auth.jwt() ->> 'wallet_address'));

DROP POLICY IF EXISTS "social_shares_public_read" ON public.social_shares;
CREATE POLICY "social_shares_public_read" ON public.social_shares
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "social_shares_own_write" ON public.social_shares;
CREATE POLICY "social_shares_own_write" ON public.social_shares
  FOR ALL
  USING (lower(shared_by_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(shared_by_wallet) = lower(auth.jwt() ->> 'wallet_address'))
  WITH CHECK (lower(shared_by_wallet) = lower(auth.jwt() ->> 'sub')
    OR lower(shared_by_wallet) = lower(auth.jwt() ->> 'wallet_address'));
