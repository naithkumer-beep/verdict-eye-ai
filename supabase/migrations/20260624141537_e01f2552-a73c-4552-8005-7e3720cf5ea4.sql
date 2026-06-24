
CREATE TABLE public.cost_estimates (
  category report_category PRIMARY KEY,
  estimated_cost_mmk numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cost_estimates TO authenticated;
GRANT ALL ON public.cost_estimates TO service_role;
ALTER TABLE public.cost_estimates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read costs" ON public.cost_estimates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage costs" ON public.cost_estimates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

INSERT INTO public.cost_estimates(category, estimated_cost_mmk) VALUES
  ('road_damage', 850000),
  ('garbage', 120000),
  ('street_light', 240000),
  ('water_drainage', 650000),
  ('public_safety', 300000),
  ('vandalism', 180000),
  ('building_hazard', 1500000)
ON CONFLICT (category) DO NOTHING;

CREATE TABLE public.ai_predictions (
  kind text PRIMARY KEY,
  payload jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_predictions TO authenticated;
GRANT ALL ON public.ai_predictions TO service_role;
ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read predictions" ON public.ai_predictions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.escalate_overdue_reports()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN
    SELECT id, priority FROM public.reports
    WHERE status IN ('pending','analyzing','verified')
      AND deadline_at IS NOT NULL
      AND deadline_at < now()
      AND priority IS NOT NULL
      AND priority <> 'critical'
  LOOP
    UPDATE public.reports SET priority = CASE r.priority
      WHEN 'low' THEN 'medium'::report_priority
      WHEN 'medium' THEN 'high'::report_priority
      WHEN 'high' THEN 'critical'::report_priority
      ELSE r.priority END
    WHERE id = r.id;

    INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
    VALUES (NULL, 'auto_escalate', 'report', r.id,
      jsonb_build_object('from', r.priority, 'reason','deadline_passed'));
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
