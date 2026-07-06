-- Migration 019: campos de resultado calculados pela vitrine do quiz
alter table quiz_leads add column if not exists perfil text;
alter table quiz_leads add column if not exists nivel_risco text;
