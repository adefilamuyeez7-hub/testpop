-- Migration: Add shares system support
-- Extends artist profiles to support optional fundraising via ArtistSharesToken

ALTER TABLE artists 
ADD COLUMN shares_enabled BOOLEAN DEFAULT false,
ADD COLUMN shares_contract_address VARCHAR(255) UNIQUE,
ADD COLUMN shares_contract_tx VARCHAR(255),
ADD COLUMN shares_campaign_active BOOLEAN DEFAULT false;

-- Create index for fast shares lookups
CREATE INDEX idx_artists_shares_contract ON artists(shares_contract_address);
CREATE INDEX idx_artists_shares_campaign ON artists(shares_campaign_active);

-- Comment describing the new columns
COMMENT ON COLUMN artists.shares_enabled IS 'Whether this artist has enabled the fundraising shares system';
COMMENT ON COLUMN artists.shares_contract_address IS 'The ERC-20 ArtistSharesToken contract address for this artist';
COMMENT ON COLUMN artists.shares_contract_tx IS 'Transaction hash of the shares token deployment';
COMMENT ON COLUMN artists.shares_campaign_active IS 'Whether the artist has an active fundraising campaign';
