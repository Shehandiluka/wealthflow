
-- Function to update account balance atomically
CREATE OR REPLACE FUNCTION public.update_account_balance(_account_id UUID, _amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.accounts
  SET balance = balance + _amount
  WHERE id = _account_id;
END;
$$;
