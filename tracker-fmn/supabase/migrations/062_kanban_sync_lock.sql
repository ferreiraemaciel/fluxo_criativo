-- Migração 062: trava de execução pra kanban-sync scope=maximo (2026-07-10).
-- Descoberto ao testar: duas execuções da varredura pesada rodando ao mesmo
-- tempo (2 chamadas manuais próximas, ou uma manual sobrepondo o agendamento
-- automático) fazem os agregados de vida inteira (vendas_total/cpa_historico/
-- gasto_total) se sobrescreverem um ao outro fora de ordem, e a classificação
-- do Kanban pode decidir em cima de um valor intermediário/errado. O dado do
-- Meta em si é estável (confirmado) — o problema é duas execuções concorrentes
-- escrevendo na mesma linha. Trava simples de linha única: só deixa rodar a
-- varredura pesada se a trava estiver livre ou expirada (10 min sem concluir
-- = provavelmente travou/caiu, libera sozinha).
create table if not exists kanban_sync_lock (
  id int primary key default 1,
  running_since timestamptz,
  constraint kanban_sync_lock_single_row check (id = 1)
);
insert into kanban_sync_lock (id, running_since) values (1, null)
on conflict (id) do nothing;
