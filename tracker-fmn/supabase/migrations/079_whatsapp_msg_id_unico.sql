-- Migration 079: trava de verdade contra duplicata de mensagem recebida.
-- A checagem "já processada?" antes do insert tem corrida (duas chamadas do
-- webhook quase simultâneas passam pela checagem antes de qualquer uma
-- gravar). Um índice único no banco resolve isso de vez: a segunda tentativa
-- de gravar o mesmo wa_message_id de entrada falha na hora, sem corrida.
create unique index if not exists whatsapp_mensagens_entrada_msgid_unico
  on whatsapp_mensagens (wa_message_id)
  where direcao = 'entrada' and wa_message_id is not null;
