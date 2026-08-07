-- Migration 102: agenda o meta-publicos-sync 1x por semana.
--
-- Manda os compradores aprovados pro público personalizado do Meta, mantendo o
-- público (e o semelhante 1% ancorado nele) atualizado sem ninguém lembrar de
-- apertar botão.
--
-- O corpo vai vazio de propósito: a função resolve o público alvo e o filtro de
-- produto lendo a chave `meta_publico_compradores` em `app_config`. Trocar o
-- público alvo é um UPDATE naquela linha, não exige mexer nesta migration nem
-- redeployar a função.
--
-- Segunda-feira às 08:00 UTC (05:00 em Brasília), fora do horário das outras
-- rotinas pesadas (meta-sync às 04:00, kanban-sync às 05:00 e 06:00).

create or replace function trigger_meta_publicos_sync()
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
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/meta-publicos-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{"action":"atualizar"}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

select cron.unschedule('meta-publicos-sync')
where exists (select 1 from cron.job where jobname = 'meta-publicos-sync');

select cron.schedule(
  'meta-publicos-sync',
  '0 8 * * 1',
  $$select trigger_meta_publicos_sync()$$
);
