-- ============================================================================
-- Migration: 20260405_security_lockdown.sql
-- ============================================================================
-- Locks down public application/IP commerce exposure and aligns RLS with POPUP auth JWT claims.

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

GRANT EXECUTE ON FUNCTION public.popup_jwt_wallet() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.popup_is_admin() TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "applications_public_select" ON public.artist_applications;
DROP POLICY IF EXISTS "applications_admin_update" ON public.artist_applications;
DROP POLICY IF EXISTS "applications_owner_or_admin_select" ON public.artist_applications;
DROP POLICY IF EXISTS "applications_admin_update_only" ON public.artist_applications;

CREATE POLICY "applications_owner_or_admin_select" ON public.artist_applications
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(wallet_address) = public.popup_jwt_wallet()
  );

CREATE POLICY "applications_admin_update_only" ON public.artist_applications
  FOR UPDATE
  USING (public.popup_is_admin())
  WITH CHECK (public.popup_is_admin());

ALTER TABLE public.product_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ip_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalty_distributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_assets_select_guarded" ON public.product_assets;
DROP POLICY IF EXISTS "product_assets_insert_owner_or_admin" ON public.product_assets;
DROP POLICY IF EXISTS "product_assets_update_owner_or_admin" ON public.product_assets;
DROP POLICY IF EXISTS "product_assets_delete_owner_or_admin" ON public.product_assets;

CREATE POLICY "product_assets_select_guarded" ON public.product_assets
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
    OR (
      visibility = 'public'
      AND EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.id = product_assets.product_id
          AND p.status IN ('published', 'active')
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.entitlements e
      WHERE e.product_id = product_assets.product_id
        AND (e.asset_id = product_assets.id OR e.asset_id IS NULL)
        AND lower(e.buyer_wallet) = public.popup_jwt_wallet()
        AND e.status = 'granted'
        AND e.revoked_at IS NULL
        AND (e.expires_at IS NULL OR e.expires_at > now())
    )
  );

CREATE POLICY "product_assets_insert_owner_or_admin" ON public.product_assets
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "product_assets_update_owner_or_admin" ON public.product_assets
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "product_assets_delete_owner_or_admin" ON public.product_assets
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_assets.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

DROP POLICY IF EXISTS "entitlements_select_guarded" ON public.entitlements;
DROP POLICY IF EXISTS "entitlements_insert_owner_or_admin" ON public.entitlements;
DROP POLICY IF EXISTS "entitlements_update_owner_or_admin" ON public.entitlements;
DROP POLICY IF EXISTS "entitlements_delete_owner_or_admin" ON public.entitlements;

CREATE POLICY "entitlements_select_guarded" ON public.entitlements
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(buyer_wallet) = public.popup_jwt_wallet()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "entitlements_insert_owner_or_admin" ON public.entitlements
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "entitlements_update_owner_or_admin" ON public.entitlements
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "entitlements_delete_owner_or_admin" ON public.entitlements
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = entitlements.product_id
        AND lower(p.creator_wallet) = public.popup_jwt_wallet()
    )
  );

DROP POLICY IF EXISTS "fulfillments_select_guarded" ON public.fulfillments;
DROP POLICY IF EXISTS "fulfillments_insert_owner_or_admin" ON public.fulfillments;
DROP POLICY IF EXISTS "fulfillments_update_owner_or_admin" ON public.fulfillments;
DROP POLICY IF EXISTS "fulfillments_delete_owner_or_admin" ON public.fulfillments;

CREATE POLICY "fulfillments_select_guarded" ON public.fulfillments
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = fulfillments.order_id
        AND lower(o.buyer_wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "fulfillments_insert_owner_or_admin" ON public.fulfillments
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
  );

CREATE POLICY "fulfillments_update_owner_or_admin" ON public.fulfillments
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
  )
  WITH CHECK (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
  );

CREATE POLICY "fulfillments_delete_owner_or_admin" ON public.fulfillments
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR lower(coalesce(creator_wallet, '')) = public.popup_jwt_wallet()
  );

DROP POLICY IF EXISTS "ip_campaigns_select_guarded" ON public.ip_campaigns;
DROP POLICY IF EXISTS "ip_campaigns_insert_owner_or_admin" ON public.ip_campaigns;
DROP POLICY IF EXISTS "ip_campaigns_update_owner_or_admin" ON public.ip_campaigns;
DROP POLICY IF EXISTS "ip_campaigns_delete_owner_or_admin" ON public.ip_campaigns;

CREATE POLICY "ip_campaigns_select_guarded" ON public.ip_campaigns
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
    OR EXISTS (
      SELECT 1
      FROM public.ip_investments i
      WHERE i.campaign_id = ip_campaigns.id
        AND lower(i.investor_wallet) = public.popup_jwt_wallet()
    )
    OR (
      visibility = 'listed'
      AND status IN ('active', 'funded', 'settled', 'closed')
    )
  );

CREATE POLICY "ip_campaigns_insert_owner_or_admin" ON public.ip_campaigns
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "ip_campaigns_update_owner_or_admin" ON public.ip_campaigns
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "ip_campaigns_delete_owner_or_admin" ON public.ip_campaigns
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.artists a
      WHERE a.id = ip_campaigns.artist_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

DROP POLICY IF EXISTS "ip_investments_select_guarded" ON public.ip_investments;
DROP POLICY IF EXISTS "ip_investments_insert_self_or_admin" ON public.ip_investments;
DROP POLICY IF EXISTS "ip_investments_update_owner_or_admin" ON public.ip_investments;
DROP POLICY IF EXISTS "ip_investments_delete_owner_or_admin" ON public.ip_investments;

CREATE POLICY "ip_investments_select_guarded" ON public.ip_investments
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(investor_wallet) = public.popup_jwt_wallet()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = ip_investments.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "ip_investments_insert_self_or_admin" ON public.ip_investments
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR lower(investor_wallet) = public.popup_jwt_wallet()
  );

CREATE POLICY "ip_investments_update_owner_or_admin" ON public.ip_investments
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = ip_investments.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = ip_investments.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "ip_investments_delete_owner_or_admin" ON public.ip_investments
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = ip_investments.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

DROP POLICY IF EXISTS "royalty_distributions_select_guarded" ON public.royalty_distributions;
DROP POLICY IF EXISTS "royalty_distributions_insert_owner_or_admin" ON public.royalty_distributions;
DROP POLICY IF EXISTS "royalty_distributions_update_owner_or_admin" ON public.royalty_distributions;
DROP POLICY IF EXISTS "royalty_distributions_delete_owner_or_admin" ON public.royalty_distributions;

CREATE POLICY "royalty_distributions_select_guarded" ON public.royalty_distributions
  FOR SELECT
  USING (
    public.popup_is_admin()
    OR lower(recipient_wallet) = public.popup_jwt_wallet()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "royalty_distributions_insert_owner_or_admin" ON public.royalty_distributions
  FOR INSERT
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "royalty_distributions_update_owner_or_admin" ON public.royalty_distributions
  FOR UPDATE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  )
  WITH CHECK (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );

CREATE POLICY "royalty_distributions_delete_owner_or_admin" ON public.royalty_distributions
  FOR DELETE
  USING (
    public.popup_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.ip_campaigns c
      JOIN public.artists a ON a.id = c.artist_id
      WHERE c.id = royalty_distributions.campaign_id
        AND lower(a.wallet) = public.popup_jwt_wallet()
    )
  );
