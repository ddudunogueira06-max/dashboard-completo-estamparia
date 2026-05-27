
CREATE TABLE public.waste_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT,
  numero INTEGER,
  codigo_item TEXT,
  descricao TEXT,
  armazem TEXT,
  fator_perda NUMERIC,
  linha INTEGER,
  qtde_solicitada NUMERIC,
  data_registro TIMESTAMPTZ,
  retalho NUMERIC,
  status TEXT,
  import_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (numero, linha, codigo_item, data_registro)
);

CREATE INDEX idx_waste_records_data ON public.waste_records(data_registro);
CREATE INDEX idx_waste_records_codigo ON public.waste_records(codigo_item);
CREATE INDEX idx_waste_records_tipo ON public.waste_records(tipo);

CREATE TABLE public.waste_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_records TO anon, authenticated;
GRANT ALL ON public.waste_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_imports TO anon, authenticated;
GRANT ALL ON public.waste_imports TO service_role;

ALTER TABLE public.waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read waste_records" ON public.waste_records FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert waste_records" ON public.waste_records FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public delete waste_records" ON public.waste_records FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "public read waste_imports" ON public.waste_imports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert waste_imports" ON public.waste_imports FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public delete waste_imports" ON public.waste_imports FOR DELETE TO anon, authenticated USING (true);
