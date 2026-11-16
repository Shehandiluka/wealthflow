-- Schema drift fix: these columns existed on the live Lovable Cloud database
-- but were never captured into a migration file, so a fresh `supabase db push`
-- doesn't create them. Discovered when restoring a data backup that referenced
-- them. Safe to run on a project that already has them too (IF NOT EXISTS).

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS interest_kind text,
  ADD COLUMN IF NOT EXISTS interest_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_period text,
  ADD COLUMN IF NOT EXISTS interest_paid numeric NOT NULL DEFAULT 0;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS investment_id uuid REFERENCES public.investments(id) ON DELETE SET NULL;
