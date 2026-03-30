-- Nonce storage table for one-time authentication challenges
-- Supports multi-instance deployments (no in-memory state)
-- Prevents nonce replay attacks across server instances

CREATE TABLE IF NOT EXISTS nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  nonce TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for query performance
  CHECK (issued_at <= expires_at),
  CHECK (used_at IS NULL OR used = TRUE)
);

-- Index for finding unused nonces by wallet
CREATE INDEX IF NOT EXISTS idx_nonces_wallet_unused 
ON nonces(wallet, used) 
WHERE used = FALSE;

-- Index for cleanup of expired nonces
CREATE INDEX IF NOT EXISTS idx_nonces_expires_at 
ON nonces(expires_at) 
WHERE used = FALSE;

-- Index for uniqueness enforcement
CREATE UNIQUE INDEX IF NOT EXISTS idx_nonces_unique_nonce 
ON nonces(nonce) 
WHERE used = FALSE;

-- Cleanup trigger: Remove expired nonces daily
CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS void AS $$
BEGIN
  DELETE FROM nonces
  WHERE expires_at < NOW() AND used = FALSE;
END;
$$ LANGUAGE plpgsql;

-- Note: In production, set up a cron job to call cleanup_expired_nonces() daily
-- SELECT cron.schedule('cleanup-nonces', '0 2 * * *', 'SELECT cleanup_expired_nonces()');
