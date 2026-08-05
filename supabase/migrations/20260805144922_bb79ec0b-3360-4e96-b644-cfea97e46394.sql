CREATE TABLE public.dobra_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  tipo text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  inserted_rows integer NOT NULL DEFAULT 0,
  updated_rows integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dobra_imports TO authenticated;
GRANT ALL ON public.dobra_imports TO service_role;
ALTER TABLE public.dobra_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view dobra_imports" ON public.dobra_imports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write dobra_imports" ON public.dobra_imports FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.dobra_rgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rg_key text NOT NULL UNIQUE,
  rg text NOT NULL,
  fpp_key text,
  fpp text,
  status text,
  cliente text,
  nr_ov text,
  data_rg date,
  produto text,
  item_ov text,
  tarefa_desc text,
  operador text,
  maquina_ativa text,
  data_planejamento date,
  data_conclusao date,
  tempo_seg integer,
  import_id uuid REFERENCES public.dobra_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dobra_rgs_fpp_key_idx ON public.dobra_rgs (fpp_key);
CREATE INDEX dobra_rgs_status_idx ON public.dobra_rgs (status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dobra_rgs TO authenticated;
GRANT ALL ON public.dobra_rgs TO service_role;
ALTER TABLE public.dobra_rgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view dobra_rgs" ON public.dobra_rgs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write dobra_rgs" ON public.dobra_rgs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_dobra_rgs_updated_at BEFORE UPDATE ON public.dobra_rgs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dobra_fpps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fpp_key text NOT NULL UNIQUE,
  fpp text NOT NULL,
  dt_programada date,
  seq integer,
  produto text,
  linha text,
  cliente text,
  item text,
  data_rg date,
  dt_pacote date,
  dt_fim_prog date,
  dt_planejamento date,
  tempo_fpp_seg integer,
  maquina integer,
  import_id uuid REFERENCES public.dobra_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dobra_fpps TO authenticated;
GRANT ALL ON public.dobra_fpps TO service_role;
ALTER TABLE public.dobra_fpps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view dobra_fpps" ON public.dobra_fpps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write dobra_fpps" ON public.dobra_fpps FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_dobra_fpps_updated_at BEFORE UPDATE ON public.dobra_fpps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.dobra_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dobra_settings TO authenticated;
GRANT ALL ON public.dobra_settings TO service_role;
ALTER TABLE public.dobra_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view dobra_settings" ON public.dobra_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write dobra_settings" ON public.dobra_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_dobra_settings_updated_at BEFORE UPDATE ON public.dobra_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.dobra_settings (key, value) VALUES
 ('capacidade', '{"horasDiaDobra":"15:54:00","turno1":"07:48:00","turno2":"08:06:00","dobradeiras":6,"feriasT1":0,"feriasT2":0,"afastadosT1":0,"afastadosT2":0,"manual":false,"capacidadeManual":"95:36:00","obs":""}'::jsonb),
 ('meta', '{"metaRgsDia":40,"periodoMedia":7,"ignorarFimDeSemana":true,"somenteDiasComProducao":true,"metaSla":95}'::jsonb),
 ('tarefas_dobra', '["Dobrar","Dobra","Dobrar raio","Dobrar acabamento"]'::jsonb);