-- Migration 018: RLS da quiz_leads (paridade com vendas) + função de dashboard
-- A função devolve tudo agregado em um JSON só, filtrável por data,
-- para a aba Funis do Tracker não precisar baixar as linhas.

alter table quiz_leads enable row level security;
drop policy if exists quiz_leads_acesso_total on quiz_leads;
create policy quiz_leads_acesso_total on quiz_leads for all to public using (true) with check (true);

create or replace function quiz_funis_dashboard(p_from date default null, p_to date default null)
returns jsonb
language sql
stable
as $$
  with base as (
    select * from quiz_leads
    where (p_from is null or created_at >= p_from)
      and (p_to   is null or created_at <  (p_to + 1))
  )
  select jsonb_build_object(
    'kpis', (select jsonb_build_object(
        'total',       count(*),
        'com_email',   count(*) filter (where completou_lead),
        'periodo_min', min(created_at),
        'periodo_max', max(created_at)
      ) from base),

    'abandono', (select jsonb_agg(jsonb_build_object('etapa', etapa, 'n', n) order by ord) from (
        select 1  ord, 'Q1 área'           etapa, count(area_atuacao)        n from base
        union all select 2,  'Q2 profissional',   count(profissionalizacao)    from base
        union all select 3,  'Q3 PJ/PF',          count(tipo_negocio)          from base
        union all select 4,  'Q4 confiança',      count(confianca_clientes)    from base
        union all select 5,  'Q6 situações',      count(*) filter (where array_length(situacoes,1) >= 1)      from base
        union all select 6,  'Q7 custo',          count(custo_processo)        from base
        union all select 7,  'Q9 usa contrato',   count(usa_contrato)          from base
        union all select 8,  'Q10 contrato hoje', count(tipo_contrato_atual)   from base
        union all select 9,  'Q11 foco na arte',  count(foco_artistico)        from base
        union all select 10, 'Q12 sentimentos',   count(*) filter (where array_length(sentimentos,1) >= 1)    from base
        union all select 11, 'Q13 protege $',     count(protege_dinheiro)      from base
        union all select 12, 'Q14 temas',         count(*) filter (where array_length(temas_dominados,1) >= 1) from base
        union all select 13, 'Q15 entende',       count(entende_contrato)      from base
        union all select 14, 'Q16 quer modelos',  count(quer_modelos)          from base
        union all select 15, 'Captura e-mail',    count(*) filter (where completou_lead)                      from base
      ) t),

    'por_mes', (select jsonb_agg(jsonb_build_object('mes', mes, 'leads', leads, 'com_email', com_email) order by mes) from (
        select to_char(date_trunc('month', created_at),'YYYY-MM') mes,
               count(*) leads, count(*) filter (where completou_lead) com_email
        from base where created_at is not null group by 1
      ) m),

    'campanhas', (select jsonb_agg(jsonb_build_object('val', campanha, 'n', n) order by n desc) from (
        select coalesce(nullif(utm_campaign,''),'(sem UTM)') campanha, count(*) n
        from base where completou_lead group by 1 order by 2 desc limit 8
      ) c),

    'dores', (select jsonb_agg(jsonb_build_object('val', s, 'n', n) order by n desc) from (
        select s, count(*) n from base, unnest(situacoes) s group by 1 order by 2 desc limit 8) d),

    'sentimentos', (select jsonb_agg(jsonb_build_object('val', s, 'n', n) order by n desc) from (
        select s, count(*) n from base, unnest(sentimentos) s group by 1 order by 2 desc limit 6) d),

    'temas', (select jsonb_agg(jsonb_build_object('val', s, 'n', n) order by n desc) from (
        select s, count(*) n from base, unnest(temas_dominados) s group by 1 order by 2 desc limit 7) d),

    'custo', (select jsonb_agg(jsonb_build_object('val', custo_processo, 'n', n) order by n desc) from (
        select custo_processo, count(*) n from base where custo_processo is not null group by 1 order by 2 desc) d),

    'area', (select jsonb_agg(jsonb_build_object('val', area_atuacao, 'n', n) order by n desc) from (
        select area_atuacao, count(*) n from base where area_atuacao is not null group by 1 order by 2 desc) d),

    'usa_contrato', (select jsonb_agg(jsonb_build_object('val', usa_contrato, 'n', n) order by n desc) from (
        select usa_contrato, count(*) n from base where usa_contrato is not null group by 1 order by 2 desc) d)
  );
$$;

grant execute on function quiz_funis_dashboard(date, date) to anon, authenticated;
