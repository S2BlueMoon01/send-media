# Cleanup Signals Edge Function

This edge function automatically deletes expired WebRTC signaling data from the `webrtc_signals` table.

## Purpose

Signals are set to expire after 5 minutes (defined in the database schema). This function runs periodically to clean up expired records, preventing the database from accumulating stale data.

## Deployment

1. Deploy the edge function to Supabase:
   ```bash
   supabase functions deploy cleanup-signals
   ```

2. Set up the required environment variables in your Supabase project:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your service role key (has permission to delete rows)

## Scheduling

To run this function every 5 minutes, set up a cron job in your Supabase project:

### Option 1: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to Database → Extensions
3. Enable the `pg_cron` extension
4. Go to SQL Editor and run:

```sql
-- Schedule cleanup function to run every 5 minutes
SELECT cron.schedule(
  'cleanup-expired-signals',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-signals',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    )
  );
  $$
);
```

Replace `YOUR_PROJECT_REF` with your actual Supabase project reference.

### Option 2: Using Supabase CLI

Create a migration file:

```bash
supabase migration new schedule_cleanup_signals
```

Add the cron schedule SQL to the migration file, then apply:

```bash
supabase db push
```

## Manual Testing

You can manually invoke the function to test it:

```bash
curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-signals' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json'
```

## Response Format

Success response:
```json
{
  "success": true,
  "deletedCount": 5
}
```

Error response:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Requirements

Validates: Requirement 2.9 - "WHEN signal data được lưu vào Supabase THEN hệ thống SHALL tự động xóa data sau 5 phút hoặc khi connection thành công"
