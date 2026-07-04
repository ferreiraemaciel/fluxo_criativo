-- Migration 044: restaura SECURITY DEFINER em quiz_funis_dashboard.
-- A migration 032 recriou a função com CREATE OR REPLACE sem repetir
-- SECURITY DEFINER, e o Postgres reverte silenciosamente para SECURITY
-- INVOKER quando essa clausula nao e repetida. Como quiz_leads so libera
-- leitura para o papel authenticated (migrations 026/027), a chave publica
-- (usada pelo Claudinho e por qualquer chamada externa sem login) passou
-- a receber a funcao zerada desde a migration 032.
alter function quiz_funis_dashboard(date, date) security definer;
alter function quiz_funis_dashboard(date, date) set search_path = public, pg_temp;
