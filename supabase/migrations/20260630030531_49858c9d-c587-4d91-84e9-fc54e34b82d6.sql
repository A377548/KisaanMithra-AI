
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  village TEXT,
  state TEXT,
  language TEXT DEFAULT 'hi',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- fields
CREATE TABLE public.fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  crop TEXT,
  area_acres NUMERIC(10,2),
  soil_type TEXT,
  lat NUMERIC(10,6),
  lng NUMERIC(10,6),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT ALL ON public.fields TO service_role;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own fields" ON public.fields FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- crop_yields
CREATE TABLE public.crop_yields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  field_id UUID REFERENCES public.fields ON DELETE SET NULL,
  crop TEXT NOT NULL,
  season TEXT,
  sowing_date DATE,
  harvest_date DATE,
  area_acres NUMERIC(10,2),
  yield_kg NUMERIC(12,2),
  income_inr NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crop_yields TO authenticated;
GRANT ALL ON public.crop_yields TO service_role;
ALTER TABLE public.crop_yields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own yields" ON public.crop_yields FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- app_ratings (one per user)
CREATE TABLE public.app_ratings (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_ratings TO authenticated;
GRANT ALL ON public.app_ratings TO service_role;
ALTER TABLE public.app_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own rating" ON public.app_ratings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- advice_history
CREATE TABLE public.advice_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  crop TEXT,
  language TEXT,
  advice TEXT,
  verdict TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.advice_history TO authenticated;
GRANT ALL ON public.advice_history TO service_role;
ALTER TABLE public.advice_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own advice" ON public.advice_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- diagnosis_history
CREATE TABLE public.diagnosis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  crop TEXT,
  language TEXT,
  diagnosis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnosis_history TO authenticated;
GRANT ALL ON public.diagnosis_history TO service_role;
ALTER TABLE public.diagnosis_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dx" ON public.diagnosis_history FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- trigger: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
