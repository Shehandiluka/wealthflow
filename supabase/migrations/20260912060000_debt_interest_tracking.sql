-- Interest payments must NOT reduce the loan principal — only principal payments
-- should. This column tags a debt-linked transaction as one or the other, so the
-- balance-update logic in the app knows which debts RPC (if any) to call.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_interest_payment boolean NOT NULL DEFAULT false;

-- Atomically increments a debt's running interest-paid total. Mirrors
-- update_debt_remaining's pattern (SECURITY DEFINER, floors at 0) so RLS on
-- debts doesn't need a broader UPDATE policy just for this one field.
CREATE OR REPLACE FUNCTION public.update_debt_interest_paid(_debt_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.debts
  SET interest_paid = GREATEST(0, interest_paid + _amount)
  WHERE id = _debt_id;
END;
$$;
