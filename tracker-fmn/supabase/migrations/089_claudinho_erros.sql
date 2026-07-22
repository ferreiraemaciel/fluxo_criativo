-- Migration 089: log de erros do Claudinho (etapa de treinamento). Registro
-- histórico dos erros encontrados na revisão manual, pra medir se a taxa cai
-- de verdade ao longo do tempo (não substitui melhorar o prompt, é a camada
-- que mede se as melhorias funcionam). Temporário: útil enquanto o modo
-- treinamento estiver ativo, pode ser removido depois que ele desligar.
create table if not exists claudinho_erros (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  telefone text,
  situacao text not null,
  erro text not null,
  correcao text,
  status text not null default 'corrigido' check (status in ('corrigido', 'pendente', 'reincidencia')),
  created_at timestamptz not null default now()
);

alter table claudinho_erros enable row level security;
drop policy if exists tracker_auth_all on claudinho_erros;
create policy tracker_auth_all on claudinho_erros for all to authenticated using (true) with check (true);
