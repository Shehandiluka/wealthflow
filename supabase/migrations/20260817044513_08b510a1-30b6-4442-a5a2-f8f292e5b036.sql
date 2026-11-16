ALTER TABLE public.sms_imports
  ADD COLUMN IF NOT EXISTS auto_post boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suggested_category text,
  ADD COLUMN IF NOT EXISTS suggested_account_id uuid;

CREATE TABLE IF NOT EXISTS public.draft_reminder_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  cutoff_dow integer NOT NULL DEFAULT 0,
  cutoff_time time NOT NULL DEFAULT '20:00',
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  auto_post boolean NOT NULL DEFAULT false,
  reminder_lead_hours integer NOT NULL DEFAULT 24,
  last_run_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_reminder_settings TO authenticated;
GRANT ALL ON public.draft_reminder_settings TO service_role;

ALTER TABLE public.draft_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own draft reminder settings"
  ON public.draft_reminder_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_draft_reminder_settings_updated_at
  BEFORE UPDATE ON public.draft_reminder_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();