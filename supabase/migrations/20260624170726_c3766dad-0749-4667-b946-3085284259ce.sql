
-- Tighten profiles read
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

-- Tighten report_feedback read
DROP POLICY IF EXISTS "Anyone can read feedback" ON public.report_feedback;
CREATE POLICY "Owner or staff can read feedback" ON public.report_feedback
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

-- Remove broad report_images read; existing owner + moderator policies cover access
DROP POLICY IF EXISTS "All authenticated users can view report images" ON public.report_images;

-- Remove broad storage bucket read; folder-scoped policy remains
DROP POLICY IF EXISTS "Authenticated users can read report-images bucket" ON storage.objects;
-- Allow moderators/admins to read all report-images
CREATE POLICY "Moderators and admins can read report-images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'report-images'
    AND (public.has_role(auth.uid(), 'moderator'::app_role)
         OR public.has_role(auth.uid(), 'admin'::app_role))
  );

-- Remove permissive ALL policy on user_roles; replace with explicit per-cmd admin policies.
-- The guard_user_roles_writes trigger also enforces admin-only writes.
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Tighten work_order_activity read
DROP POLICY IF EXISTS "Authenticated can read activity" ON public.work_order_activity;
CREATE POLICY "Involved users and staff can read activity"
  ON public.work_order_activity FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = work_order_activity.report_id AND r.user_id = auth.uid()
    )
  );

-- Fix mutable search_path on sla_deadline
ALTER FUNCTION public.sla_deadline(public.report_priority, timestamptz) SET search_path = public;

-- Restrict unused SECURITY DEFINER function from signed-in users
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon, authenticated;
