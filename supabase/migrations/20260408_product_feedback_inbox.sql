-- ============================================================================
-- Migration: 20260408_product_feedback_inbox.sql
-- Description:
--   * Adds verified collector feedback threads for products
--   * Introduces creator-curated public reviews and private feedback inboxes
--   * Adds wallet-aware RLS for creator/collector participation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.popup_jwt_wallet()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT lower(
    nullif(
      coalesce(
        auth.jwt() ->> 'sub',
        auth.jwt() ->> 'wallet_address',
        auth.jwt() ->> 'wallet',
        auth.jwt() ->> 'address',
        ''
      ),
      ''
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.popup_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    coalesce(lower(auth.jwt() ->> 'app_role'), '') = 'admin'
    OR coalesce(lower(auth.jwt() ->> 'role_name'), '') = 'admin'
    OR auth.role() = 'service_role';
$$;

CREATE OR REPLACE FUNCTION public.popup_wallet_owns_artist(target_artist_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = target_artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    );
$$;

CREATE TABLE IF NOT EXISTS public.product_feedback_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  buyer_wallet TEXT NOT NULL,
  creator_wallet TEXT NOT NULL,
  feedback_type VARCHAR(50) NOT NULL DEFAULT 'feedback',
  visibility VARCHAR(20) NOT NULL DEFAULT 'private',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  rating INT,
  title TEXT,
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  creator_curated BOOLEAN NOT NULL DEFAULT FALSE,
  subscriber_priority BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT product_feedback_threads_feedback_type_check
    CHECK (feedback_type IN ('review', 'feedback', 'question')),
  CONSTRAINT product_feedback_threads_visibility_check
    CHECK (visibility IN ('public', 'private')),
  CONSTRAINT product_feedback_threads_status_check
    CHECK (status IN ('open', 'closed', 'archived')),
  CONSTRAINT product_feedback_threads_rating_check
    CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_product_id
ON public.product_feedback_threads(product_id, featured DESC, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_artist_id
ON public.product_feedback_threads(artist_id, status, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_buyer_wallet
ON public.product_feedback_threads(lower(buyer_wallet), last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_feedback_threads_visibility
ON public.product_feedback_threads(visibility, status, featured DESC);

CREATE TABLE IF NOT EXISTS public.product_feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.product_feedback_threads(id) ON DELETE CASCADE,
  sender_wallet TEXT NOT NULL,
  sender_role VARCHAR(20) NOT NULL DEFAULT 'collector',
  body TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT product_feedback_messages_sender_role_check
    CHECK (sender_role IN ('creator', 'collector', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_product_feedback_messages_thread_id
ON public.product_feedback_messages(thread_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.popup_wallet_can_access_product_feedback_thread(target_thread_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.product_feedback_threads t
    WHERE t.id = target_thread_id
      AND (
        public.popup_is_admin()
        OR public.popup_wallet_owns_artist(t.artist_id)
        OR lower(t.buyer_wallet) = public.popup_jwt_wallet()
        OR (t.visibility = 'public' AND t.status <> 'archived')
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.popup_jwt_wallet() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_wallet_owns_artist(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_wallet_can_access_product_feedback_thread(UUID) TO anon, authenticated, service_role;

ALTER TABLE public.product_feedback_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_feedback_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_feedback_threads_select_accessible" ON public.product_feedback_threads;
CREATE POLICY "product_feedback_threads_select_accessible" ON public.product_feedback_threads
  FOR SELECT
  USING (public.popup_wallet_can_access_product_feedback_thread(id));

DROP POLICY IF EXISTS "product_feedback_threads_insert_participant" ON public.product_feedback_threads;
CREATE POLICY "product_feedback_threads_insert_participant" ON public.product_feedback_threads
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(buyer_wallet) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "product_feedback_threads_update_participant" ON public.product_feedback_threads;
CREATE POLICY "product_feedback_threads_update_participant" ON public.product_feedback_threads
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(buyer_wallet) = public.popup_jwt_wallet()
  )
  WITH CHECK (
    public.popup_is_admin()
    OR public.popup_wallet_owns_artist(artist_id)
    OR lower(buyer_wallet) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "product_feedback_messages_select_accessible" ON public.product_feedback_messages;
CREATE POLICY "product_feedback_messages_select_accessible" ON public.product_feedback_messages
  FOR SELECT
  USING (public.popup_wallet_can_access_product_feedback_thread(thread_id));

DROP POLICY IF EXISTS "product_feedback_messages_insert_participant" ON public.product_feedback_messages;
CREATE POLICY "product_feedback_messages_insert_participant" ON public.product_feedback_messages
  FOR INSERT
  WITH CHECK (
    (public.popup_is_admin() OR lower(sender_wallet) = public.popup_jwt_wallet())
    AND public.popup_wallet_can_access_product_feedback_thread(thread_id)
  );

GRANT SELECT ON public.product_feedback_threads TO anon, authenticated;
GRANT SELECT ON public.product_feedback_messages TO anon, authenticated;
GRANT ALL ON public.product_feedback_threads TO service_role;
GRANT ALL ON public.product_feedback_messages TO service_role;
GRANT ALL ON public.product_feedback_threads TO authenticated;
GRANT ALL ON public.product_feedback_messages TO authenticated;
