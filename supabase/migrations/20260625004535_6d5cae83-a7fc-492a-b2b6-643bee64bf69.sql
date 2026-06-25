
CREATE POLICY "Authenticated users can view report images"
  ON public.report_images FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view report-images files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'report-images');
