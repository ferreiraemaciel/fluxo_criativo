-- Migration 078: agenda o whatsapp-arquivar-perdidos a cada 15 minutos.
create or replace function trigger_whatsapp_arquivar_perdidos()
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
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/whatsapp-arquivar-perdidos',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.unschedule('whatsapp-arquivar-perdidos')
where exists (select 1 from cron.job where jobname = 'whatsapp-arquivar-perdidos');

select cron.schedule(
  'whatsapp-arquivar-perdidos',
  '*/15 * * * *',
  $$select trigger_whatsapp_arquivar_perdidos()$$
);
