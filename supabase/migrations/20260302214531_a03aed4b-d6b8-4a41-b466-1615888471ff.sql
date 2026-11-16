
CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency text NOT NULL DEFAULT 'LKR',
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Exchange rates are publicly readable"
  ON public.exchange_rates FOR SELECT
  USING (true);
