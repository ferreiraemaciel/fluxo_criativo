-- Migration 023: dashboard completo do funil (todas as métricas + cruzamentos + período anterior)
create or replace function quiz_funis_dashboard(p_from date default null, p_to date default null)
returns jsonb
language sql
stable
as $$
  with base as materialized (
    select created_at, completou_lead, area_atuacao, profissionalizacao, tipo_negocio,
           confianca_clientes, situacoes, custo_processo, usa_contrato, tipo_contrato_atual,
           foco_artistico, sentimentos, protege_dinheiro, temas_dominados, entende_contrato,
           quer_modelos, utm_campaign, device_platform, nivel_risco
    from quiz_leads
    where (p_from is null or created_at >= p_from)
      and (p_to   is null or created_at <  (p_to + 1))
  ),
  prev as (
    select completou_lead from quiz_leads
    where p_from is not null and p_to is not null
      and created_at >= (p_from - ((p_to - p_from) + 1))
      and created_at <  p_from
  ),
  cfg as (select coalesce(max(created_at)::date - min(created_at)::date, 0) dias from base)
  select jsonb_build_object(
    'kpis', (select jsonb_build_object(
        'total', count(*), 'com_email', count(*) filter (where completou_lead),
        'periodo_min', min(created_at), 'periodo_max', max(created_at),
        'prev_total', (select count(*) from prev),
        'prev_com_email', (select count(*) filter (where completou_lead) from prev)
      ) from base),

    'abandono', (select jsonb_agg(jsonb_build_object('etapa', etapa, 'pergunta', pergunta, 'n', n) order by ord) from (
        select 1  ord, 'Área de atuação'      etapa, 'Qual a sua principal área de atuação?' pergunta, count(area_atuacao) n from base
        union all select 2,'Trabalha profissional?','Você trabalha com isso de forma profissional?',count(profissionalizacao) from base
        union all select 3,'Autônomo ou MEI','Você é: Autônomo, Empresário/MEI ou ainda amador?',count(tipo_negocio) from base
        union all select 4,'Confiança do cliente','Seus clientes confiam em você desde o primeiro contato ou você sente que precisa provar seu valor?',count(confianca_clientes) from base
        union all select 5,'Situações vividas','Você já passou por quais dessas situações?',count(*) filter (where array_length(situacoes,1)>=1) from base
        union all select 6,'Custo de um processo','Você tem ideia de quanto custa um processo por erro seu?',count(custo_processo) from base
        union all select 7,'Usa contrato?','Você usa contrato em todos os seus trabalhos?',count(usa_contrato) from base
        union all select 8,'Contrato atual','Como é o seu atual contrato?',count(tipo_contrato_atual) from base
        union all select 9,'Foco na arte','Você consegue focar na parte artística do seu trabalho?',count(foco_artistico) from base
        union all select 10,'Sentimentos','Você tem algum desses sentimentos?',count(*) filter (where array_length(sentimentos,1)>=1) from base
        union all select 11,'Protege o dinheiro?','Seu contrato te ajuda a não perder dinheiro com cancelamentos, mudanças e calotes?',count(protege_dinheiro) from base
        union all select 12,'Temas que domina','Qual desses temas jurídicos você domina?',count(*) filter (where array_length(temas_dominados,1)>=1) from base
        union all select 13,'Entende o contrato?','Ao ver seu contrato, você consegue entendê-lo?',count(entende_contrato) from base
        union all select 14,'Quer os modelos?','Ter modelos de contrato rápidos de preencher, fáceis de entender e com segurança jurídica ajudaria no seu negócio?',count(quer_modelos) from base
        union all select 15,'Captura de e-mail','Deixou o e-mail para ver o diagnóstico (virou lead).',count(*) filter (where completou_lead) from base
      ) t),

    'serie', (select jsonb_agg(jsonb_build_object('rotulo', rotulo, 'leads', leads, 'com_email', com_email) order by ord) from (
        select min(created_at) ord,
          case when (select dias from cfg) <= 92 then to_char(date_trunc('day',created_at),'DD/MM')
               else to_char(date_trunc('month',created_at),'MM/YYYY') end rotulo,
          count(*) leads, count(*) filter (where completou_lead) com_email
        from base where created_at is not null group by 2
      ) s),

    'dores', (select jsonb_agg(jsonb_build_object('val',s,'n',n) order by n desc) from (select s,count(*) n from base,unnest(situacoes) s group by 1 order by 2 desc limit 8) d),
    'sentimentos', (select jsonb_agg(jsonb_build_object('val',s,'n',n) order by n desc) from (select s,count(*) n from base,unnest(sentimentos) s group by 1 order by 2 desc limit 6) d),
    'temas', (select jsonb_agg(jsonb_build_object('val',s,'n',n) order by n desc) from (select s,count(*) n from base,unnest(temas_dominados) s group by 1 order by 2 desc limit 7) d),
    'custo', (select jsonb_agg(jsonb_build_object('val',custo_processo,'n',n) order by n desc) from (select custo_processo,count(*) n from base where custo_processo is not null group by 1 order by 2 desc) d),
    'area', (select jsonb_agg(jsonb_build_object('val',area_atuacao,'n',n) order by n desc) from (select area_atuacao,count(*) n from base where area_atuacao is not null group by 1 order by 2 desc) d),
    'usa_contrato', (select jsonb_agg(jsonb_build_object('val',usa_contrato,'n',n) order by n desc) from (select usa_contrato,count(*) n from base where usa_contrato is not null group by 1 order by 2 desc) d),
    'risco', (select jsonb_agg(jsonb_build_object('val',nivel_risco,'n',n) order by ordem) from (
        select nivel_risco, count(*) n, case nivel_risco when 'Altíssimo' then 1 when 'Alto' then 2 when 'Médio' then 3 when 'Baixo' then 4 else 5 end ordem
        from base where nivel_risco is not null group by 1) d),
    'intencao', (select jsonb_agg(jsonb_build_object('val',quer_modelos,'n',n) order by n desc) from (select quer_modelos,count(*) n from base where quer_modelos is not null group by 1 order by 2 desc) d),
    'dispositivo', (select jsonb_agg(jsonb_build_object('val',tipo,'n',n) order by n desc) from (
        select case when device_platform ~* 'iphone|ipad|android|arm|mobile' then 'Celular'
                    when device_platform is null or device_platform='' then 'Não informado' else 'Computador' end tipo,
               count(*) n from base group by 1) d),

    'campanhas', (select jsonb_agg(jsonb_build_object('val',campanha,'n',n) order by n desc) from (
        select coalesce(nullif(utm_campaign,''),'(sem UTM)') campanha, count(*) n from base where completou_lead group by 1 order by 2 desc limit 8) c),

    'conversao_resposta', (select jsonb_agg(jsonb_build_object('val',usa_contrato,'total',total,'leads',leads) order by total desc) from (
        select usa_contrato, count(*) total, count(*) filter (where completou_lead) leads from base where usa_contrato is not null group by 1) d),

    'chegada_dia', (select jsonb_agg(jsonb_build_object('dow',dow,'n',n) order by dow) from (
        select extract(dow from created_at)::int dow, count(*) n from base where created_at is not null group by 1) d),
    'chegada_hora', (select jsonb_agg(jsonb_build_object('hora',hora,'n',n) order by hora) from (
        select extract(hour from created_at)::int hora, count(*) n from base where created_at is not null group by 1) d),

    'cross_contrato_area', (select jsonb_agg(jsonb_build_object('area',area_atuacao,'usa',usa_contrato,'n',n)) from (
        select area_atuacao, usa_contrato, count(*) n from base where area_atuacao is not null and usa_contrato is not null group by 1,2) d),
    'cross_dor_sentimento', (select jsonb_agg(jsonb_build_object('dor',dor,'sent',sent,'n',n) order by n desc) from (
        select d dor, s sent, count(*) n from base, unnest(situacoes) d, unnest(sentimentos) s group by 1,2 order by 3 desc limit 8) x),
    'cross_risco_intencao', (select jsonb_agg(jsonb_build_object('risco',nivel_risco,'intencao',quer_modelos,'n',n)) from (
        select nivel_risco, quer_modelos, count(*) n from base where nivel_risco is not null and quer_modelos is not null group by 1,2) d),

    'contradicao', (select jsonb_build_object(
        'total_usa_sempre', count(*) filter (where usa_contrato='Sim, sempre'),
        'contradizem', count(*) filter (where usa_contrato='Sim, sempre' and ('Nenhum deles' = any(temas_dominados) or tipo_contrato_atual='Um textão em Word e nem sei se me protege.'))
      ) from base),

    'lacuna_prof', (select jsonb_agg(jsonb_build_object('grupo',profissionalizacao,'total',total,'nenhum',nenhum) order by total desc) from (
        select profissionalizacao, count(*) total, count(*) filter (where 'Nenhum deles' = any(temas_dominados)) nenhum
        from base where profissionalizacao is not null group by 1) d),

    'abandono_perfil', (select jsonb_agg(jsonb_build_object('area',area_atuacao,'total',total,'leads',leads) order by total desc) from (
        select area_atuacao, count(*) total, count(*) filter (where completou_lead) leads from base where area_atuacao is not null group by 1) d),

    'dores_por_area', (select jsonb_agg(jsonb_build_object('area',area,'dor',dor,'n',n)) from (
        select area, dor, n from (
          select area_atuacao area, d dor, count(*) n, row_number() over(partition by area_atuacao order by count(*) desc) rn
          from base, unnest(situacoes) d where area_atuacao is not null group by 1,2) z where rn<=4) d),

    'evolucao_risco', (select jsonb_agg(jsonb_build_object('mes',mes,'total',total,'alto',alto) order by mes) from (
        select to_char(date_trunc('month',created_at),'YYYY-MM') mes, count(*) total,
               count(*) filter (where nivel_risco in ('Alto','Altíssimo')) alto
        from base where created_at is not null group by 1) d),

    'campanha_qualidade', (select jsonb_agg(jsonb_build_object('campanha',campanha,'leads',leads,'alto',alto) order by leads desc) from (
        select coalesce(nullif(utm_campaign,''),'(sem UTM)') campanha, count(*) filter (where completou_lead) leads,
               count(*) filter (where completou_lead and nivel_risco in ('Alto','Altíssimo')) alto
        from base where utm_campaign is not null group by 1 having count(*) filter (where completou_lead) > 0 order by 2 desc limit 8) d)
  );
$$;

alter function quiz_funis_dashboard(date, date) set statement_timeout = 30000;
