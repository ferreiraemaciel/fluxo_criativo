-- Adiciona campo para prompt de imagem em posts do tipo Imagem/Reels/Stories
ALTER TABLE conteudo_organico
  ADD COLUMN IF NOT EXISTS prompt_imagem text;
