-- Migração 002: Cron job pg_cron para sincronizar Meta Ads a cada 6 horas

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Função wrapper: encapsula a chamada à Edge Function
create or replace function trigger_meta_sync()
returns void language plpgsql as $$
begin
  perform net.http_post(
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/meta-sync',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
end;
$$;

-- Remove job anterior se existir
select cron.unschedule('sync-meta-ads')
where exists (select 1 from cron.job where jobname = 'sync-meta-ads');

-- Cria job: 00h, 06h, 12h, 18h horário Brasília (UTC-3)
select cron.schedule(
  'sync-meta-ads',
  '0 3,9,15,21 * * *',
  'select trigger_meta_sync()'
);
