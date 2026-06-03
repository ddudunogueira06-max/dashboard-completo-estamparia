CREATE UNIQUE INDEX IF NOT EXISTS production_records_dedup_uidx
ON public.production_records (fpp, seq, dt_prog);