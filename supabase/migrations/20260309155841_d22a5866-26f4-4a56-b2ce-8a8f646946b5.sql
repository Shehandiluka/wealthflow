
ALTER TABLE public.transactions
  ADD COLUMN exchange_rate numeric DEFAULT NULL,
  ADD COLUMN transfer_charge numeric DEFAULT 0;
