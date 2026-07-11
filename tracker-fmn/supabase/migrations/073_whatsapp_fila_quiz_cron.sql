-- Migration 073: agenda o whatsapp-fila-quiz a cada 1 minuto. Mesmo padrão
-- das outras Edge Functions agendadas (hotmart-backfill, meta-sync etc).
create or replace function trigger_whatsapp_fila_quiz()
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
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/whatsapp-fila-quiz',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;

select cron.unschedule('whatsapp-fila-quiz')
where exists (select 1 from cron.job where jobname = 'whatsapp-fila-quiz');

select cron.schedule(
  'whatsapp-fila-quiz',
  '* * * * *',
  $$select trigger_whatsapp_fila_quiz()$$
);
