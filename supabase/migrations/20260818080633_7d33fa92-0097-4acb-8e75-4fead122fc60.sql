CREATE TABLE public.investment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'chart',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_types TO authenticated;
GRANT ALL ON public.investment_types TO service_role;
ALTER TABLE public.investment_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own investment types" ON public.investment_types FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.investment_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  value_change numeric NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_contributions TO authenticated;
GRANT ALL ON public.investment_contributions TO service_role;
ALTER TABLE public.investment_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own investment contributions" ON public.investment_contributions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_investment_contributions_investment ON public.investment_contributions(investment_id);