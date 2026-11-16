
-- Trips table
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  trip_currency TEXT NOT NULL DEFAULT 'USD',
  budget NUMERIC NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trips" ON public.trips FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trips" ON public.trips FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trips" ON public.trips FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trips" ON public.trips FOR DELETE USING (auth.uid() = user_id);

-- Planned expenses for trips
CREATE TABLE public.trip_planned_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  planned_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  day_number INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_planned_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trip expenses" ON public.trip_planned_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trip expenses" ON public.trip_planned_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trip expenses" ON public.trip_planned_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trip expenses" ON public.trip_planned_expenses FOR DELETE USING (auth.uid() = user_id);

-- Add trip_id to transactions
ALTER TABLE public.transactions ADD COLUMN trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL;

-- Triggers for updated_at
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trip_planned_expenses_updated_at BEFORE UPDATE ON public.trip_planned_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
