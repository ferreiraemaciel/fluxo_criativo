-- Adiciona coluna media_files (array JSON com todos os arquivos do AD)
-- Executa no Supabase SQL Editor

ALTER TABLE ads ADD COLUMN IF NOT EXISTS media_files JSONB DEFAULT '[]'::jsonb;

-- Índice para buscas futuras
CREATE INDEX IF NOT EXISTS idx_ads_media_files ON ads USING GIN (media_files);
