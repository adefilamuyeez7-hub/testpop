-- ============================================================================
-- Migration: 20260409_share_platform_support.sql
-- Purpose: Allow first-party share actions like copy/native to be tracked in
--          the social_shares table without breaking share-link generation.
--          This migration is safe on both existing databases and fresh ones
--          where the table has not been created yet.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.social_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  share_platform VARCHAR(50) NOT NULL,
  shared_by_wallet TEXT,
  share_url TEXT,
  click_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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

ALTER TABLE public.social_shares
  DROP CONSTRAINT IF EXISTS social_shares_platform_check;

ALTER TABLE public.social_shares
  ADD CONSTRAINT social_shares_platform_check
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
  );

CREATE INDEX IF NOT EXISTS idx_social_shares_item
ON public.social_shares(item_id, item_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_shares_platform
ON public.social_shares(share_platform, click_count DESC);
