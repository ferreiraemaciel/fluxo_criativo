-- Migration 036: campos de mídia R2 na tabela ads
-- thumb_url  : URL pública do thumbnail/imagem otimizada no R2 (permanente)
-- media_url  : URL pública do vídeo comprimido ou imagem (playback no tracker)
-- meta_image_hash : hash retornado pelo Meta após upload de imagem
-- meta_video_id   : ID retornado pelo Meta após upload de vídeo
--
-- Lógica de migração:
--   thumb_url IS NULL  → fluxo antigo (Drive) — pendente migração
--   thumb_url NOT NULL → fluxo novo  (R2)     — migrado

ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS thumb_url        text,
  ADD COLUMN IF NOT EXISTS media_url        text,
  ADD COLUMN IF NOT EXISTS meta_image_hash  text,
  ADD COLUMN IF NOT EXISTS meta_video_id    text;
