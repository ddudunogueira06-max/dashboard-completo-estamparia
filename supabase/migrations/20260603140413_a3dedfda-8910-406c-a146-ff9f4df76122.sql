
CREATE TABLE public.production_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  inserted_rows integer NOT NULL DEFAULT 0,
  skipped_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_imports TO anon, authenticated;
GRANT ALL ON public.production_imports TO service_role;
ALTER TABLE public.production_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read production_imports" ON public.production_imports FOR SELECT USING (true);
CREATE POLICY "public insert production_imports" ON public.production_imports FOR INSERT WITH CHECK (true);
CREATE POLICY "public update production_imports" ON public.production_imports FOR UPDATE USING (true);
CREATE POLICY "public delete production_imports" ON public.production_imports FOR DELETE USING (true);

CREATE TABLE public.production_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fpp text,
  dt_prog timestamptz,
  seq integer,
  produto text,
  linha text,
  cliente text,
  item text,
  data_rg timestamptz,
  dt_pacote timestamptz,
  dt_fim_prog timestamptz,
  dt_fim_estamparia timestamptz,
  dt_fim_agrup timestamptz,
  tempo_fpp_seg integer,
  maquina integer,
  tempo_execucao_seg integer,
  import_id uuid REFERENCES public.production_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX production_records_uniq ON public.production_records (fpp, COALESCE(seq,-1), COALESCE(dt_prog,'epoch'::timestamptz));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_records TO anon, authenticated;
GRANT ALL ON public.production_records TO service_role;
ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read production_records" ON public.production_records FOR SELECT USING (true);
CREATE POLICY "public insert production_records" ON public.production_records FOR INSERT WITH CHECK (true);
CREATE POLICY "public update production_records" ON public.production_records FOR UPDATE USING (true);
CREATE POLICY "public delete production_records" ON public.production_records FOR DELETE USING (true);
