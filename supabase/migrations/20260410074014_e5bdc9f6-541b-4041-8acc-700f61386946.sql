
-- Lending contacts
CREATE TABLE public.lending_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  person_name TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lending_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lending contacts" ON public.lending_contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lending contacts" ON public.lending_contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lending contacts" ON public.lending_contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lending contacts" ON public.lending_contacts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_lending_contacts_updated_at BEFORE UPDATE ON public.lending_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lending transactions
CREATE TABLE public.lending_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.lending_contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'lent', 'borrowed', 'repaid_to_me', 'repaid_by_me'
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'LKR',
  exchange_rate NUMERIC DEFAULT NULL,
  base_amount NUMERIC DEFAULT NULL, -- amount in original lending currency for balance calc
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lending_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lending transactions" ON public.lending_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lending transactions" ON public.lending_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lending transactions" ON public.lending_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lending transactions" ON public.lending_transactions FOR DELETE USING (auth.uid() = user_id);
