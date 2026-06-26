-- Taxa cobrada pela Hotmart por transação
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS hotmart_fee numeric(10,2);
