-- Migração 105: falha de publicação agendada deixa rastro no card (2026-08-10).
--
-- Motivo: quando a publicação agendada falhava, o robô escrevia o erro só no
-- log do Cloudflare (que nem estava sendo guardado) e devolvia o card pra
-- "Feito" com scheduled_at e scheduled_media zerados. O resultado ficava
-- IDÊNTICO a um card que nunca tinha sido agendado — impossível saber depois
-- se falhou, e por quê. Foi o que aconteceu com o ORG 039 em 2026-08-09.
--
-- Agora o motivo fica gravado no card, aparece como aviso vermelho no Kanban,
-- e é limpo quando o card é reagendado ou publicado com sucesso.
--
-- Reversão:
--   alter table conteudo_organico
--     drop column erro_publicacao, drop column erro_publicacao_em;

alter table conteudo_organico
  add column if not exists erro_publicacao text,
  add column if not exists erro_publicacao_em timestamptz;

comment on column conteudo_organico.erro_publicacao is
  'Motivo da última falha de publicação agendada. Limpo ao reagendar ou publicar com sucesso. Sem isso, falha some sem deixar rastro.';
