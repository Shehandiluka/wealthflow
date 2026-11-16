CREATE POLICY "Users can update own payments"
ON public.pay_later_payments
FOR UPDATE
USING (auth.uid() = user_id);