-- Migration 085: data real em que o contato virou aluno (data da venda no
-- Hotmart), separada de updated_at (que muda por qualquer motivo, tipo
-- reenvio de boas-vindas atrasado, e contaminava a métrica de "fechados
-- recentes" com vendas antigas).
alter table whatsapp_contatos add column if not exists tornou_aluno_em timestamptz;
-- Backfill dos alunos existentes feito à parte via script (telefone tem
-- formatos inconsistentes entre vendas e whatsapp_contatos, mais seguro
-- normalizar em código do que em SQL puro).
