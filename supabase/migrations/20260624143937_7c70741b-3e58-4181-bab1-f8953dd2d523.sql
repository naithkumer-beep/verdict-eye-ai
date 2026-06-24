
-- 1) Fix mutable search_path on queue helper functions + revoke client execute
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pg_catalog;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pg_catalog;

-- 2) Revoke EXECUTE from anon/authenticated/public on SECURITY DEFINER functions
--    that are not meant to be called directly by clients.
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.escalate_overdue_reports() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_status_admin_only() FROM PUBLIC, anon, authenticated;
-- has_role / get_user_role are used inside RLS policies and must remain callable
-- by authenticated; revoke from anon only.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;

-- 3) Defense in depth against privilege escalation on user_roles:
--    Block any INSERT/UPDATE/DELETE by an authenticated caller that is not an admin,
--    regardless of policy permutations. SECURITY DEFINER service-role inserts
--    (e.g. handle_new_user trigger) have auth.uid() = NULL and pass through.
CREATE OR REPLACE FUNCTION public.guard_user_roles_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  -- Service role / internal triggers (no JWT) are allowed; they are already
  -- gated by SECURITY DEFINER callers we control.
  IF caller IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT public.has_role(caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can modify user roles';
  END IF;

  -- An admin must not be able to revoke their own admin row (avoids lockouts/bypass).
  IF TG_OP = 'DELETE' AND OLD.user_id = caller AND OLD.role = 'admin'::app_role THEN
    RAISE EXCEPTION 'Admins cannot remove their own admin role';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_user_roles_writes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_user_roles_writes ON public.user_roles;
CREATE TRIGGER guard_user_roles_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_user_roles_writes();

-- 4) Hide profiles.email from other authenticated users via column-level privileges.
--    Keep row visibility (display_name/avatar shown in comments etc.) but restrict
--    the email column to the owner and admins through a SECURITY DEFINER accessor.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, avatar_url, bio, created_at, updated_at)
  ON public.profiles TO authenticated;
-- Owner + admin can read their own email row via standard SELECT path
-- by using a dedicated policy/grant: grant the email column only via a
-- security-definer accessor used by admin pages.
CREATE OR REPLACE FUNCTION public.get_profile_email(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT email
  FROM public.profiles
  WHERE id = _user_id
    AND (auth.uid() = _user_id OR public.has_role(auth.uid(), 'admin'::app_role))
$$;

REVOKE EXECUTE ON FUNCTION public.get_profile_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_email(uuid) TO authenticated;

-- 5) Remove anonymous public-read policy on the private report-images bucket.
DROP POLICY IF EXISTS "Public can read report images" ON storage.objects;
