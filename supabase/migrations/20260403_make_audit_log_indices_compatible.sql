-- Make audit-log indexing compatible across legacy and current schemas
-- Date: April 3, 2026
--
-- Some environments have `admin_audit_log` from older migrations.
-- Newer environments create `audit_logs` in 006_fix_rls_policies.sql.
-- This migration adds indexes only when the matching table exists.

DO $$
BEGIN
  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(changed_by, changed_at DESC)';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_admin_wallet_created_at ON admin_audit_log(admin_wallet, created_at DESC)';
  END IF;
END $$;
