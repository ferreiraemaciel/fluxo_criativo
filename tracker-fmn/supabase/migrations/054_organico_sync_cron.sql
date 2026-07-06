-- Migration 054: agenda a sincronização diária de métricas orgânicas.
-- Mesmo padrão do meta-sync (044): função wrapper lê o token do Vault
-- (nunca em texto neste arquivo) e chama a Edge Function via pg_net.
-- Roda 1x/dia; limit alto o bastante pra cobrir qualquer post novo do dia
-- e re-capturar métricas dos posts mais recentes (que ainda evoluem).

create or replace function trigger_organico_sync()
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
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/organico-sync?limit=50',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
end;
$$;

select cron.unschedule('sync-organico')
where exists (select 1 from cron.job where jobname = 'sync-organico');

-- 1x/dia às 5h30 de Brasília (08:30 UTC), depois dos syncs de anúncio/kanban
-- (07h e 08h), pra não competir pelo rate limit do Meta no mesmo instante.
select cron.schedule(
  'sync-organico',
  '30 8 * * *',
  $$select trigger_organico_sync()$$
);
