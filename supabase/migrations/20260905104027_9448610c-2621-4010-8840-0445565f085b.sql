create or replace function public.ia_query(sql_text text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  q text := btrim(sql_text);
begin
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
  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s limit 500) t', q) into result;
  return result;
end;
$$;

revoke all on function public.ia_query(text) from public, anon, authenticated;
grant execute on function public.ia_query(text) to service_role;