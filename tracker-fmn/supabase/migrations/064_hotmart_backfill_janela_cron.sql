-- Migration 064: ajusta o agendamento do hotmart-backfill pra já não disparar
-- fora da janela útil (06h-23h59 Brasília). Antes o cron rodava */15 * * * *
-- o dia inteiro e a função decidia internamente sair sem fazer nada de
-- madrugada (00h-06h Brasília) — 24 disparos por dia inteiramente ociosos.
-- Agora o próprio cron já não agenda nesse intervalo. A checagem de horário
-- dentro da função (horaBrasilia()) continua existindo como segunda camada
-- de segurança, não foi removida.
--
-- 06h-23h59 Brasília (UTC-3) = 09:00-02:59 UTC. Expressão de hora cobre
-- 9,10,...,23,0,1,2 (a virada de dia em UTC fica dentro da janela).

select cron.unschedule('hotmart-backfill')
where exists (select 1 from cron.job where jobname = 'hotmart-backfill');

select cron.schedule(
  'hotmart-backfill',
  '*/15 9-23,0-2 * * *',
  $$select trigger_hotmart_backfill()$$
);
