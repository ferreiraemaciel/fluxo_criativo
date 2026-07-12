-- Migration 077: marcar contato como spam (some da Lista/Kanban/Métricas,
-- não recebe mais nada) e liberar o Claudinho pra todos os contatos.
alter table whatsapp_contatos add column if not exists is_spam boolean not null default false;

update whatsapp_contatos set ia_elegivel = true where ia_elegivel = false;
alter table whatsapp_contatos alter column ia_elegivel set default true;
