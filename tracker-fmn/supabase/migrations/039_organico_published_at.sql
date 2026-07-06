-- Guarda o horário real em que o post foi publicado (agendado ou imediato),
-- pra exibir no calendário mesmo depois de status virar 'Feito'.
ALTER TABLE conteudo_organico
  ADD COLUMN IF NOT EXISTS published_at timestamptz;
