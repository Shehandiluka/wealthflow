
CREATE POLICY "Authenticated users can insert exchange rates"
ON public.exchange_rates
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update exchange rates"
ON public.exchange_rates
FOR UPDATE TO authenticated
USING (true);
