REVOKE ALL ON public.fields FROM anon;
REVOKE ALL ON public.crop_yields FROM anon;
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.app_ratings FROM anon;
REVOKE ALL ON public.advice_history FROM anon;
REVOKE ALL ON public.diagnosis_history FROM anon;
REVOKE ALL ON public.diagnosis_feedback FROM anon;
REVOKE ALL ON public.user_roles FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.admin_crops FROM anon;
GRANT SELECT ON public.admin_crops TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_crops'
      AND policyname = 'public read crops'
  ) THEN
    CREATE POLICY "public read crops"
      ON public.admin_crops
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;