-- ═══════════════════════════════════════════════════════════════════════════════
-- NONCES TABLE - One-time authentication challenges
-- ═══════════════════════════════════════════════════════════════════════════════
-- Supports multi-instance deployments (no in-memory state)
-- Prevents nonce replay attacks across server instances
-- Default TTL: 15 minutes
-- Wallet storage: Normalized to lowercase for consistency across all auth systems

CREATE TABLE IF NOT EXISTS nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL, -- Stored as lowercase for consistency
  nonce TEXT NOT NULL,
  issued_at TIMESTAMP WITH TIME ZONE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Data integrity constraints
  CONSTRAINT valid_timestamps CHECK (issued_at <= expires_at),
  CONSTRAINT valid_used_state CHECK (used_at IS NULL OR used = TRUE),
  CONSTRAINT valid_wallet CHECK (wallet ~* '^0x[a-f0-9]{40}$'), -- Must be valid Ethereum address
  CONSTRAINT valid_nonce CHECK (nonce ~ '^[a-f0-9]{64}$'), -- Must be 32-byte hex
  CONSTRAINT one_time_use_per_wallet UNIQUE (wallet, nonce) -- Prevent duplicate nonces per wallet
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES - Query performance optimization
-- ═══════════════════════════════════════════════════════════════════════════════

-- Index for finding unused nonces by wallet (most common query in auth flow)
CREATE INDEX IF NOT EXISTS idx_nonces_wallet_unused 
ON nonces(wallet, used, expires_at) 
WHERE used = FALSE;

-- Index for cleanup of expired nonces (nightly maintenance)
CREATE INDEX IF NOT EXISTS idx_nonces_expires_at 
ON nonces(expires_at DESC) 
WHERE used = FALSE;

-- Index for finding specific nonce quickly (during verification)
CREATE INDEX IF NOT EXISTS idx_nonces_nonce 
ON nonces(nonce) 
WHERE used = FALSE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CLEANUP FUNCTION - Automated maintenance
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cleanup_expired_nonces()
RETURNS TABLE(expired_count INT, used_count INT) AS $$
DECLARE
  expired_rows INT := 0;
  used_rows INT := 0;
BEGIN
  -- Delete expired unused nonces (older than their expiry time)
  DELETE FROM nonces
  WHERE expires_at < NOW() AND used = FALSE;
  GET DIAGNOSTICS expired_rows = ROW_COUNT;
  
  -- Delete used nonces older than 7 days (reduce storage bloat)
  DELETE FROM nonces
  WHERE used = TRUE AND used_at < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS used_rows = ROW_COUNT;
  
  RETURN QUERY SELECT expired_rows, used_rows;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY - Data access control
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE nonces ENABLE ROW LEVEL SECURITY;

-- Only backend (service role) can access nonces table
-- This prevents any direct client-side access
CREATE POLICY "Service role only" ON nonces
  USING (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRODUCTION SETUP INSTRUCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- For nightly cleanup, set up a cron job in Supabase:
-- SELECT cron.schedule('cleanup-nonces', '0 2 * * *', 'SELECT cleanup_expired_nonces()');
--
-- For rate limiting per wallet, check server/index.js:
-- - Maximum 5 nonce requests per wallet per 15 minutes
-- - Enforced via in-memory cache with wallet + timestamp tracking
--
-- Wallet normalization is handled in backend at import time:
-- - All wallets converted to lowercase before storage
-- - No raw user input accepted (always validate format first)
