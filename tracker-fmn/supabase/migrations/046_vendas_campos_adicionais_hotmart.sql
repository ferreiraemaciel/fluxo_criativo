-- Migração 046: 3 campos que a Hotmart já envia no payload do webhook mas
-- não eram extraídos (achado na auditoria de dados de 2026-07-04):
--   - numero do endereço (buyer.address.number) — hoje só temos a rua
--   - transação pai do order bump — hoje só sabemos que É bump, não de qual venda
--   - valor do desconto de cupom — hoje só temos o código do cupom, não o valor

alter table vendas add column if not exists comprador_numero text;
alter table vendas add column if not exists order_bump_parent_transaction text;
alter table vendas add column if not exists desconto_cupom numeric;
