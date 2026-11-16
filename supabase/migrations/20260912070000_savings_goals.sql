-- Savings goals: a target amount to reach by an optional date (e.g. "Rs. 1,000,000
-- for land tax by December"), tracked with a running current_amount and a history
-- of individual contributions, similar in shape to how investments work.

CREATE TABLE public.savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other', -- tax | land | vehicle | emergency | travel | education | other
  target_amount numeric NOT NULL,
  current_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'LKR',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  target_date date, -- nullable: an open-ended goal has no pace/deadline tracking
  linked_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  notes text,
  is_pinned boolean NOT NULL DEFAULT false, -- featured at the top of the dashboard widget
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.savings_goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_savings_goal_contributions_goal ON public.savings_goal_contributions(goal_id);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own savings_goals" ON public.savings_goals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own savings_goal_contributions" ON public.savings_goal_contributions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_goal_contributions TO authenticated;

CREATE TRIGGER update_savings_goals_updated_at
  BEFORE UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomically increments a goal's saved-so-far total. Mirrors update_debt_remaining's
-- pattern (SECURITY DEFINER, floors at 0).
CREATE OR REPLACE FUNCTION public.update_goal_progress(_goal_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.savings_goals
  SET current_amount = GREATEST(0, current_amount + _amount)
  WHERE id = _goal_id;
END;
$$;
