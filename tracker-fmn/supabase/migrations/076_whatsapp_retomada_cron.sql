-- Migration 076: agenda o whatsapp-retomada a cada 10 minutos.
create or replace function trigger_whatsapp_retomada()
returns void language plpgsql as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'tracker_service_role_key';

  if v_key is null then
    raise notice 'tracker_service_role_key não encontrado no Vault';
    return;
  end if;

  perform net.http_post(
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/whatsapp-retomada',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.unschedule('whatsapp-retomada')
where exists (select 1 from cron.job where jobname = 'whatsapp-retomada');

select cron.schedule(
  'whatsapp-retomada',
  '*/10 * * * *',
  $$select trigger_whatsapp_retomada()$$
);
