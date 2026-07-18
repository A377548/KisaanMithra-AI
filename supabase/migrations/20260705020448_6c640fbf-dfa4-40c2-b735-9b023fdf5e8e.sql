GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT ALL ON public.fields TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_yields TO authenticated;
GRANT ALL ON public.crop_yields TO service_role;