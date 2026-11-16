-- Optional rollover: if enabled, last month's unused budget (if any) carries
-- forward and adds to this month's effective limit for that category.
ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS rollover boolean NOT NULL DEFAULT false;
