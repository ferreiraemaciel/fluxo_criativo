-- Migration 090: coluna pra guardar a transcrição do áudio recebido do lead
-- (via Groq/Whisper), pro Claudinho conseguir "ouvir" o que foi dito.
alter table whatsapp_mensagens add column if not exists transcricao text;
