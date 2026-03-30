-- Migration: Add subscription expiry tracking
-- Description: Updates subscriptions to support 30-day expiring tokens with renewal capability

-- Add subscription_expiry column to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN expiry_time BIGINT DEFAULT 0,
ADD COLUMN min_subscription_fee NUMERIC DEFAULT 0.001;

-- Index for fast expiry lookups
CREATE INDEX idx_subscriptions_expiry ON subscriptions(expiry_time);
CREATE INDEX idx_subscriptions_artist_expiry ON subscriptions(artist_wallet, expiry_time);

-- Helper function to check if subscription is active
CREATE OR REPLACE FUNCTION is_subscription_active(artist_wallet TEXT, subscriber_wallet TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE subscriptions.artist_wallet = artist_wallet
    AND subscriptions.subscriber_wallet = subscriber_wallet
    AND subscriptions.expiry_time > EXTRACT(EPOCH FROM NOW())::BIGINT
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to get subscription time remaining (in seconds)
CREATE OR REPLACE FUNCTION get_subscription_time_remaining(artist_wallet TEXT, subscriber_wallet TEXT)
RETURNS BIGINT AS $$
BEGIN
  RETURN (
    SELECT MAX(0) FROM (
      SELECT expiry_time - EXTRACT(EPOCH FROM NOW())::BIGINT as remaining
      FROM subscriptions
      WHERE subscriptions.artist_wallet = artist_wallet
      AND subscriptions.subscriber_wallet = subscriber_wallet
    ) sub
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to renew subscription (called when subscriber re-pays)
CREATE OR REPLACE FUNCTION renew_subscription(
  artist_wallet TEXT,
  subscriber_wallet TEXT,
  new_amount NUMERIC,
  new_expiry BIGINT
)
RETURNS VOID AS $$
BEGIN
  UPDATE subscriptions
  SET 
    amount = new_amount,
    expiry_time = new_expiry,
    updated_at = NOW()
  WHERE subscriptions.artist_wallet = artist_wallet
  AND subscriptions.subscriber_wallet = subscriber_wallet;
END;
$$ LANGUAGE plpgsql;
