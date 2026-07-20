-- Migration 084: trava contra duas respostas simultâneas do Claudinho no
-- mesmo contato. Quando duas mensagens do lead chegam quase juntas, cada
-- uma disparava seu próprio turno de IA em paralelo, gerando resposta
-- duplicada. Com essa trava, só uma roda por vez.
alter table whatsapp_contatos add column if not exists ia_processando boolean not null default false;
