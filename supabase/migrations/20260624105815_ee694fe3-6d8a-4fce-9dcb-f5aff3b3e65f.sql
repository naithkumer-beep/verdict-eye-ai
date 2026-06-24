
-- Restrict trigger helpers from being called by API roles
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- has_role / get_user_role must remain executable by authenticated (RLS uses them)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;

-- Storage policies for the report-images bucket
CREATE POLICY "Authenticated users can upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'report-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Authenticated users can read own report images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public can read report images"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'report-images');

CREATE POLICY "Users can delete own images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'report-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
