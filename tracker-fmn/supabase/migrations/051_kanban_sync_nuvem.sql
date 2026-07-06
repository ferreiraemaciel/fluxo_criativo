-- Migração 051: move para a nuvem o que ainda dependia do Mac ficar ligado
-- (2026-07-05). Portado de scripts/sync_insights.py (sync_meta_ad_status,
-- agregados 3d/5d/maximo, permalinks, pausas automáticas) e
-- scripts/aplicar_regras.py (classificação do Kanban), agora como Edge
-- Functions kanban-sync e processar-pausas. Reaproveita o secret do Vault
-- criado na migração 044 (tracker_service_role_key), nenhum token novo aqui.

create or replace function trigger_kanban_sync(p_scope text default 'curtas')
returns void language plpgsql as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'tracker_service_role_key';

  if v_key is null then
    raise exception 'Secret tracker_service_role_key não encontrado no Vault';
  end if;

  perform net.http_post(
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/kanban-sync?scope=' || p_scope,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
end;
$$;

create or replace function trigger_processar_pausas()
returns void language plpgsql as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'tracker_service_role_key';

  if v_key is null then
    raise exception 'Secret tracker_service_role_key não encontrado no Vault';
  end if;

  perform net.http_post(
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/processar-pausas',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

-- Remove agendamentos anteriores se existirem (idempotente)
select cron.unschedule('kanban-sync-curtas')
where exists (select 1 from cron.job where jobname = 'kanban-sync-curtas');
select cron.unschedule('kanban-sync-maximo')
where exists (select 1 from cron.job where jobname = 'kanban-sync-maximo');
select cron.unschedule('processar-pausas')
where exists (select 1 from cron.job where jobname = 'processar-pausas');

-- Curtas (status do Meta + agregados 3d/5d + permalinks): a cada 15 minutos
select cron.schedule(
  'kanban-sync-curtas',
  '*/15 * * * *',
  $$select trigger_kanban_sync('curtas')$$
);

-- Máximo (varredura pesada de vida inteira + reclassificação do Kanban):
-- 1x/dia às 5h de Brasília (08 UTC), 1h depois do meta-sync maximo (07 UTC),
-- para não concorrer pelo rate limit do Meta no mesmo instante.
select cron.schedule(
  'kanban-sync-maximo',
  '0 8 * * *',
  $$select trigger_kanban_sync('maximo')$$
);

-- Pausas automáticas pendentes: a cada 5 minutos (protege orçamento, é reação
-- a alerta já computado, chamada leve).
select cron.schedule(
  'processar-pausas',
  '*/5 * * * *',
  $$select trigger_processar_pausas()$$
);
