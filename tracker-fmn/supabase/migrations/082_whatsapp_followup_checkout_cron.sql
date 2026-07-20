-- Migration 082: agenda o whatsapp-followup-checkout a cada 5 minutos.
create or replace function trigger_whatsapp_followup_checkout()
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
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/whatsapp-followup-checkout',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

select cron.unschedule('whatsapp-followup-checkout')
where exists (select 1 from cron.job where jobname = 'whatsapp-followup-checkout');

select cron.schedule(
  'whatsapp-followup-checkout',
  '*/5 * * * *',
  $$select trigger_whatsapp_followup_checkout()$$
);
