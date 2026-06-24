
-- Departments catalogue
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_my text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO anon, authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.departments (code, name_en, name_my) VALUES
  ('roads',       'Roads Department',              'လမ်းပန်းဌာန'),
  ('electricity', 'Electricity Department',        'လျှပ်စစ်ဌာန'),
  ('water',       'Water Department',              'ရေဝန်ဆောင်မှုဌာန'),
  ('sanitation',  'Sanitation Department',         'သန့်ရှင်းရေးဌာန'),
  ('parks',       'Parks Department',              'ပန်းခြံဌာန'),
  ('safety',      'Public Safety Department',      'အများပြည်သူလုံခြုံရေးဌာန'),
  ('it',          'IT Department',                 'အိုင်တီဌာန'),
  ('emergency',   'Emergency Response Department', 'အရေးပေါ်တုံ့ပြန်ရေးဌာန');

-- Priority enum + SLA helper
CREATE TYPE public.report_priority AS ENUM ('critical','high','medium','low');

CREATE OR REPLACE FUNCTION public.sla_deadline(p public.report_priority, base timestamptz)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT base + CASE p
    WHEN 'critical' THEN interval '24 hours'
    WHEN 'high'     THEN interval '3 days'
    WHEN 'medium'   THEN interval '7 days'
    WHEN 'low'      THEN interval '14 days'
  END
$$;

-- Work-order sequence
CREATE SEQUENCE IF NOT EXISTS public.work_order_seq START 1024;

-- Reports: add new operational columns
ALTER TABLE public.reports
  ADD COLUMN priority public.report_priority,
  ADD COLUMN department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN deadline_at timestamptz,
  ADD COLUMN work_order_no text UNIQUE,
  ADD COLUMN resolved_at timestamptz;

-- Auto-set deadline + work-order + resolved_at via trigger
CREATE OR REPLACE FUNCTION public.reports_ops_autoset()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Auto deadline whenever priority changes / is first set
  IF NEW.priority IS NOT NULL AND (TG_OP='INSERT' OR NEW.priority IS DISTINCT FROM OLD.priority) THEN
    NEW.deadline_at := public.sla_deadline(NEW.priority, now());
  END IF;
  -- Auto work-order on first verify
  IF NEW.work_order_no IS NULL AND NEW.status IN ('verified','resolved') THEN
    NEW.work_order_no := 'WO-' || lpad(nextval('public.work_order_seq')::text, 4, '0');
  END IF;
  -- Stamp resolved_at on resolution
  IF NEW.status = 'resolved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.resolved_at := now();
  ELSIF NEW.status <> 'resolved' THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reports_ops_autoset ON public.reports;
CREATE TRIGGER reports_ops_autoset BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_ops_autoset();

-- Work order activity log (comments/mentions/attachments per WO)
CREATE TABLE public.work_order_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('comment','assignment','priority','status','attachment','escalation')),
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.work_order_activity TO authenticated;
GRANT ALL ON public.work_order_activity TO service_role;
ALTER TABLE public.work_order_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read activity" ON public.work_order_activity
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can add own activity" ON public.work_order_activity
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage activity" ON public.work_order_activity
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Citizen feedback after resolution
CREATE TABLE public.report_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL UNIQUE REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.report_feedback TO authenticated;
GRANT ALL ON public.report_feedback TO service_role;
ALTER TABLE public.report_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read feedback" ON public.report_feedback
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Uploader can leave feedback on own resolved report"
  ON public.report_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.reports r
    WHERE r.id = report_id AND r.user_id = auth.uid() AND r.status = 'resolved'
  ));
CREATE POLICY "Uploader can update own feedback" ON public.report_feedback
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
