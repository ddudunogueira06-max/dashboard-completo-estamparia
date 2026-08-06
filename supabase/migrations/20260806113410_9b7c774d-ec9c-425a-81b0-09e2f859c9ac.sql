CREATE TABLE IF NOT EXISTS public.dobra_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fpp_key text NOT NULL,
  fpp text NOT NULL,
  maquina text,
  qtd_pecas numeric,
  tempo_estimado_seg numeric,
  tempo_planejado_seg numeric,
  tempo_real_seg numeric,
  data_inicio timestamptz,
  data_final timestamptz,
  qtd_produzida numeric,
  qtd_refugo numeric,
  qtd_retrabalho numeric,
  performance numeric,
  obs text,
  import_id uuid REFERENCES public.dobra_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dobra_controle_rg (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rg_key text NOT NULL,
  rg text NOT NULL,
  cliente text,
  produto text,
  quantidade numeric,
  data_rg date,
  data_planejamento date,
  ultima_seq integer,
  data_conclusao date,
  tempo_execucao_dias numeric,
  data_pacote date,
  fpp_key text,
  fpp text,
  sla text,
  ta_rg numeric,
  eficiencia numeric,
  import_id uuid REFERENCES public.dobra_imports(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dobra_performance TO authenticated;
GRANT ALL ON public.dobra_performance TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dobra_controle_rg TO authenticated;
GRANT ALL ON public.dobra_controle_rg TO service_role;

ALTER TABLE public.dobra_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dobra_controle_rg ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view dobra_performance" ON public.dobra_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write dobra_performance" ON public.dobra_performance FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated view dobra_controle_rg" ON public.dobra_controle_rg FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin write dobra_controle_rg" ON public.dobra_controle_rg FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE UNIQUE INDEX IF NOT EXISTS dobra_performance_fpp_key_uidx ON public.dobra_performance(fpp_key);
CREATE UNIQUE INDEX IF NOT EXISTS dobra_controle_rg_rg_key_uidx ON public.dobra_controle_rg(rg_key);

CREATE TRIGGER update_dobra_performance_updated_at BEFORE UPDATE ON public.dobra_performance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dobra_controle_rg_updated_at BEFORE UPDATE ON public.dobra_controle_rg FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DELETE FROM public.dobra_rgs a USING public.dobra_rgs b WHERE a.ctid < b.ctid AND a.rg_key = b.rg_key;
DELETE FROM public.dobra_fpps a USING public.dobra_fpps b WHERE a.ctid < b.ctid AND a.fpp_key = b.fpp_key;
CREATE UNIQUE INDEX IF NOT EXISTS dobra_rgs_rg_key_uidx ON public.dobra_rgs(rg_key);
CREATE UNIQUE INDEX IF NOT EXISTS dobra_fpps_fpp_key_uidx ON public.dobra_fpps(fpp_key);