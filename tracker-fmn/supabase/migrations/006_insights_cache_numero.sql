-- Adiciona ads_numero à insights_cache para filtro direto por ADS local
ALTER TABLE insights_cache ADD COLUMN IF NOT EXISTS ads_numero int;
CREATE INDEX IF NOT EXISTS idx_insights_cache_ads_numero ON insights_cache(ads_numero);
CREATE INDEX IF NOT EXISTS idx_insights_cache_periodo ON insights_cache(periodo);
