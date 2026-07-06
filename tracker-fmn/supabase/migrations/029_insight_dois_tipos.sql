-- Migration 029: dois tipos de insight (regra | claude) + fuso 9h Brasil (12:00 UTC)
alter table quiz_insights add column if not exists fonte text not null default 'regra';
alter table quiz_insights drop constraint if exists quiz_insights_dia_key;
alter table quiz_insights drop constraint if exists quiz_insights_dia_fonte_key;
alter table quiz_insights add constraint quiz_insights_dia_fonte_key unique (dia, fonte);

-- função do insight por regra agora grava fonte='regra'
create or replace function gerar_insight_quiz() returns void language plpgsql as $$
declare d int := extract(doy from current_date)::int % 5; v int; titulo text; gancho text; detalhe text;
begin
  if d = 0 then
    select round(100.0*count(*) filter (where 'Nenhum deles'=any(temas_dominados))/nullif(count(*),0)) into v from quiz_leads;
    titulo := 'A maioria não domina nenhum tema jurídico (e nem percebe)';
    detalhe := v||'% dos que responderam não dominam nenhum tema jurídico.';
    gancho := 'Reels: "Você assina contrato, mas sabe o que está assinando?" Revele que '||v||'% admitem não dominar nenhum tema jurídico e mostre os 3 mais ignorados.';
  elsif d = 1 then
    select round(100.0*count(*) filter (where usa_contrato='Nunca, acho que não preciso.')/nullif(count(*) filter (where usa_contrato is not null),0)) into v from quiz_leads;
    titulo := 'Tem fotógrafo trabalhando sem contrato nenhum';
    detalhe := v||'% dizem que NUNCA usam contrato.';
    gancho := 'Reels: 3 trabalhos que viraram dor de cabeça por falta de contrato. '||v||'% dos fotógrafos ainda não usam.';
  elsif d = 2 then
    select round(100.0*count(*) filter (where custo_processo='Não faço ideia, mas espero nunca descobrir.')/nullif(count(*) filter (where custo_processo is not null),0)) into v from quiz_leads;
    titulo := 'Ninguém sabe quanto custa um processo (até levar um)';
    detalhe := v||'% não fazem ideia de quanto custa um processo por erro.';
    gancho := 'Reels: mostre um caso real de fotógrafo condenado e pergunte "quanto você acha que custa?". '||v||'% não fazem ideia.';
  elsif d = 3 then
    select round(100.0*count(*) filter (where usa_contrato='Sim, sempre' and ('Nenhum deles'=any(temas_dominados) or tipo_contrato_atual='Um textão em Word e nem sei se me protege.'))/nullif(count(*) filter (where usa_contrato='Sim, sempre'),0)) into v from quiz_leads;
    titulo := 'A falsa sensação de proteção';
    detalhe := v||'% dos que dizem "uso contrato sempre" usam só um Word ou não dominam nada.';
    gancho := 'Reels: "Usar contrato não é o mesmo que estar protegido." '||v||'% dos que acham que estão, não estão.';
  else
    select round(100.0*count(*) filter (where nivel_risco in ('Alto','Altíssimo'))/nullif(count(*) filter (where nivel_risco is not null),0)) into v from quiz_leads;
    titulo := 'A maioria está em risco alto (e dá pra reverter)';
    detalhe := v||'% dos fotógrafos estão em nível de risco alto ou altíssimo.';
    gancho := 'Reels: o raio-x do fotógrafo desprotegido. '||v||'% estão em risco alto. Mostre os 3 erros que colocam ali.';
  end if;
  insert into quiz_insights(dia,fonte,titulo,gancho,detalhe,formato) values (current_date,'regra',titulo,gancho,detalhe,'Reels')
  on conflict (dia,fonte) do update set titulo=excluded.titulo, gancho=excluded.gancho, detalhe=excluded.detalhe;
end $$;

-- reagendar para 9h do Brasil (12:00 UTC)
select cron.unschedule('insight-quiz-diario');
select cron.schedule('insight-quiz-diario','0 12 * * *','select gerar_insight_quiz();');
