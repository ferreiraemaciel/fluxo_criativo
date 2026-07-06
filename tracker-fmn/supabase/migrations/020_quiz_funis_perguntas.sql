-- Migration 020: abandono por etapa passa a devolver rótulo humano + pergunta completa
-- (sem Q1/Q2). Recria a função quiz_funis_dashboard mudando só o bloco 'abandono'.

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

    'abandono', (select jsonb_agg(jsonb_build_object('etapa', etapa, 'pergunta', pergunta, 'n', n) order by ord) from (
        select 1  ord, 'Área de atuação'      etapa, 'Qual a sua principal área de atuação?' pergunta, count(area_atuacao) n from base
        union all select 2,  'Trabalha profissional?', 'Você trabalha com isso de forma profissional?',                 count(profissionalizacao)  from base
        union all select 3,  'Autônomo ou MEI',        'Você é: Autônomo, Empresário/MEI ou ainda amador?',            count(tipo_negocio)        from base
        union all select 4,  'Confiança do cliente',   'Seus clientes confiam em você desde o primeiro contato ou você sente que precisa provar seu valor?', count(confianca_clientes) from base
        union all select 5,  'Situações vividas',      'Você já passou por quais dessas situações?',                    count(*) filter (where array_length(situacoes,1) >= 1)      from base
        union all select 6,  'Custo de um processo',   'Você tem ideia de quanto custa um processo por erro seu?',      count(custo_processo)      from base
        union all select 7,  'Usa contrato?',          'Você usa contrato em todos os seus trabalhos?',                 count(usa_contrato)        from base
        union all select 8,  'Contrato atual',         'Como é o seu atual contrato?',                                  count(tipo_contrato_atual) from base
        union all select 9,  'Foco na arte',           'Você consegue focar na parte artística do seu trabalho?',       count(foco_artistico)      from base
        union all select 10, 'Sentimentos',            'Você tem algum desses sentimentos?',                            count(*) filter (where array_length(sentimentos,1) >= 1)    from base
        union all select 11, 'Protege o dinheiro?',    'Seu contrato te ajuda a não perder dinheiro com cancelamentos, mudanças e calotes?', count(protege_dinheiro) from base
        union all select 12, 'Temas que domina',       'Qual desses temas jurídicos você domina?',                      count(*) filter (where array_length(temas_dominados,1) >= 1) from base
        union all select 13, 'Entende o contrato?',    'Ao ver seu contrato, você consegue entendê-lo?',                count(entende_contrato)    from base
        union all select 14, 'Quer os modelos?',       'Ter modelos de contrato rápidos de preencher, fáceis de entender e com segurança jurídica ajudaria no seu negócio?', count(quer_modelos) from base
        union all select 15, 'Captura de e-mail',      'Deixou o e-mail para ver o diagnóstico (virou lead).',          count(*) filter (where completou_lead)                      from base
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
