-- Migração 044: corrige o cron do meta-sync.
-- 1) O pg_cron chamava a Edge Function sem cabeçalho de autenticação, e a
--    plataforma passou a exigir JWT — toda chamada agendada vinha recebendo
--    401 e não fazia nada. O valor de autenticação fica no Vault (nunca em
--    texto neste arquivo), lido em tempo de execução pela função abaixo.
-- 2) Separa a varredura em dois escopos: "curtas" (hoje/3d/5d/7d/14d/30d +
--    gasto_diario + alertas G5) a cada 6h, e "maximo" (vida inteira, mais
--    pesada) 1x/dia de madrugada.

create or replace function trigger_meta_sync(p_scope text default 'curtas')
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
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/meta-sync?scope=' || p_scope,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb
  );
end;
$$;

-- Remove agendamentos anteriores se existirem
select cron.unschedule('sync-meta-ads')
where exists (select 1 from cron.job where jobname = 'sync-meta-ads');

select cron.unschedule('sync-meta-ads-maximo')
where exists (select 1 from cron.job where jobname = 'sync-meta-ads-maximo');

-- Curtas: 00h, 06h, 12h, 18h horário de Brasília (03,09,15,21 UTC)
select cron.schedule(
  'sync-meta-ads',
  '0 3,9,15,21 * * *',
  $$select trigger_meta_sync('curtas')$$
);

-- Máximo (vida inteira, mais pesado): 1x/dia às 4h de Brasília (07 UTC)
select cron.schedule(
  'sync-meta-ads-maximo',
  '0 7 * * *',
  $$select trigger_meta_sync('maximo')$$
);
