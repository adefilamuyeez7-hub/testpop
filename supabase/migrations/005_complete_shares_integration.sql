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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_shares_deployed_at') THEN
    CREATE TRIGGER update_shares_deployed_at
    BEFORE UPDATE ON artists
    FOR EACH ROW
    WHEN (NEW.shares_contract_address IS DISTINCT FROM OLD.shares_contract_address AND NEW.shares_contract_address IS NOT NULL)
    EXECUTE FUNCTION current_timestamp();
  END IF;
END $$;

-- View for shares discovery across the platform
CREATE OR REPLACE VIEW artists_with_active_shares AS
SELECT 
  id,
  name,
  wallet_address,
  shares_contract_address,
  shares_enabled,
  shares_campaign_active,
  shares_deployed_at
FROM artists
WHERE shares_enabled = true
  AND shares_contract_address IS NOT NULL
ORDER BY shares_deployed_at DESC NULLS LAST;

-- Function to deploy shares contract for an artist
CREATE OR REPLACE FUNCTION deploy_artist_shares(
  artist_id UUID,
  contract_address VARCHAR(255),
  deployment_tx VARCHAR(255),
  target_amount NUMERIC
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_artist_exists BOOLEAN;
  v_shares_already_exist BOOLEAN;
BEGIN
  -- Verify artist exists
  SELECT EXISTS(SELECT 1 FROM artists WHERE id = artist_id) INTO v_artist_exists;
  IF NOT v_artist_exists THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Artist not found'::TEXT;
    RETURN;
  END IF;

  -- Check if shares already deployed
  SELECT EXISTS(SELECT 1 FROM artists WHERE id = artist_id AND shares_contract_address IS NOT NULL) 
  INTO v_shares_already_exist;
  IF v_shares_already_exist THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Shares already deployed for this artist'::TEXT;
    RETURN;
  END IF;

  -- Deploy shares contract
  UPDATE artists
  SET 
    shares_enabled = true,
    shares_contract_address = contract_address,
    shares_contract_tx = deployment_tx,
    shares_target_amount = target_amount,
    shares_deployed_at = NOW(),
    updated_at = NOW()
  WHERE id = artist_id;

  RETURN QUERY SELECT true::BOOLEAN, 'Shares contract deployed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle shares campaign on/off
CREATE OR REPLACE FUNCTION toggle_shares_campaign(
  artist_id UUID,
  new_active BOOLEAN
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  campaign_active BOOLEAN
) AS $$
DECLARE
  v_has_shares BOOLEAN;
BEGIN
  -- Check if artist has shares contract deployed
  SELECT EXISTS(SELECT 1 FROM artists WHERE id = artist_id AND shares_contract_address IS NOT NULL)
  INTO v_has_shares;

  IF NOT v_has_shares THEN
    RETURN QUERY SELECT false::BOOLEAN, 'No shares contract deployed'::TEXT, false::BOOLEAN;
    RETURN;
  END IF;

  -- Update campaign status
  UPDATE artists
  SET shares_campaign_active = new_active,
      updated_at = NOW()
  WHERE id = artist_id;

  RETURN QUERY 
  SELECT 
    true::BOOLEAN,
    'Shares campaign ' || CASE WHEN new_active THEN 'activated' ELSE 'deactivated' END::TEXT,
    new_active::BOOLEAN;
END;
$$ LANGUAGE plpgsql;
