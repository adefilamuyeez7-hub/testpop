-- Migration: Rotate admin wallet policies and harden legacy audit-log access
-- Description:
--   * Updates admin-gated whitelist and audit-log policies for existing databases
--   * Supports both `sub` and legacy `wallet_address` JWT claims
--   * Normalizes wallet casing so lowercase JWTs still match the configured admin

DO $$
BEGIN
  IF to_regclass('public.whitelist') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "whitelist_write_admin_only" ON public.whitelist';
    EXECUTE 'DROP POLICY IF EXISTS "whitelist_insert_admin_only" ON public.whitelist';
    EXECUTE 'DROP POLICY IF EXISTS "whitelist_update_admin_only" ON public.whitelist';
    EXECUTE 'DROP POLICY IF EXISTS "whitelist_delete_admin_only" ON public.whitelist';

    EXECUTE $policy$
      CREATE POLICY "whitelist_insert_admin_only" ON public.whitelist
      FOR INSERT
      WITH CHECK (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "whitelist_update_admin_only" ON public.whitelist
      FOR UPDATE
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;

    EXECUTE $policy$
      CREATE POLICY "whitelist_delete_admin_only" ON public.whitelist
      FOR DELETE
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;
  END IF;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "audit_logs_read_admin_only" ON public.audit_logs';

    EXECUTE $policy$
      CREATE POLICY "audit_logs_read_admin_only" ON public.audit_logs
      FOR SELECT
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;
  END IF;

  IF to_regclass('public.admin_audit_log') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admin can view all audit logs" ON public.admin_audit_log';
    EXECUTE 'DROP POLICY IF EXISTS "admin_audit_log_read_admin_only" ON public.admin_audit_log';

    EXECUTE $policy$
      CREATE POLICY "admin_audit_log_read_admin_only" ON public.admin_audit_log
      FOR SELECT
      USING (
        lower(coalesce(auth.jwt() ->> 'sub', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
        OR lower(coalesce(auth.jwt() ->> 'wallet_address', '')) = lower('0x04dE2EE1cF5A46539d1dbED0eC8f2A541Ac5412C')
      )
    $policy$;
  END IF;
END $$;
