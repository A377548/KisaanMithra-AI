DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','fields','crop_yields','app_ratings','advice_history','diagnosis_history','diagnosis_feedback','user_roles','admin_crops']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

GRANT SELECT ON public.admin_crops TO anon;