-- Adiciona campo referencia em conteudo_organico
-- Preserva a referência (link ou arquivo) quando uma ideia é convertida para orgânico
ALTER TABLE conteudo_organico ADD COLUMN IF NOT EXISTS referencia TEXT;
