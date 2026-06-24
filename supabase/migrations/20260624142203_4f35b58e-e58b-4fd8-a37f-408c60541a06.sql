
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_predictions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.report_feedback;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.reports REPLICA IDENTITY FULL;
ALTER TABLE public.ai_predictions REPLICA IDENTITY FULL;
ALTER TABLE public.report_feedback REPLICA IDENTITY FULL;
