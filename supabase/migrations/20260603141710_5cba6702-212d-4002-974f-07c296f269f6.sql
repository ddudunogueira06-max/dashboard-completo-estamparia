DROP INDEX IF EXISTS public.production_records_dedup_uidx;
DROP INDEX IF EXISTS public.production_records_uniq;

CREATE UNIQUE INDEX production_records_uniq
ON public.production_records (fpp, seq, dt_prog) NULLS NOT DISTINCT;