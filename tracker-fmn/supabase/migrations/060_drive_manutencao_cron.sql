-- Migração 060: move para a nuvem a manutenção de pastas do Drive (2026-07-10).
-- Portado de scripts/drive_sync_pastas.py + scripts/drive_organizar.py, que só
-- rodavam no Mac dentro do botão "Sincronizar" (descontinuado nesta mesma
-- mudança — usuário pediu pra tirar tudo que depende do Mac estar ligado).
-- Reaproveita o secret do Vault criado na migração 044 (tracker_service_role_key).

create or replace function trigger_drive_manutencao()
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
    url     := 'https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/drive-manutencao',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
end;
$$;

select cron.unschedule('drive-manutencao')
where exists (select 1 from cron.job where jobname = 'drive-manutencao');

-- A cada 30 minutos: cria pasta pra anúncio novo e organiza arquivo solto.
-- Não é tão urgente quanto status/insights, por isso frequência menor.
select cron.schedule(
  'drive-manutencao',
  '*/30 * * * *',
  $$select trigger_drive_manutencao()$$
);
