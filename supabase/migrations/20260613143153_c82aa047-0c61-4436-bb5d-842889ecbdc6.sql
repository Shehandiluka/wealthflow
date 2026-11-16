
-- SMS imports table
CREATE TABLE public.sms_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  content_hash TEXT NOT NULL,
  parsed_amount NUMERIC,
  parsed_type TEXT,
  parsed_account_ref TEXT,
  parsed_balance NUMERIC,
  parsed_date TIMESTAMPTZ,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_hash)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_imports TO authenticated;
GRANT ALL ON public.sms_imports TO service_role;

ALTER TABLE public.sms_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sms_imports" ON public.sms_imports
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sms_imports" ON public.sms_imports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sms_imports" ON public.sms_imports
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sms_imports" ON public.sms_imports
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX sms_imports_user_received_idx
  ON public.sms_imports (user_id, received_at DESC);

-- SMS API keys table (stores hashed key + a short prefix for display)
CREATE TABLE public.sms_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Apple Shortcut',
  default_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_api_keys TO authenticated;
GRANT ALL ON public.sms_api_keys TO service_role;

ALTER TABLE public.sms_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sms_api_keys" ON public.sms_api_keys
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own sms_api_keys" ON public.sms_api_keys
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sms_api_keys" ON public.sms_api_keys
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own sms_api_keys" ON public.sms_api_keys
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
