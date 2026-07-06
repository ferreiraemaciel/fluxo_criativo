-- Adiciona campo para armazenar URLs das imagens do carrossel (R2 ou outro CDN)
-- Formato: JSON array de strings ["https://...", "https://..."]
ALTER TABLE conteudo_organico
  ADD COLUMN IF NOT EXISTS media_files text;
