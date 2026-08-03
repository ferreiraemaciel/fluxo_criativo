-- ============================================================
-- Prompt separado da Estética Visual (Imagem e slides de Carrossel).
-- Complementa 096_estrutura_roteiro_unificada.sql.
-- ============================================================

alter table ads
  add column if not exists prompt text;

comment on column ads.prompt is 'Prompt de geração de imagem, separado da Estética Visual (descrição de cena). Só Imagem e slides de Carrossel; Reels não usa.';
