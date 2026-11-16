
-- Create line items table for individual purchases under a store tab
CREATE TABLE public.pay_later_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_later_id UUID NOT NULL REFERENCES public.pay_later(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL,
  purchased_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pay_later_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pay later items" ON public.pay_later_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pay later items" ON public.pay_later_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pay later items" ON public.pay_later_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pay later items" ON public.pay_later_items FOR DELETE USING (auth.uid() = user_id);

-- Create payments table for partial payments against a store tab
CREATE TABLE public.pay_later_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_later_id UUID NOT NULL REFERENCES public.pay_later(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  paid_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pay_later_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON public.pay_later_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.pay_later_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON public.pay_later_payments FOR DELETE USING (auth.uid() = user_id);
