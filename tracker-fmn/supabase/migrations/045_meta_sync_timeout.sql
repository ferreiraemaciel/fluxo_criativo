-- Migração 045: o pg_net tem timeout padrão de 5s no net.http_post, mas o
-- escopo "curtas" da meta-sync (6 períodos × ads ativos, chamadas sequenciais
-- ao Meta) mede ~16s. A chamada do cron expirava por timeout antes mesmo de a
-- função terminar, mascarado como "sem erro" (perform não aguarda resposta).
-- Ajusta para 30s de margem confortável.

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
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
