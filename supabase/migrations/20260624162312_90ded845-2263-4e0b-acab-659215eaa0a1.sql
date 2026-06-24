
-- Change report submission reward from 10 to 30 points
CREATE OR REPLACE FUNCTION public.on_report_created_award()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.award_points(NEW.user_id, NEW.id, 'report_created', 30);
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill: bump existing report_created events from 10 -> 30
WITH bumped AS (
  UPDATE public.reward_events
  SET points = 30
  WHERE kind = 'report_created' AND points = 10
  RETURNING user_id
), agg AS (
  SELECT user_id, COUNT(*)::int * 20 AS delta FROM bumped GROUP BY user_id
)
UPDATE public.profiles p
SET points = COALESCE(p.points, 0) + a.delta
FROM agg a
WHERE p.id = a.user_id;

-- Also update the reward-event notification title amount (uses NEW.points dynamically, no change needed)
