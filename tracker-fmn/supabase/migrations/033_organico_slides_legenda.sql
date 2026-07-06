-- Adiciona colunas slides e legenda à tabela conteudo_organico
-- Usadas quando plataforma = 'Carrossel'
ALTER TABLE conteudo_organico
  ADD COLUMN IF NOT EXISTS slides    text,
  ADD COLUMN IF NOT EXISTS legenda   text;
