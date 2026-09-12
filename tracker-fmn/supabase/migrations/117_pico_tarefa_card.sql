-- Liga a tarefa do pico ao card que ela virou, para dar clique de ida.
-- Antes disso o vínculo existia só como texto em entregavel_url ("Orgânico: titulo"),
-- que serve de aviso mas não abre nada. Com tipo e id guardados, a tarefa vira link.
alter table pico_tarefas
  add column if not exists card_tipo text,
  add column if not exists card_id   uuid;

comment on column pico_tarefas.card_tipo is
  'organico ou ads. Qual kanban guarda o card que nasceu desta tarefa.';
comment on column pico_tarefas.card_id is
  'id do card em conteudo_organico ou em ads. Sem chave estrangeira de propósito: card apagado não pode derrubar a tarefa.';

create index if not exists idx_pico_tarefas_card on pico_tarefas(card_id) where card_id is not null;
