-- Migration 092: permite leitura de upsell_pageviews.
-- A tabela (migration 057) so tinha policy de INSERT pro anon, sem policy
-- de SELECT nenhuma. Resultado: o dashboard (que le com a mesma chave
-- anon/publishable da pagina) sempre via 0 linhas, mesmo com pageviews
-- reais gravados -- o card "Upsell Blindagem" mostrava "sem pageview
-- registrado ainda" por bug de permissao, nao por falta de rastreio.
-- Tabela nao guarda dado sensivel (so UTM/referrer), leitura publica e segura.

drop policy if exists "upsell_pageviews_select_anon" on upsell_pageviews;
create policy "upsell_pageviews_select_anon"
  on upsell_pageviews for select
  to anon
  using (true);
