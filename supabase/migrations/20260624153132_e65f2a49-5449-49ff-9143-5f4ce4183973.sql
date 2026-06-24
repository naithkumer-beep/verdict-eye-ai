
-- 1. Points balance on profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

-- 2. Reward events ledger
CREATE TABLE IF NOT EXISTS public.reward_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('report_created','report_resolved')),
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, report_id, kind)
);

GRANT SELECT ON public.reward_events TO authenticated;
GRANT ALL ON public.reward_events TO service_role;

ALTER TABLE public.reward_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reward events"
  ON public.reward_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- 3. Award function + triggers (definer so it can update profiles regardless of caller RLS)
CREATE OR REPLACE FUNCTION public.award_points(
  _user_id uuid, _report_id uuid, _kind text, _points integer
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.reward_events (user_id, report_id, kind, points)
  VALUES (_user_id, _report_id, _kind, _points)
  ON CONFLICT (user_id, report_id, kind) DO NOTHING;
  IF FOUND THEN
    UPDATE public.profiles SET points = COALESCE(points, 0) + _points WHERE id = _user_id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_points(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_report_created_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.award_points(NEW.user_id, NEW.id, 'report_created', 10);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.on_report_created_award() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_report_resolved_award()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') AND NEW.user_id IS NOT NULL THEN
    PERFORM public.award_points(NEW.user_id, NEW.id, 'report_resolved', 50);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.on_report_resolved_award() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reward_report_created ON public.reports;
CREATE TRIGGER trg_reward_report_created
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.on_report_created_award();

DROP TRIGGER IF EXISTS trg_reward_report_resolved ON public.reports;
CREATE TRIGGER trg_reward_report_resolved
  AFTER UPDATE OF status ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.on_report_resolved_award();

-- Backfill points for existing reports (only ones that haven't been awarded yet)
INSERT INTO public.reward_events (user_id, report_id, kind, points)
SELECT user_id, id, 'report_created', 10 FROM public.reports
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.reward_events (user_id, report_id, kind, points)
SELECT user_id, id, 'report_resolved', 50 FROM public.reports
WHERE user_id IS NOT NULL AND status = 'resolved'
ON CONFLICT DO NOTHING;

-- Recompute profile.points totals
UPDATE public.profiles p
SET points = COALESCE(s.total, 0)
FROM (
  SELECT user_id, SUM(points) AS total FROM public.reward_events GROUP BY user_id
) s
WHERE p.id = s.user_id;
