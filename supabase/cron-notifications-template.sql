-- Schedules the loan due-date and budget-limit push notification jobs. NOT
-- applied automatically by migrate.bat or `supabase db push` (it's not in
-- migrations/) because it needs YOUR actual CRON_SECRET value — a wrong
-- value here fails silently forever, so it's safer as a manual step.
--
-- How to run this:
--   1. If you haven't already, set a CRON_SECRET:
--        npx supabase secrets set CRON_SECRET=<any random string>
--      (openssl rand -hex 24 generates a good one, or just make something up)
--   2. Replace YOUR_CRON_SECRET_HERE below with that exact same value.
--   3. Paste this whole file into the Supabase Dashboard → SQL Editor → Run.
--
-- Safe to re-run — cron.schedule with the same job name replaces the old one.

SELECT cron.schedule(
  'send-debt-reminders-daily',
  '0 9 * * *',  -- 9am UTC daily — adjust the hour if you want a different local time
  $$
  SELECT net.http_post(
    url := 'https://ontlcjvmztiprmzbtcmh.supabase.co/functions/v1/send-debt-reminders',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET_HERE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Budget alerts (80%/100% of a category's monthly limit) — same secret, same idea.
SELECT cron.schedule(
  'send-budget-alerts-daily',
  '0 18 * * *',  -- 6pm UTC daily — after most of a day's spending is likely logged
  $$
  SELECT net.http_post(
    url := 'https://ontlcjvmztiprmzbtcmh.supabase.co/functions/v1/send-budget-alerts',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "YOUR_CRON_SECRET_HERE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
