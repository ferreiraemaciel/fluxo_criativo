-- Adiciona campos geográficos na tabela vendas
-- Rodar no Supabase SQL Editor

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comprador_estado text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comprador_cidade text;

-- Cria índice para queries no mapa
CREATE INDEX IF NOT EXISTS idx_vendas_geo ON vendas (comprador_pais, comprador_estado, comprador_cidade);
