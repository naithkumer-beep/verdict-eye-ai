-- Skip reward awards for users with admin role
CREATE OR REPLACE FUNCTION public.award_points(_user_id uuid, _report_id uuid, _kind text, _points integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  -- Admins do not earn reward points
  IF public.has_role(_user_id, 'admin'::app_role) THEN
    RETURN;
  END IF;

  INSERT INTO public.reward_events (user_id, report_id, kind, points)
  VALUES (_user_id, _report_id, _kind, _points)
  ON CONFLICT (user_id, report_id, kind) DO NOTHING;
  IF FOUND THEN
    UPDATE public.profiles SET points = COALESCE(points, 0) + _points WHERE id = _user_id;
  END IF;
END;
$function$;

-- Ensure the on-insert award trigger is actually attached to reports
DROP TRIGGER IF EXISTS trg_reports_award_on_create ON public.reports;
CREATE TRIGGER trg_reports_award_on_create
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.on_report_created_award();

-- Ensure resolved-award trigger is attached
DROP TRIGGER IF EXISTS trg_reports_award_on_resolved ON public.reports;
CREATE TRIGGER trg_reports_award_on_resolved
AFTER UPDATE OF status ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.on_report_resolved_award();

-- Ensure notification trigger on reward_events is attached
DROP TRIGGER IF EXISTS trg_reward_events_notify ON public.reward_events;
CREATE TRIGGER trg_reward_events_notify
AFTER INSERT ON public.reward_events
FOR EACH ROW EXECUTE FUNCTION public.notify_reward_event();