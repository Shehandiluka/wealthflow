
CREATE TABLE public.pay_later (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  person_or_store TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'LKR',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.pay_later ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pay later" ON public.pay_later FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pay later" ON public.pay_later FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pay later" ON public.pay_later FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pay later" ON public.pay_later FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_pay_later_updated_at
BEFORE UPDATE ON public.pay_later
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
