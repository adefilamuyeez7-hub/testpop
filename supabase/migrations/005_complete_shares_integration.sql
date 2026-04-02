-- Migration: Complete shares system integration
-- Description: Updates artists table to fully support shares system with deployment tracking

-- Update artists table with shares deployment tracking
ALTER TABLE artists
ADD COLUMN IF NOT EXISTS shares_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shares_contract_address VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS shares_contract_tx CHARACTER VARYING,
ADD COLUMN IF NOT EXISTS shares_campaign_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shares_target_amount NUMERIC,
ADD COLUMN IF NOT EXISTS shares_deployed_at TIMESTAMP WITH TIME ZONE;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_artists_shares_enabled ON artists(shares_enabled);
CREATE INDEX IF NOT EXISTS idx_artists_shares_contract ON artists(shares_contract_address) WHERE shares_contract_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artists_shares_campaign ON artists(shares_campaign_active);

-- Trigger to auto-update shares_deployed_at on shares_contract_address change
CREATE OR REPLACE FUNCTION public.set_shares_deployed_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.shares_contract_address IS DISTINCT FROM OLD.shares_contract_address
     AND NEW.shares_contract_address IS NOT NULL THEN
    NEW.shares_deployed_at = COALESCE(NEW.shares_deployed_at, NOW());
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_shares_deployed_at ON artists;
CREATE TRIGGER update_shares_deployed_at
BEFORE UPDATE ON artists
FOR EACH ROW
EXECUTE FUNCTION public.set_shares_deployed_at_timestamp();

-- View for shares discovery across the platform
CREATE OR REPLACE VIEW public.artists_with_active_shares AS
SELECT 
  id,
  name,
  wallet,
  shares_contract_address,
  shares_enabled,
  shares_campaign_active,
  shares_deployed_at
FROM artists
WHERE shares_enabled = true
  AND shares_contract_address IS NOT NULL
ORDER BY shares_deployed_at DESC NULLS LAST;

-- Function to deploy shares contract for an artist
CREATE OR REPLACE FUNCTION public.deploy_artist_shares(
  p_artist_id UUID,
  p_contract_address VARCHAR(255),
  p_deployment_tx VARCHAR(255),
  p_target_amount NUMERIC
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_artist_exists BOOLEAN;
  v_shares_already_exist BOOLEAN;
BEGIN
  IF p_artist_id IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Artist id is required'::TEXT;
    RETURN;
  END IF;

  IF NULLIF(BTRIM(p_contract_address), '') IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Contract address is required'::TEXT;
    RETURN;
  END IF;

  IF p_target_amount IS NOT NULL AND p_target_amount < 0 THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Target amount must be zero or greater'::TEXT;
    RETURN;
  END IF;

  -- Verify artist exists
  SELECT EXISTS(SELECT 1 FROM public.artists WHERE id = p_artist_id) INTO v_artist_exists;
  IF NOT v_artist_exists THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Artist not found'::TEXT;
    RETURN;
  END IF;

  -- Check if shares already deployed
  SELECT EXISTS(
    SELECT 1
    FROM public.artists
    WHERE id = p_artist_id
      AND shares_contract_address IS NOT NULL
  )
  INTO v_shares_already_exist;
  IF v_shares_already_exist THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Shares already deployed for this artist'::TEXT;
    RETURN;
  END IF;

  -- Deploy shares contract
  UPDATE public.artists
  SET 
    shares_enabled = true,
    shares_contract_address = LOWER(BTRIM(p_contract_address)),
    shares_contract_tx = NULLIF(BTRIM(p_deployment_tx), ''),
    shares_target_amount = p_target_amount,
    shares_deployed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_artist_id;

  RETURN QUERY SELECT true::BOOLEAN, 'Shares contract deployed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to toggle shares campaign on/off
CREATE OR REPLACE FUNCTION public.toggle_shares_campaign(
  p_artist_id UUID,
  p_new_active BOOLEAN
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  campaign_active BOOLEAN
) AS $$
DECLARE
  v_has_shares BOOLEAN;
BEGIN
  IF p_artist_id IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Artist id is required'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  IF p_new_active IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Campaign state is required'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  -- Check if artist has shares contract deployed
  SELECT EXISTS(
    SELECT 1
    FROM public.artists
    WHERE id = p_artist_id
      AND shares_contract_address IS NOT NULL
  )
  INTO v_has_shares;

  IF NOT v_has_shares THEN
    RETURN QUERY SELECT false::BOOLEAN, 'No shares contract deployed'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  -- Update campaign status
  UPDATE public.artists
  SET shares_campaign_active = p_new_active,
      updated_at = NOW()
  WHERE id = p_artist_id;

  RETURN QUERY 
  SELECT 
    true::BOOLEAN,
    'Shares campaign ' || CASE WHEN p_new_active THEN 'activated' ELSE 'deactivated' END::TEXT,
    p_new_active::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.deploy_artist_shares(UUID, VARCHAR, VARCHAR, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deploy_artist_shares(UUID, VARCHAR, VARCHAR, NUMERIC) TO service_role;

GRANT EXECUTE ON FUNCTION public.toggle_shares_campaign(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_shares_campaign(UUID, BOOLEAN) TO service_role;
