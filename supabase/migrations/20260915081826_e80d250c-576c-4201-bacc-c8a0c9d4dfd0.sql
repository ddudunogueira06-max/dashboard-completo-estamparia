ALTER TABLE public.dobra_rgs
  ADD COLUMN data_dobra timestamptz,
  ADD COLUMN import_id_dobra uuid REFERENCES public.dobra_imports(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.dobra_rgs.data_dobra IS 'Momento congelado em que a importacao detectou a primeira saida da RG da dobra';
COMMENT ON COLUMN public.dobra_rgs.import_id_dobra IS 'Importacao que detectou a primeira saida da RG da dobra';

CREATE TABLE public.dobra_rgs_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rg_id uuid NOT NULL REFERENCES public.dobra_rgs(id) ON DELETE CASCADE,
  rg_key text NOT NULL,
  status_anterior text,
  status_novo text,
  data_planejamento date,
  data_conclusao date,
  import_id uuid REFERENCES public.dobra_imports(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dobra_rgs_status_history TO authenticated;
GRANT ALL ON public.dobra_rgs_status_history TO service_role;

ALTER TABLE public.dobra_rgs_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view dobra status history"
ON public.dobra_rgs_status_history
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admin manage dobra status history"
ON public.dobra_rgs_status_history
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX dobra_rgs_status_history_rg_key_idx
  ON public.dobra_rgs_status_history (rg_key, changed_at DESC);
CREATE INDEX dobra_rgs_data_dobra_idx
  ON public.dobra_rgs (data_dobra);

CREATE OR REPLACE FUNCTION public.dobra_status_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT upper(translate(coalesce(value, ''),
    'áàâãäéêíóôõúüçÁÀÂÃÄÉÊÍÓÔÕÚÜÇ',
    'aaaaaeeiooouucAAAAAEEIOOOUUC'))
$$;

CREATE OR REPLACE FUNCTION public.dobra_status_is_dobrado(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT public.dobra_status_key(value) LIKE 'CONCLUID%'
      OR public.dobra_status_key(value) LIKE '%LOGIST%'
      OR public.dobra_status_key(value) LIKE 'LOG.%'
      OR public.dobra_status_key(value) LIKE '%SEPARA%'
      OR public.dobra_status_key(value) LIKE 'FINALIZ%'
      OR public.dobra_status_key(value) LIKE 'ENCERRAD%'
      OR public.dobra_status_key(value) LIKE 'ENTREGUE%'
$$;

CREATE OR REPLACE FUNCTION public.track_dobra_rg_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.dobra_status_is_dobrado(NEW.status) THEN
      NEW.data_dobra := COALESCE(
        NEW.data_dobra,
        NEW.data_conclusao::timestamp AT TIME ZONE 'America/Sao_Paulo',
        NEW.data_planejamento::timestamp AT TIME ZONE 'America/Sao_Paulo'
      );
      NEW.import_id_dobra := COALESCE(NEW.import_id_dobra, NEW.import_id);
    END IF;
    RETURN NEW;
  END IF;

  NEW.data_dobra := OLD.data_dobra;
  NEW.import_id_dobra := OLD.import_id_dobra;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.dobra_rgs_status_history (
      rg_id, rg_key, status_anterior, status_novo,
      data_planejamento, data_conclusao, import_id
    ) VALUES (
      OLD.id, OLD.rg_key, OLD.status, NEW.status,
      NEW.data_planejamento, NEW.data_conclusao, NEW.import_id
    );

    IF NOT public.dobra_status_is_dobrado(OLD.status)
       AND public.dobra_status_is_dobrado(NEW.status)
       AND OLD.data_dobra IS NULL THEN
      NEW.data_dobra := now();
      NEW.import_id_dobra := NEW.import_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER track_dobra_rg_status_before_write
BEFORE INSERT OR UPDATE ON public.dobra_rgs
FOR EACH ROW EXECUTE FUNCTION public.track_dobra_rg_status();

UPDATE public.dobra_rgs
SET data_dobra = COALESCE(
      data_conclusao::timestamp AT TIME ZONE 'America/Sao_Paulo',
      data_planejamento::timestamp AT TIME ZONE 'America/Sao_Paulo'
    ),
    import_id_dobra = import_id
WHERE data_dobra IS NULL
  AND public.dobra_status_is_dobrado(status);

CREATE OR REPLACE FUNCTION public.ia_query(sql_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  result jsonb;
  q text := btrim(sql_text);
begin
  perform set_config('TimeZone', 'America/Sao_Paulo', true);
  if q ~* ';\s*\S' then
    raise exception 'Apenas uma consulta por vez';
  end if;
  q := btrim(rtrim(q, ';'));
  if lower(q) !~ '^(select|with)\s' then
    raise exception 'Apenas consultas SELECT sao permitidas';
  end if;
  if lower(q) ~ '\m(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|call|do)\M' then
    raise exception 'Comando nao permitido';
  end if;
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s limit 2000) t', q) into result;
  return result;
end;
$$;