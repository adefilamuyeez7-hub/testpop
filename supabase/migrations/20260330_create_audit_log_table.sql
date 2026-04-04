-- Admin audit log table for tracking all administrative actions
-- Provides accountability and debugging information for artist approval/rejection/deployment

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_wallet TEXT NOT NULL,
  action TEXT NOT NULL,
  target_wallet TEXT,
  status TEXT,
  details JSONB DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CHECK (action IN ('approve_artist', 'reject_artist', 'deploy_contract', 'revoke_approval', 'delete_artist')),
  CHECK (status IN ('pending', 'approved', 'rejected', 'deployed', 'failed', 'revoked'))
);

-- Index for finding actions by admin
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_wallet 
ON admin_audit_log(admin_wallet);

-- Index for finding actions by target artist
CREATE INDEX IF NOT EXISTS idx_audit_log_target_wallet 
ON admin_audit_log(target_wallet);

-- Index for finding actions by type
CREATE INDEX IF NOT EXISTS idx_audit_log_action 
ON admin_audit_log(action);

-- Index for finding recent actions
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at 
ON admin_audit_log(created_at DESC);

-- Update whitelist table to support rejection reasons
ALTER TABLE IF EXISTS whitelist 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- Restrict audit log access to the configured admin wallet
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view all audit logs" ON admin_audit_log;
DROP POLICY IF EXISTS "admin_audit_log_read_admin_only" ON admin_audit_log;

CREATE POLICY "admin_audit_log_read_admin_only"
ON admin_audit_log
FOR SELECT
USING (
  lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
  OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
);
