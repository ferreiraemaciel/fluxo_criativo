-- Migration 071: agrega o mapa dentro do banco (SQL), em vez de buscar até
-- 5000 linhas cruas via PostgREST e somar no JS. O Supabase tem um limite
-- padrão de 1000 linhas por resposta que ignorava silenciosamente o
-- .limit(5000) do lado do cliente, então com mais de 1000 vendas aprovadas
-- com estado a soma por estado sempre ficava menor que o total real.
create or replace function mapa_agregado(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language sql stable
as $$
  with base as (
    select comprador_estado, comprador_cidade
    from vendas
    where status = 'aprovada'
      and (p_from is null or created_at >= p_from)
      and (p_to   is null or created_at <= p_to)
  ),
  por_estado as (
    select upper(left(comprador_estado, 2)) as uf, count(*) as n
    from base
    where comprador_estado is not null and comprador_estado <> ''
    group by 1
  ),
  por_cidade as (
    select upper(left(comprador_estado, 2)) as uf, comprador_cidade as cidade, count(*) as n
    from base
    where comprador_estado is not null and comprador_estado <> '' and comprador_cidade is not null
    group by 1, 2
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'semEstado', (select count(*) from base where comprador_estado is null or comprador_estado = ''),
    'byState', coalesce((select jsonb_object_agg(uf, n) from por_estado), '{}'::jsonb),
    'citiesByState', coalesce((
      select jsonb_object_agg(uf, cidades)
      from (
        select uf, jsonb_object_agg(cidade, n) as cidades
        from por_cidade
        group by uf
      ) x
    ), '{}'::jsonb)
  );
$$;

grant execute on function mapa_agregado(timestamptz, timestamptz) to anon, authenticated, service_role;
