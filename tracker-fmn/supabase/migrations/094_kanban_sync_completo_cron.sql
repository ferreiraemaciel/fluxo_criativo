-- Migration 094: agenda o scope=completo do kanban-sync pra rodar sozinho
-- todo dia, de madrugada. Antes só rodava manual -- o cron diário
-- (kanban-sync-maximo) só recalcula quem está ATIVO agora, então card
-- arquivado podia ficar com numero congelado por muito tempo (achado real
-- em 2026-07-25: ADS 87 mostrava 5 vendas/CPA R$827 quando o real, contra
-- o Meta, era 33 vendas/CPA R$125 -- tag/coluna errada por meses).

select cron.unschedule('kanban-sync-completo')
where exists (select 1 from cron.job where jobname = 'kanban-sync-completo');

-- 1h depois do kanban-sync-maximo (5h Brasília / 08 UTC), pra não competir
-- pelo rate limit do Meta no mesmo instante.
select cron.schedule(
  'kanban-sync-completo',
  '0 9 * * *',
  $$select trigger_kanban_sync('completo')$$
);
