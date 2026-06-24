
-- 1. Email send idempotency
CREATE TABLE IF NOT EXISTS public.report_resolved_emails (
  report_id uuid PRIMARY KEY REFERENCES public.reports(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id)
);

GRANT SELECT, INSERT ON public.report_resolved_emails TO authenticated;
GRANT ALL ON public.report_resolved_emails TO service_role;

ALTER TABLE public.report_resolved_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read resolved-email ledger"
  ON public.report_resolved_emails FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins record resolved-email sends"
  ON public.report_resolved_emails FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Auto-create a reward notification whenever a reward_event row is inserted
CREATE OR REPLACE FUNCTION public.notify_reward_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
  title_txt text;
  msg_txt text;
  link_txt text;
BEGIN
  IF NEW.kind = 'report_resolved' THEN
    title_txt := '🏆 +' || NEW.points || ' points · Report resolved';
    msg_txt := 'You earned ' || NEW.points || ' points because your report was resolved.';
  ELSIF NEW.kind = 'report_created' THEN
    title_txt := '✨ +' || NEW.points || ' points · Report submitted';
    msg_txt := 'You earned ' || NEW.points || ' points for submitting a verified report.';
  ELSE
    title_txt := '+' || NEW.points || ' points earned';
    msg_txt := 'You earned ' || NEW.points || ' reward points.';
  END IF;

  link_txt := CASE WHEN NEW.report_id IS NOT NULL THEN '/reports/' || NEW.report_id::text ELSE '/rewards' END;

  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (
    NEW.user_id, 'reward_earned', title_txt, msg_txt, link_txt,
    jsonb_build_object('points', NEW.points, 'kind', NEW.kind, 'report_id', NEW.report_id)
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_reward_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_reward_event ON public.reward_events;
CREATE TRIGGER trg_notify_reward_event
  AFTER INSERT ON public.reward_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_reward_event();

-- 3. Enable Realtime for notifications + reward_events (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.reward_events;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.reward_events REPLICA IDENTITY FULL;
