
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL;
ALTER TABLE public.recurring_transactions ADD COLUMN IF NOT EXISTS debt_id uuid REFERENCES public.debts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id ON public.transactions(debt_id);
CREATE INDEX IF NOT EXISTS idx_recurring_debt_id ON public.recurring_transactions(debt_id);

CREATE OR REPLACE FUNCTION public.update_debt_remaining(_debt_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.debts
  SET remaining_amount = GREATEST(0, remaining_amount + _amount)
  WHERE id = _debt_id;
END;
$$;
