-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup function to run every 5 minutes
-- Note: This assumes the edge function is deployed at the standard Supabase Functions URL
-- You'll need to replace YOUR_PROJECT_REF with your actual project reference
-- and configure the service role key in your Supabase project settings

-- Alternative approach: Use a database function for cleanup instead of edge function
-- This is more reliable and doesn't require external HTTP calls

-- Create a database function to clean up expired signals
CREATE OR REPLACE FUNCTION cleanup_expired_signals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM webrtc_signals
  WHERE expires_at < NOW();
END;
$$;

-- Schedule the cleanup function to run every 5 minutes
SELECT cron.schedule(
  'cleanup-expired-signals',
  '*/5 * * * *',  -- Every 5 minutes (cron format: minute hour day month weekday)
  $$SELECT cleanup_expired_signals();$$
);

-- Optional: Also clean up completed signals that are older than 1 hour
-- This provides an additional cleanup layer for signals that were marked as completed
SELECT cron.schedule(
  'cleanup-completed-signals',
  '0 * * * *',  -- Every hour
  $$
  DELETE FROM webrtc_signals
  WHERE completed = true
    AND created_at < NOW() - INTERVAL '1 hour';
  $$
);
