DELETE FROM public.dobra_performance a USING public.dobra_performance b
WHERE a.fpp_key = b.fpp_key AND a.ctid < b.ctid;
ALTER TABLE public.dobra_performance ADD CONSTRAINT dobra_performance_fpp_key_key UNIQUE (fpp_key);

DELETE FROM public.dobra_controle_rg a USING public.dobra_controle_rg b
WHERE a.rg_key = b.rg_key AND a.ctid < b.ctid;
ALTER TABLE public.dobra_controle_rg ADD CONSTRAINT dobra_controle_rg_rg_key_key UNIQUE (rg_key);