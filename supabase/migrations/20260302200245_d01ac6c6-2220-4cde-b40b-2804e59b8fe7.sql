
-- Create receipts storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false);

-- Allow authenticated users to upload receipts
CREATE POLICY "Users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to read their own receipts
CREATE POLICY "Users can read own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
