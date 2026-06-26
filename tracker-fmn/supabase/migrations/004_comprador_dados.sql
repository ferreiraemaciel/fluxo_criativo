-- Migration 004: dados do comprador (nome e telefone para botão WhatsApp)
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comprador_nome     text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comprador_telefone text;

CREATE INDEX IF NOT EXISTS idx_vendas_comprador_tel ON vendas (comprador_telefone)
  WHERE comprador_telefone IS NOT NULL;
