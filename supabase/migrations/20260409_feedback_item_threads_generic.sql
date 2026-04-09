-- ============================================================================
-- Migration: 20260409_feedback_item_threads_generic.sql
-- Purpose: Allow the shared feedback inbox to support drops and releases in
--          addition to products by making product_id optional.
-- ============================================================================

ALTER TABLE public.product_feedback_threads
  ALTER COLUMN product_id DROP NOT NULL;
