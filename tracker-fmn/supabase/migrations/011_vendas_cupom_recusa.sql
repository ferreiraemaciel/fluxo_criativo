-- Migration 011: cupom aplicado e motivo de recusa de cartão
ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS cupom_codigo   text,
  ADD COLUMN IF NOT EXISTS motivo_recusa  text;
