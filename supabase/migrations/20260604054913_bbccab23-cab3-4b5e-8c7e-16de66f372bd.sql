DROP INDEX IF EXISTS public.production_records_uniq;
CREATE UNIQUE INDEX production_records_uniq
  ON public.production_records
  USING btree (fpp, seq, dt_prog, maquina, item, produto)
  NULLS NOT DISTINCT;