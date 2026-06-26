-- Adiciona e-mail do comprador à tabela vendas (sempre disponível na Hotmart)
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comprador_email text;
