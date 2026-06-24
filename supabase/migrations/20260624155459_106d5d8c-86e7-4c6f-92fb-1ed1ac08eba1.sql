-- Allow all authenticated users to view report images metadata
CREATE POLICY "All authenticated users can view report images"
  ON public.report_images FOR SELECT TO authenticated
  USING (true);

-- Allow all authenticated users to read objects in the report-images storage bucket
CREATE POLICY "Authenticated users can read report-images bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-images');
