
-- 1. Add geo coords to reports
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. Comments table
CREATE TABLE IF NOT EXISTS public.report_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_comments TO authenticated;
GRANT ALL ON public.report_comments TO service_role;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by authenticated users"
  ON public.report_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can post comments"
  ON public.report_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit own comments"
  ON public.report_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner or admin can delete comments"
  ON public.report_comments FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_report_comments_report ON public.report_comments(report_id, created_at DESC);

CREATE TRIGGER update_report_comments_updated_at
  BEFORE UPDATE ON public.report_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Reactions (like/dislike)
CREATE TABLE IF NOT EXISTS public.report_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('like','dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_reactions TO authenticated;
GRANT ALL ON public.report_reactions TO service_role;
ALTER TABLE public.report_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are viewable by authenticated users"
  ON public.report_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own reactions"
  ON public.report_reactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_report_reactions_report ON public.report_reactions(report_id);

-- 4. Tighten reports DELETE policy: only owner OR admin (drop any existing delete policies)
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='reports' AND cmd='DELETE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.reports', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Owner or admin can delete reports"
  ON public.reports FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 5. Tighten reports UPDATE: status changes admin-only, other fields owner-editable
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='reports' AND cmd='UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.reports', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Owner can update own reports (non-status)"
  ON public.reports FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any report"
  ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: prevent non-admins from changing status
CREATE OR REPLACE FUNCTION public.enforce_status_admin_only()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only admins can change report status';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_status_admin_only ON public.reports;
CREATE TRIGGER trg_enforce_status_admin_only
  BEFORE UPDATE OF status ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_status_admin_only();

-- 6. Notify uploader when status changes (esp. resolved)
CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'resolved' THEN 'report_resolved' ELSE 'report_status_changed' END,
      CASE WHEN NEW.status = 'resolved'
        THEN 'Your report has been resolved'
        ELSE 'Report status updated' END,
      CASE WHEN NEW.status = 'resolved'
        THEN 'Good news — "' || NEW.title || '" was marked as resolved by an admin.'
        ELSE 'The status of "' || NEW.title || '" is now ' || NEW.status || '.' END,
      '/reports/' || NEW.id::text,
      jsonb_build_object('report_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_status_change ON public.reports;
CREATE TRIGGER trg_notify_status_change
  AFTER UPDATE OF status ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_status_change();

-- 7. Realtime for comments + reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.report_reactions;
