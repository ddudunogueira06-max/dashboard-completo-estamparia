DROP POLICY IF EXISTS "public delete waste_imports" ON public.waste_imports;
DROP POLICY IF EXISTS "public insert waste_imports" ON public.waste_imports;
DROP POLICY IF EXISTS "public read waste_imports" ON public.waste_imports;
DROP POLICY IF EXISTS "public update waste_imports" ON public.waste_imports;
DROP POLICY IF EXISTS "public delete waste_records" ON public.waste_records;
DROP POLICY IF EXISTS "public insert waste_records" ON public.waste_records;
DROP POLICY IF EXISTS "public read waste_records" ON public.waste_records;
DROP POLICY IF EXISTS "public update waste_records" ON public.waste_records;
REVOKE ALL ON public.waste_imports FROM anon;
REVOKE ALL ON public.waste_records FROM anon;

-- Ensure admin-only writes + authenticated reads exist on waste tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='waste_imports' AND policyname='Authenticated view waste_imports') THEN
    EXECUTE 'CREATE POLICY "Authenticated view waste_imports" ON public.waste_imports FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='waste_imports' AND policyname='Admin write waste_imports') THEN
    EXECUTE 'CREATE POLICY "Admin write waste_imports" ON public.waste_imports FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='waste_records' AND policyname='Authenticated view waste_records') THEN
    EXECUTE 'CREATE POLICY "Authenticated view waste_records" ON public.waste_records FOR SELECT TO authenticated USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='waste_records' AND policyname='Admin write waste_records') THEN
    EXECUTE 'CREATE POLICY "Admin write waste_records" ON public.waste_records FOR ALL TO authenticated USING (has_role(auth.uid(), ''admin''::app_role)) WITH CHECK (has_role(auth.uid(), ''admin''::app_role))';
  END IF;
END $$;