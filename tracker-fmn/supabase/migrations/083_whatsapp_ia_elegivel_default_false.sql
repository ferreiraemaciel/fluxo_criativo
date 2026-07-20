-- Migration 083: reverte o default de ia_elegivel pra false. A migration 077
-- mudou pra true achando que era "ativar pra todos", mas isso fazia todo
-- contato NOVO nascer elegível pra IA sozinho, sem aprovação manual. A partir
-- de agora, elegibilidade é sempre opt-in por contato (via botão no Tracker).
alter table whatsapp_contatos alter column ia_elegivel set default false;
