-- Migration 026: protege os dados pessoais do quiz da chave pública
-- A função de dashboard vira SECURITY DEFINER (devolve só agregados, sem PII).
alter function quiz_funis_dashboard(date, date) security definer;
alter function quiz_funis_dashboard(date, date) set search_path = public, pg_temp;

-- quiz_leads: a chave pública (anon) pode GRAVAR lead (vitrine), mas NÃO pode mais LER linhas.
drop policy if exists quiz_leads_acesso_total on quiz_leads;
drop policy if exists quiz_leads_anon_insert on quiz_leads;
drop policy if exists quiz_leads_anon_update on quiz_leads;
drop policy if exists quiz_leads_auth_read on quiz_leads;
create policy quiz_leads_anon_insert on quiz_leads for insert to anon with check (true);
create policy quiz_leads_anon_update on quiz_leads for update to anon using (true) with check (true);
create policy quiz_leads_auth_read   on quiz_leads for select to authenticated using (true);
