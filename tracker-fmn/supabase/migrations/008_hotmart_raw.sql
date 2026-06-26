-- Migration 008: adicionar coluna hotmart_raw para guardar payload completo da Hotmart
-- Rodar no SQL Editor do Supabase: https://supabase.com/dashboard/project/_/sql

ALTER TABLE vendas
  ADD COLUMN IF NOT EXISTS hotmart_raw jsonb;
