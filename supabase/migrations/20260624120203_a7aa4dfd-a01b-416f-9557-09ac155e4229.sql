
-- 1) Promote naithkumer@gmail.com to admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('357f8144-dfe7-47a7-a68a-0ec5f0b13996', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) All authenticated users can view all non-deleted reports (community visibility)
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Moderators and admins can view all reports" ON public.reports;
CREATE POLICY "Authenticated users can view all reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

-- 3) Yangon department auto-assignment by category
CREATE OR REPLACE FUNCTION public.assign_yangon_department()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.department IS NULL OR NEW.department = '' THEN
    NEW.department := CASE NEW.category
      WHEN 'road_damage'         THEN 'YCDC — Roads & Bridges Department'
      WHEN 'garbage'             THEN 'YCDC — Pollution Control & Cleansing Department'
      WHEN 'street_light'        THEN 'YESC — Yangon Electricity Supply Corporation'
      WHEN 'water_drainage'      THEN 'YCDC — Engineering Department (Water & Sanitation)'
      WHEN 'public_safety'       THEN 'Myanmar Police Force — Yangon Region'
      WHEN 'vandalism'           THEN 'YCDC — Public Relations & Information Department'
      WHEN 'building_hazard'     THEN 'YCDC — City Planning & Land Administration Department'
      ELSE 'YCDC — General Administration'
    END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assign_yangon_department ON public.reports;
CREATE TRIGGER trg_assign_yangon_department
  BEFORE INSERT OR UPDATE OF category ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.assign_yangon_department();

-- Backfill departments for existing reports
UPDATE public.reports SET category = category WHERE department IS NULL OR department = '';

-- 4) Allow admins to view & manage user_roles for the user management page
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());

-- 5) Admins can view all profiles for the user management page
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
