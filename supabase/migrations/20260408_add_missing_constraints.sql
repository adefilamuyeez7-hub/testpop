-- ============================================================================
-- Migration: 20260408_add_missing_constraints.sql
-- Purpose: Add UNIQUE and FK constraints for data integrity
-- Date: April 8, 2026
-- ============================================================================

-- Wallet is already unique in the base schema. Keep this migration idempotent by
-- only adding the named constraint when older environments somehow missed it.
DO $$
BEGIN
  IF to_regclass('public.artists') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.artists'::regclass
         AND conname IN ('artists_wallet_unique', 'artists_wallet_key')
     ) THEN
    ALTER TABLE public.artists
      ADD CONSTRAINT artists_wallet_unique UNIQUE (wallet);
  END IF;
END $$;

-- ============================================================================
-- ORDERS TABLE - Add unique constraint on tx_hash
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.orders'::regclass
         AND conname = 'orders_tx_hash_unique'
     )
     AND NOT EXISTS (
       SELECT tx_hash
       FROM public.orders
       WHERE tx_hash IS NOT NULL
       GROUP BY tx_hash
       HAVING COUNT(*) > 1
     ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_tx_hash_unique UNIQUE (tx_hash);
  END IF;
END $$;

-- ============================================================================
-- NONCES TABLE - Add unique constraint + indexes for auth
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.nonces') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.nonces'::regclass
         AND conname = 'nonces_wallet_nonce_unique'
     )
     AND NOT EXISTS (
       SELECT wallet, nonce
       FROM public.nonces
       GROUP BY wallet, nonce
       HAVING COUNT(*) > 1
     ) THEN
    ALTER TABLE public.nonces
      ADD CONSTRAINT nonces_wallet_nonce_unique UNIQUE (wallet, nonce);
  END IF;
END $$;

-- Compound index for fast nonce lookup
CREATE INDEX IF NOT EXISTS idx_nonces_wallet_used 
  ON nonces(wallet, used, created_at DESC);

-- ============================================================================
-- ORDERS TABLE - Add foreign key to order_items
-- ============================================================================

-- Ensure order_items properly references orders
DO $$
BEGIN
  IF to_regclass('public.order_items') IS NOT NULL
     AND to_regclass('public.orders') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.order_items'::regclass
         AND conname = 'fk_order_items_orders'
     ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id)
      REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- ARTIST_SHARES TABLE - Add constraints
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.artist_shares') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conrelid = 'public.artist_shares'::regclass
         AND conname = 'artist_shares_artist_id_token_unique'
     )
     AND NOT EXISTS (
       SELECT artist_id, token_address
       FROM public.artist_shares
       GROUP BY artist_id, token_address
       HAVING COUNT(*) > 1
     ) THEN
    ALTER TABLE public.artist_shares
      ADD CONSTRAINT artist_shares_artist_id_token_unique
      UNIQUE (artist_id, token_address);
  END IF;
END $$;

-- ============================================================================
-- SUBSCRIPTIONS TABLE - Add constraints
-- ============================================================================

-- The subscriptions table already defines a uniqueness guarantee in the base
-- schema (`UNIQUE (artist_id, subscriber_wallet)`). Keep a supporting lookup
-- index without trying to add an invalid duplicate constraint.
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber_artist_lookup
  ON public.subscriptions(subscriber_wallet, artist_id);

-- ============================================================================
-- DROPS TABLE - Add constraints
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.drops') IS NOT NULL
     AND NOT EXISTS (
       SELECT artist_id, contract_address
       FROM public.drops
       WHERE contract_address IS NOT NULL
       GROUP BY artist_id, contract_address
       HAVING COUNT(*) > 1
     ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_drops_artist_contract_unique
      ON public.drops(artist_id, contract_address)
      WHERE contract_address IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- PRODUCTS TABLE - Add constraints
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.products') IS NOT NULL
     AND NOT EXISTS (
       SELECT creator_wallet, lower(name)
       FROM public.products
       WHERE creator_wallet IS NOT NULL
         AND name IS NOT NULL
       GROUP BY creator_wallet, lower(name)
       HAVING COUNT(*) > 1
     ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_products_creator_wallet_name_unique
      ON public.products(creator_wallet, lower(name));
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check constraints are working
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.constraint_column_usage 
-- WHERE table_name IN ('artists', 'orders', 'nonces');

-- Verify unique constraints prevent duplicates
-- INSERT INTO artists (wallet, name) VALUES ('0xtest', 'Test') 
--   ON CONFLICT (wallet) DO NOTHING;

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
-- These constraints improve query performance by:
-- 1. Preventing duplicate artists for same wallet
-- 2. Preventing double-charging for same transaction
-- 3. Preventing authentication token reuse attacks
-- 4. Enabling unique indexes for fast lookups
