
-- OEE imports (1 PDF = 1 import)
CREATE TABLE public.oee_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo text NOT NULL,
  turno smallint NOT NULL CHECK (turno IN (1,2)),
  maquina integer NOT NULL,
  mes_ref date,
  total_dias integer NOT NULL DEFAULT 0,
  total_paradas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oee_imports TO anon, authenticated;
GRANT ALL ON public.oee_imports TO service_role;
ALTER TABLE public.oee_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read oee_imports" ON public.oee_imports FOR SELECT USING (true);
CREATE POLICY "public insert oee_imports" ON public.oee_imports FOR INSERT WITH CHECK (true);
CREATE POLICY "public update oee_imports" ON public.oee_imports FOR UPDATE USING (true);
CREATE POLICY "public delete oee_imports" ON public.oee_imports FOR DELETE USING (true);

-- OEE por dia
CREATE TABLE public.oee_dias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.oee_imports(id) ON DELETE CASCADE,
  turno smallint NOT NULL,
  maquina integer NOT NULL,
  data date NOT NULL,
  horas_disp_seg integer,
  horas_prog_seg integer,
  horas_reg_seg integer,
  paradas_prog_seg integer,
  paradas_nao_prog_seg integer,
  oee numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turno, maquina, data)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oee_dias TO anon, authenticated;
GRANT ALL ON public.oee_dias TO service_role;
ALTER TABLE public.oee_dias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read oee_dias" ON public.oee_dias FOR SELECT USING (true);
CREATE POLICY "public insert oee_dias" ON public.oee_dias FOR INSERT WITH CHECK (true);
CREATE POLICY "public update oee_dias" ON public.oee_dias FOR UPDATE USING (true);
CREATE POLICY "public delete oee_dias" ON public.oee_dias FOR DELETE USING (true);
CREATE INDEX idx_oee_dias_data ON public.oee_dias(data);
CREATE INDEX idx_oee_dias_maq_turno ON public.oee_dias(maquina, turno);

-- Paradas agregadas por mês/máquina/turno
CREATE TABLE public.oee_paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid REFERENCES public.oee_imports(id) ON DELETE CASCADE,
  turno smallint NOT NULL,
  maquina integer NOT NULL,
  mes_ref date NOT NULL,
  categoria text NOT NULL,
  total_seg integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turno, maquina, mes_ref, categoria)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oee_paradas TO anon, authenticated;
GRANT ALL ON public.oee_paradas TO service_role;
ALTER TABLE public.oee_paradas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read oee_paradas" ON public.oee_paradas FOR SELECT USING (true);
CREATE POLICY "public insert oee_paradas" ON public.oee_paradas FOR INSERT WITH CHECK (true);
CREATE POLICY "public update oee_paradas" ON public.oee_paradas FOR UPDATE USING (true);
CREATE POLICY "public delete oee_paradas" ON public.oee_paradas FOR DELETE USING (true);
CREATE INDEX idx_oee_paradas_mes ON public.oee_paradas(mes_ref);
CREATE INDEX idx_oee_paradas_maq_turno ON public.oee_paradas(maquina, turno);
