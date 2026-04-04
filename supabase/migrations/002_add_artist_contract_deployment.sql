-- Migration: Add artist contract deployment tracking
-- This migration adds support for artist-specific contract deployments.
-- Each artist gets their own ArtDrop contract instance via the ArtDropFactory.

-- Add contract_address column to artists table
ALTER TABLE artists 
ADD COLUMN IF NOT EXISTS contract_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS contract_deployment_tx VARCHAR(255),
ADD COLUMN IF NOT EXISTS contract_deployed_at TIMESTAMP WITH TIME ZONE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'artists_contract_address_key'
  ) THEN
    ALTER TABLE artists
    ADD CONSTRAINT artists_contract_address_key UNIQUE (contract_address);
  END IF;
END $$;

-- Create index for faster contract address lookups
CREATE INDEX IF NOT EXISTS idx_artists_contract_address ON artists(contract_address);
CREATE INDEX IF NOT EXISTS idx_artists_deployment_status ON artists(contract_deployed_at DESC);

-- Add comment describing the new columns
COMMENT ON COLUMN artists.contract_address IS 'The ArtDrop contract address deployed for this artist via ArtDropFactory';
COMMENT ON COLUMN artists.contract_deployment_tx IS 'Transaction hash of the contract deployment';
COMMENT ON COLUMN artists.contract_deployed_at IS 'Timestamp when the contract was deployed';

-- Update drops table to reference artist contract directly
-- (Optional: useful for optimization, each drop knows its contract immediately)
ALTER TABLE drops 
ADD COLUMN IF NOT EXISTS artist_contract_address VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_drops_artist_contract ON drops(artist_contract_address);

COMMENT ON COLUMN drops.artist_contract_address IS 'The artist contract address where this drop was deployed';
