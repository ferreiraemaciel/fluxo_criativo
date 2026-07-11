-- Migration 074: escopo fino de quem a IA pode atender, além do toggle
-- geral. O toggle geral (app_config.whatsapp_ia_ativa) liga o "motor" da
-- IA; ia_elegivel decide quem especificamente ela pode responder. Default
-- false pra tudo, evitando repetir o susto de "ligou geral pra todo mundo".
alter table whatsapp_contatos add column if not exists ia_elegivel boolean not null default false;
