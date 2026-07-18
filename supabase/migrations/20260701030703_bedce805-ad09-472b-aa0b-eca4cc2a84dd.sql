
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role security-definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Bootstrap: first caller becomes admin if no admin exists.
CREATE OR REPLACE FUNCTION public.claim_first_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;

-- Admin-managed extra crops
CREATE TABLE public.admin_crops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crop_id text NOT NULL UNIQUE,
  name_en text NOT NULL,
  emoji text NOT NULL DEFAULT '🌱',
  names jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_crops TO authenticated;
GRANT ALL ON public.admin_crops TO service_role;
ALTER TABLE public.admin_crops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read crops" ON public.admin_crops
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins insert crops" ON public.admin_crops
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update crops" ON public.admin_crops
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete crops" ON public.admin_crops
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Diagnosis feedback
CREATE TABLE public.diagnosis_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id uuid NOT NULL REFERENCES public.diagnosis_history(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  helpful boolean NOT NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diagnosis_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnosis_feedback TO authenticated;
GRANT ALL ON public.diagnosis_feedback TO service_role;
ALTER TABLE public.diagnosis_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback all" ON public.diagnosis_feedback
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all feedback" ON public.diagnosis_feedback
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Admin visibility on existing tables
CREATE POLICY "admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all diagnoses" ON public.diagnosis_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all yields" ON public.crop_yields
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all fields" ON public.fields
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all ratings" ON public.app_ratings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read all advice" ON public.advice_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Default new-profile language to Telugu
ALTER TABLE public.profiles ALTER COLUMN language SET DEFAULT 'te';
