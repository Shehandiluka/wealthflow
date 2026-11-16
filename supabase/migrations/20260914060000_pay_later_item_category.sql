-- Purchases on a Pay Later tab can now be categorised, same as any other
-- expense, so they can be shown alongside real transactions and broken
-- down by category later.
ALTER TABLE public.pay_later_items
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'Other';
