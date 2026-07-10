-- Migration 067: marca se o lead já recebeu o WhatsApp com o resultado do
-- quiz, pra não reenviar em upserts repetidos do mesmo code.
alter table quiz_leads add column if not exists whatsapp_resultado_enviado boolean not null default false;
