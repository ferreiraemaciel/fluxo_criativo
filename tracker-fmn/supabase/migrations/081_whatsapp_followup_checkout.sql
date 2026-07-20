-- Migration 081: acompanhamento automático 30min depois de mandar o link de
-- checkout. checkout_enviado_em marca quando o link mais recente saiu;
-- checkout_followup_enviado_para guarda pra qual desses envios já mandamos o
-- acompanhamento (permite reenviar de novo se um NOVO link sair depois).
alter table whatsapp_contatos add column if not exists checkout_enviado_em timestamptz;
alter table whatsapp_contatos add column if not exists checkout_followup_enviado_para timestamptz;
