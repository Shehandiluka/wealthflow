-- Push subscriptions for browser/PWA Web Push notifications (e.g. debt due-date reminders).
-- One row per device/browser the user has enabled notifications on.
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own push_subscriptions" ON public.push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own push_subscriptions" ON public.push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own push_subscriptions" ON public.push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);

-- Tracks the last date we sent a reminder for a given debt, so the daily cron run
-- doesn't send the same "due in 3 days" push over and over throughout that day.
CREATE TABLE public.debt_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id uuid NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  reminded_on date NOT NULL,
  UNIQUE (debt_id, reminded_on)
);

ALTER TABLE public.debt_reminder_log ENABLE ROW LEVEL SECURITY;
-- No user-facing policies needed — only the edge function (service role) touches this table.
