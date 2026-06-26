-- Migration 009: Expandir check constraint de status na tabela vendas
-- Adiciona: chargeback, protesto, recuperacao
-- Corrige erros 500 do webhook Hotmart para PURCHASE_CHARGEBACK, PURCHASE_PROTEST,
-- PURCHASE_ABANDONED e PURCHASE_OUT_OF_SHOPPING_CART

alter table vendas
  drop constraint if exists vendas_status_check;

alter table vendas
  add constraint vendas_status_check
  check (status in (
    'aprovada',
    'reembolsada',
    'pendente',
    'cancelada',
    'chargeback',
    'protesto',
    'recuperacao'
  ));
