-- Migração 096: guarda o link da pasta do card no Drive (2026-08-01).
--
-- Motivo: ao criar um card no Orgânico, o Tracker passa a criar sozinho a pasta
-- "ORG NNN Nome" na raiz do Drive. Guardando a URL aqui, o card ganha um atalho
-- direto pra pasta — o usuário cria o card, clica e já joga a arte lá dentro,
-- sem procurar no Drive.
--
-- A importação NÃO depende desta coluna: ela continua achando a pasta pelo
-- número (find_org_folder na cozinha). Isto é conveniência de navegação.
--
-- Seguro de aplicar: só adiciona coluna anulável, não altera nem apaga dado.
-- Reversão: alter table conteudo_organico drop column drive_folder_url;

alter table conteudo_organico
  add column if not exists drive_folder_url text;

comment on column conteudo_organico.drive_folder_url is
  'URL da pasta do card no Google Drive, criada automaticamente ao criar o card. Só atalho de navegação: a importação acha a pasta pelo número, não por esta coluna.';
