CREATE SEQUENCE IF NOT EXISTS public.report_code_seq START 1;

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_code TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.assign_report_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.report_code IS NULL OR NEW.report_code = '' THEN
    NEW.report_code := 'RPT-' || lpad(nextval('public.report_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_report_code ON public.reports;
CREATE TRIGGER trg_assign_report_code
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.assign_report_code();

-- Backfill existing rows in deterministic order
UPDATE public.reports r
SET report_code = 'RPT-' || lpad(sub.rn::text, 6, '0')
FROM (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM public.reports
  WHERE report_code IS NULL
) sub
WHERE r.id = sub.id;

-- Advance sequence past max existing
SELECT setval('public.report_code_seq',
  GREATEST(1, COALESCE((SELECT MAX(substring(report_code FROM 5)::int) FROM public.reports WHERE report_code ~ '^RPT-[0-9]+$'), 0)));
