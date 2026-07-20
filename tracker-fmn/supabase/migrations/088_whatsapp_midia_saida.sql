-- Migration 088: permite enviar foto/vídeo/documento pro lead (até então só
-- áudio de entrada tinha suporte). Reaproveita a coluna midia_url e o bucket
-- whatsapp-media já criados na 086.
alter table whatsapp_mensagens drop constraint if exists whatsapp_mensagens_tipo_check;
alter table whatsapp_mensagens add constraint whatsapp_mensagens_tipo_check
  check (tipo in ('template', 'texto', 'botao', 'audio', 'imagem', 'video', 'documento'));
