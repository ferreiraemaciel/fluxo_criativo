-- Migration 056: agenda o hotmart-backfill (Edge Function) a cada 15 minutos.
-- Substitui o worker Cloudflare hotmart-sync, que ficava recebendo 400 da
-- Hotmart (suspeita de WAF/anti-bot reagindo ao Workers). Mesmo padrão do
-- meta-sync (044) e organico-sync (054): função wrapper lê o token do Vault,
-- chama a Edge Function via pg_net. A janela de horário (06h-23:59 Brasília)
-- já é decidida dentro da própria função — o cron roda o dia todo, a função
-- decide se executa ou só devolve "fora da janela".

create or replace function trigger_hotmart_backfill()
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
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/hotmart-backfill',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
end;
$$;

select cron.unschedule('hotmart-backfill')
where exists (select 1 from cron.job where jobname = 'hotmart-backfill');

select cron.schedule(
  'hotmart-backfill',
  '*/15 * * * *',
  $$select trigger_hotmart_backfill()$$
);
