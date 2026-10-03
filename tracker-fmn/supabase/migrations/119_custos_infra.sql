-- Custos de infraestrutura do Blindagem/Khronus/Kairós (03/10/2026). Aplicado pelo MCP.
create table if not exists public.custos_infra (
  id uuid primary key default gen_random_uuid(),
  dia date not null, servico text not null, quantidade numeric, unidade text,
  valor_usd numeric not null default 0, valor_brl numeric not null default 0,
  fonte text not null default 'medido' check (fonte in ('medido','fatura')),
  detalhe jsonb, criado_em timestamptz not null default now(),
  unique (dia, servico, fonte)
);
alter table public.custos_infra enable row level security;
create policy custos_infra_leitura on public.custos_infra for select to authenticated using (true);
create policy custos_infra_fatura on public.custos_infra for all to authenticated using (fonte = 'fatura') with check (fonte = 'fatura');
insert into public.app_config (chave, valor) values ('infra_config', jsonb_build_object(
  'supabase_plano_usd', 25, 'supabase_maquina', 'Micro', 'supabase_maquina_usd', 10, 'supabase_credito_maquina_usd', 10,
  'workers_plano_usd', 5, 'alerta_projecao_brl', null)) on conflict (chave) do nothing;
-- trigger_custos_infra() + cron 'custos-infra' às 02:50 UTC (23h50 Brasília), mesmo padrão do vigia-sinais.
