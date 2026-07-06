-- Migration 028: tranca as tabelas do Tracker para "somente usuário autenticado".
-- Remove acesso da chave pública (anon). Não toca tabelas de outros apps
-- (contests, contest_photos, site_settings). Service role continua bypassando RLS.
do $$
declare t text; k char;
begin
  foreach t in array array[
    'ads','vendas','ideias','insights_cache','conteudo_organico','despesas','config',
    'sync_status','quiz_insights','produtos','gasto_diario','alertas','recuperacao_vendas',
    'campanhas','impostos','regras_atp','configuracoes','abandono_carrinho'
  ] loop
    if to_regclass('public.'||t) is null then continue; end if;
    select relkind into k from pg_class where oid = ('public.'||t)::regclass;
    if k = 'r' then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists dev_acesso_total on public.%I', t);
      execute format('drop policy if exists anon_all on public.%I', t);
      execute format('drop policy if exists "acesso total" on public.%I', t);
      execute format('drop policy if exists quiz_insights_acesso_total on public.%I', t);
      execute format('drop policy if exists tracker_auth_all on public.%I', t);
      execute format('create policy tracker_auth_all on public.%I for all to authenticated using (true) with check (true)', t);
    elsif k = 'v' then
      execute format('alter view public.%I set (security_invoker = on)', t);
    end if;
  end loop;
end $$;
