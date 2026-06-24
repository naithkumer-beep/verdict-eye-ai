
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

    INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, details)
    VALUES (NULL, 'report.auto_escalate', 'report', r.id,
      jsonb_build_object('from', r.priority, 'reason','deadline_passed'));
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
