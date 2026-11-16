-- None of these background functions were ever actually scheduled to run —
-- process-recurring and process-draft-reminders both existed as deployed
-- edge functions, but nothing was calling them on a timer. This is why
-- recurring transactions and draft reminders never fired on their own.
--
-- pg_cron and pg_net are already enabled (see the March 2026 migration).
--
-- The debt-reminder push notification cron is scheduled separately (see
-- supabase/cron-debt-reminders-template.sql) since it needs your own
-- CRON_SECRET value filled in by hand — a wrong value here would silently
-- fail forever, so it's deliberately not auto-applied.

-- Recurring transactions: check every day at 06:00 UTC for anything due.
SELECT cron.schedule(
  'process-recurring-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ontlcjvmztiprmzbtcmh.supabase.co/functions/v1/process-recurring',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_aXo3GC4FCat1t9sgPukkXw_h-7txO02"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Draft reminders: each user has their own cutoff time/timezone, so this
-- runs hourly to catch each of those promptly rather than once a day.
SELECT cron.schedule(
  'process-draft-reminders-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ontlcjvmztiprmzbtcmh.supabase.co/functions/v1/process-draft-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer sb_publishable_aXo3GC4FCat1t9sgPukkXw_h-7txO02"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
