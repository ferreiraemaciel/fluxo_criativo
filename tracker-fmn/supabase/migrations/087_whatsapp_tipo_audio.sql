-- Migration 087: adiciona "audio" na lista de tipos permitidos em
-- whatsapp_mensagens.tipo (esquecido na migration 086, que criou a coluna
-- midia_url mas não abriu o check constraint pro novo tipo).
alter table whatsapp_mensagens drop constraint if exists whatsapp_mensagens_tipo_check;
alter table whatsapp_mensagens add constraint whatsapp_mensagens_tipo_check
  check (tipo in ('template', 'texto', 'botao', 'audio'));
