-- Migration 068: tabela de contatos do WhatsApp, separada das mensagens.
-- Guarda a "etapa" de relacionamento (visão Kanban), atualizada manualmente
-- pelo time. As mensagens continuam em whatsapp_mensagens; aqui é só o
-- estado atual de cada telefone.

create table if not exists whatsapp_contatos (
  telefone    text primary key,
  nome        text,
  etapa       text not null default 'lead_novo'
                check (etapa in ('lead_novo','em_conversa','aluno','perdido')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table whatsapp_contatos enable row level security;

create policy whatsapp_contatos_service_role_all
  on whatsapp_contatos for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy whatsapp_contatos_authenticated_all
  on whatsapp_contatos for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
