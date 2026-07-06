-- Suporte a agendamento próprio (cron no Worker)
ALTER TABLE conteudo_organico
  ADD COLUMN IF NOT EXISTS scheduled_at    timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_media jsonb;
