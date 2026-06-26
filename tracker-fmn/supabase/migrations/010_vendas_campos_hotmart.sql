-- Migration 010: Adicionar campos Hotmart que estavam sendo descartados
-- parcelas, oferta, order_bump, CEP, datas reais da compra

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS parcelas              integer,
  ADD COLUMN IF NOT EXISTS oferta_codigo         text,
  ADD COLUMN IF NOT EXISTS oferta_nome           text,
  ADD COLUMN IF NOT EXISTS is_order_bump         boolean default false,
  ADD COLUMN IF NOT EXISTS comprador_cep         text,
  ADD COLUMN IF NOT EXISTS hotmart_order_date    timestamptz,
  ADD COLUMN IF NOT EXISTS hotmart_approved_date timestamptz;

-- Índice para análise por oferta (útil em testes A/B)
CREATE INDEX IF NOT EXISTS idx_vendas_oferta ON vendas (oferta_codigo)
  WHERE oferta_codigo IS NOT NULL;
