-- Tracks which budget/month/threshold combos have already been push-notified,
-- so crossing 80% doesn't re-notify every single day for the rest of the
-- month — only once per threshold, per budget, per month.
CREATE TABLE public.budget_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  month text NOT NULL, -- 'YYYY-MM'
  threshold text NOT NULL, -- '80' or '100'
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (budget_id, month, threshold)
);

ALTER TABLE public.budget_alert_log ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — only the edge function (service role) touches this table.
