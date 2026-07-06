-- Adiciona campo destino à tabela ideias
-- Valores: 'Anúncio' | 'Orgânico'
ALTER TABLE ideias
  ADD COLUMN IF NOT EXISTS destino text DEFAULT 'Anúncio';
