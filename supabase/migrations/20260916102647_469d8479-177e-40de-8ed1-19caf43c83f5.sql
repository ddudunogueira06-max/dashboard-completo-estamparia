UPDATE public.dobra_rgs
SET data_dobra = (
  data_conclusao::timestamp
  + make_interval(secs => CASE
      WHEN tempo_seg IS NOT NULL AND tempo_seg >= 0 AND tempo_seg < 86400 THEN tempo_seg
      ELSE 0
    END)
) AT TIME ZONE 'America/Sao_Paulo',
import_id_dobra = COALESCE(import_id_dobra, import_id)
WHERE data_dobra IS NULL
  AND public.dobra_status_is_dobrado(status)
  AND data_conclusao IS NOT NULL