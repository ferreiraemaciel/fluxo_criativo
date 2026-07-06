-- Migration 027: trava total da quiz_leads. Escrita só via Edge Function (service role).
-- A chave pública não lê e não grava direto. Leitura crua só para usuário autenticado.
drop policy if exists quiz_leads_write_insert on quiz_leads;
drop policy if exists quiz_leads_write_update on quiz_leads;
-- permanece apenas: quiz_leads_auth_read (SELECT to authenticated)
