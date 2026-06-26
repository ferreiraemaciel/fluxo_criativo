-- Adiciona preco_oferta: preço base do produto sem juros de parcelamento
-- Executa no Supabase SQL Editor

ALTER TABLE vendas ADD COLUMN IF NOT EXISTS preco_oferta NUMERIC(10,2);
ALTER TABLE ads    ADD COLUMN IF NOT EXISTS referencia    TEXT;

-- Após rodar esta migration, execute:
--   python3 scripts/sync_hotmart.py --all
-- para re-sincronizar as vendas e popular o campo preco_oferta.
