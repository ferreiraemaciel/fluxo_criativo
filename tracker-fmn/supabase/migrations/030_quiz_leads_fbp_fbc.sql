-- Migration 030: colunas para cookies do Meta Pixel (fbp, fbc)
-- Usadas no CAPI para melhor matching de eventos (sem elas o match fica só em hash de email)
alter table quiz_leads add column if not exists fbp text;
alter table quiz_leads add column if not exists fbc text;
