-- Migration 040: publicação de anúncios no Meta a partir do Tracker
--
-- Guarda os IDs das entidades criadas no Meta e o status de publicação.
-- Fluxo: o Tracker cria campanha/conjunto/anúncio sempre PAUSADOS.
--   meta_publish_status = 'rascunho' → criado no Meta, ainda pausado
--   meta_publish_status = 'ativo'    → ativado (via "Ativar tudo no Meta")
-- O botão de aprovação em massa liga tudo que estiver em 'rascunho'.
--
-- meta_ad_url já pode existir de fluxos antigos; mantido.

ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS meta_campaign_id    text,
  ADD COLUMN IF NOT EXISTS meta_adset_id       text,
  ADD COLUMN IF NOT EXISTS meta_ad_id          text,
  ADD COLUMN IF NOT EXISTS meta_ad_url         text,
  ADD COLUMN IF NOT EXISTS meta_publish_status text;
