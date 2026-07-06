-- Migration 053: prévia visual e impulsionamento dos posts orgânicos
-- - media_url / thumbnail_url: imagem de prévia (foto usa media_url, vídeo/Reels usa thumbnail_url)
-- - impulsionado: true quando o post orgânico também foi usado como anúncio
--   (cruzamento com effective_instagram_media_id dos criativos da conta de anúncios)

alter table organico_metricas
  add column if not exists media_url     text,
  add column if not exists thumbnail_url text,
  add column if not exists impulsionado  boolean not null default false;
