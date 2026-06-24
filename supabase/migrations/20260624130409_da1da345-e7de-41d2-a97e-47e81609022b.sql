
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'viewer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

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

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'lucas@admin.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- profiles policies
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ MFA ============
CREATE TABLE public.mfa_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mfa_sessions TO authenticated;
GRANT ALL ON public.mfa_sessions TO service_role;
ALTER TABLE public.mfa_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mfa sessions" ON public.mfa_sessions FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_mfa_sessions_user ON public.mfa_sessions(user_id, expires_at);

-- ============ TIGHTEN RLS ON EXISTING TABLES ============
-- Drop existing policies and replace with role-aware ones

-- waste_records
DROP POLICY IF EXISTS "Anyone can view waste_records" ON public.waste_records;
DROP POLICY IF EXISTS "Anyone can insert waste_records" ON public.waste_records;
DROP POLICY IF EXISTS "Anyone can delete waste_records" ON public.waste_records;
DROP POLICY IF EXISTS "Anyone can update waste_records" ON public.waste_records;
DROP POLICY IF EXISTS "Public read waste_records" ON public.waste_records;
CREATE POLICY "Authenticated view waste_records" ON public.waste_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write waste_records" ON public.waste_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.waste_records FROM anon;

-- waste_imports
DROP POLICY IF EXISTS "Anyone can view waste_imports" ON public.waste_imports;
DROP POLICY IF EXISTS "Anyone can insert waste_imports" ON public.waste_imports;
DROP POLICY IF EXISTS "Anyone can delete waste_imports" ON public.waste_imports;
DROP POLICY IF EXISTS "Public read waste_imports" ON public.waste_imports;
CREATE POLICY "Authenticated view waste_imports" ON public.waste_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write waste_imports" ON public.waste_imports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.waste_imports FROM anon;

-- production_records
DROP POLICY IF EXISTS "Anyone can view production_records" ON public.production_records;
DROP POLICY IF EXISTS "Anyone can insert production_records" ON public.production_records;
DROP POLICY IF EXISTS "Anyone can update production_records" ON public.production_records;
DROP POLICY IF EXISTS "Anyone can delete production_records" ON public.production_records;
CREATE POLICY "Authenticated view production_records" ON public.production_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write production_records" ON public.production_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.production_records FROM anon;

-- production_imports
DROP POLICY IF EXISTS "Anyone can view production_imports" ON public.production_imports;
DROP POLICY IF EXISTS "Anyone can insert production_imports" ON public.production_imports;
DROP POLICY IF EXISTS "Anyone can delete production_imports" ON public.production_imports;
CREATE POLICY "Authenticated view production_imports" ON public.production_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write production_imports" ON public.production_imports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.production_imports FROM anon;

-- oee_dias
DROP POLICY IF EXISTS "Anyone can view oee_dias" ON public.oee_dias;
DROP POLICY IF EXISTS "Anyone can insert oee_dias" ON public.oee_dias;
DROP POLICY IF EXISTS "Anyone can update oee_dias" ON public.oee_dias;
DROP POLICY IF EXISTS "Anyone can delete oee_dias" ON public.oee_dias;
CREATE POLICY "Authenticated view oee_dias" ON public.oee_dias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write oee_dias" ON public.oee_dias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.oee_dias FROM anon;

-- oee_paradas
DROP POLICY IF EXISTS "Anyone can view oee_paradas" ON public.oee_paradas;
DROP POLICY IF EXISTS "Anyone can insert oee_paradas" ON public.oee_paradas;
DROP POLICY IF EXISTS "Anyone can update oee_paradas" ON public.oee_paradas;
DROP POLICY IF EXISTS "Anyone can delete oee_paradas" ON public.oee_paradas;
CREATE POLICY "Authenticated view oee_paradas" ON public.oee_paradas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write oee_paradas" ON public.oee_paradas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.oee_paradas FROM anon;

-- oee_imports
DROP POLICY IF EXISTS "Anyone can view oee_imports" ON public.oee_imports;
DROP POLICY IF EXISTS "Anyone can insert oee_imports" ON public.oee_imports;
DROP POLICY IF EXISTS "Anyone can delete oee_imports" ON public.oee_imports;
CREATE POLICY "Authenticated view oee_imports" ON public.oee_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write oee_imports" ON public.oee_imports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
REVOKE ALL ON public.oee_imports FROM anon;
