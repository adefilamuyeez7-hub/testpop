-- ============================================================
-- Migration 008: Artist Applications System
-- Adds the artist_applications table and waitlist table.
-- The whitelist, artists, and admin_users tables already
-- exist from earlier migrations (001–007).
-- ============================================================

-- ── Waitlist (for early-access landing page) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist (
  id             UUID                     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT                     NOT NULL UNIQUE,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waitlist_wallet ON public.waitlist(wallet_address);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_public_insert" ON public.waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "waitlist_public_select" ON public.waitlist
  FOR SELECT USING (true);

-- ── Artist Applications ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.artist_applications (
  id             UUID                     NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT                     NOT NULL UNIQUE,
  email          TEXT                     NOT NULL,
  artist_name    TEXT                     NOT NULL,
  bio            TEXT,
  art_types      TEXT[]                   NOT NULL DEFAULT ARRAY[]::TEXT[],
  twitter_url    TEXT,
  instagram_url  TEXT,
  website_url    TEXT,
  portfolio_url  TEXT,
  terms_agreed   BOOLEAN                  NOT NULL DEFAULT false,
  status         TEXT                     NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes    TEXT,
  submitted_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMP WITH TIME ZONE,
  reviewed_by    TEXT,
  created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_artist_applications_wallet
  ON public.artist_applications(wallet_address);

CREATE INDEX IF NOT EXISTS idx_artist_applications_status
  ON public.artist_applications(status);

CREATE INDEX IF NOT EXISTS idx_artist_applications_submitted
  ON public.artist_applications(submitted_at DESC);

-- RLS
ALTER TABLE public.artist_applications ENABLE ROW LEVEL SECURITY;

-- Anyone (including unauthenticated users) can submit
CREATE POLICY "applications_public_insert" ON public.artist_applications
  FOR INSERT WITH CHECK (true);

-- Anyone can read (admin panel uses anon key for now)
CREATE POLICY "applications_public_select" ON public.artist_applications
  FOR SELECT USING (true);

-- Admins can update (approve / reject)
CREATE POLICY "applications_admin_update" ON public.artist_applications
  FOR UPDATE USING (true);

-- ── updated_at trigger (reuse function if it already exists) ──────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_artist_applications_updated_at'
  ) THEN
    CREATE TRIGGER update_artist_applications_updated_at
      BEFORE UPDATE ON public.artist_applications
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_waitlist_updated_at'
  ) THEN
    CREATE TRIGGER update_waitlist_updated_at
      BEFORE UPDATE ON public.waitlist
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END;
$$;
