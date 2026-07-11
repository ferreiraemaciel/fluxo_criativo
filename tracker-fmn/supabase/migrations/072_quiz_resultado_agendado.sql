-- Migration 072: resultado do quiz vira agendado (+5min) em vez de imediato,
-- pra dar tempo de checar se o lead já comprou antes de mandar o WhatsApp.
alter table quiz_leads add column if not exists resultado_agendado_para timestamptz;

create index if not exists quiz_leads_resultado_pendente_idx
  on quiz_leads (resultado_agendado_para)
  where completou_quiz = true and whatsapp_resultado_enviado = false;
