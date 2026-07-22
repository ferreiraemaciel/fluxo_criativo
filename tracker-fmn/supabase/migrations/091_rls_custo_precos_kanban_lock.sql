-- Migration 091: fecha custo_precos e kanban_sync_lock pra "somente
-- autenticado" (mesmo padrão da 028). Hoje qualquer um com a chave pública
-- (anon) conseguia ler/escrever/apagar essas duas tabelas sem estar logado.
-- Nenhum frontend lê essas tabelas direto (só Edge Functions com service
-- role, que ignora RLS), então travar não quebra nada.
do $$
declare t text;
begin
  foreach t in array array['custo_precos', 'kanban_sync_lock'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists dev_acesso_total on public.%I', t);
    execute format('drop policy if exists anon_all on public.%I', t);
    execute format('drop policy if exists tracker_auth_all on public.%I', t);
    execute format('create policy tracker_auth_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
