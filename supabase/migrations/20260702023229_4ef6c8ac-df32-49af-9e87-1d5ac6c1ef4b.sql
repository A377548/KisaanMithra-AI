
-- 1) Drop the public first-admin claim to prevent privilege escalation
DROP FUNCTION IF EXISTS public.claim_first_admin();

-- 2) Move has_role into a private schema not exposed via PostgREST
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO postgres, service_role;

-- 3) Recreate policies to reference private.has_role
DROP POLICY IF EXISTS "admins insert crops" ON public.admin_crops;
DROP POLICY IF EXISTS "admins update crops" ON public.admin_crops;
DROP POLICY IF EXISTS "admins delete crops" ON public.admin_crops;
CREATE POLICY "admins insert crops" ON public.admin_crops FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins update crops" ON public.admin_crops FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins delete crops" ON public.admin_crops FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all feedback" ON public.diagnosis_feedback;
CREATE POLICY "admins read all feedback" ON public.diagnosis_feedback FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all diagnoses" ON public.diagnosis_history;
CREATE POLICY "admins read all diagnoses" ON public.diagnosis_history FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all yields" ON public.crop_yields;
CREATE POLICY "admins read all yields" ON public.crop_yields FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all fields" ON public.fields;
CREATE POLICY "admins read all fields" ON public.fields FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all ratings" ON public.app_ratings;
CREATE POLICY "admins read all ratings" ON public.app_ratings FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all advice" ON public.advice_history;
CREATE POLICY "admins read all advice" ON public.advice_history FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Drop the exposed public.has_role now that no policy references it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- 5) Tighten diagnosis_feedback insert to require ownership of the referenced diagnosis
DROP POLICY IF EXISTS "insert own feedback" ON public.diagnosis_feedback;
CREATE POLICY "insert own feedback" ON public.diagnosis_feedback FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.diagnosis_history d
      WHERE d.id = diagnosis_feedback.diagnosis_id
        AND d.user_id = auth.uid()
    )
  );
