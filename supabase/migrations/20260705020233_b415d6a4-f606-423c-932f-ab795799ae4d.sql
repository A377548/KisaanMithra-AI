
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT ALL ON public.fields TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_yields TO authenticated;
GRANT ALL ON public.crop_yields TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_ratings TO authenticated;
GRANT ALL ON public.app_ratings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advice_history TO authenticated;
GRANT ALL ON public.advice_history TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnosis_history TO authenticated;
GRANT ALL ON public.diagnosis_history TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnosis_feedback TO authenticated;
GRANT ALL ON public.diagnosis_feedback TO service_role;

GRANT SELECT ON public.admin_crops TO authenticated, anon;
GRANT ALL ON public.admin_crops TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
