-- Migration 016: Adiciona período 'hoje' ao insights_cache
-- Permite sincronizar métricas do dia corrente por AD

ALTER TABLE insights_cache DROP CONSTRAINT IF EXISTS insights_cache_periodo_check;

ALTER TABLE insights_cache ADD CONSTRAINT insights_cache_periodo_check
  CHECK (periodo IN ('maximum','3d','5d','7d','14d','30d','hoje'));
