-- Migração 100: reorganiza as colunas do Kanban do Orgânico (2026-08-06).
--
-- Combinado com Felipe: mesma lógica já aplicada nos Anúncios, onde "Copy" e
-- "Produção" deixaram de ser colunas e viraram uma sub-etapa (tag) dentro da
-- coluna de trabalho. Menos colunas, e o estágio da peça fica visível no card.
--
-- ANTES:  Fazer → Produção → Postagem → Agendado → Feito(=publicado)
-- DEPOIS: Fazendo → Feito → Postagem → Agendado → Arquivado
--   Fazendo   = em construção (tag Copy ou Produção no card)
--   Feito     = arte/peça finalizada
--   Postagem  = na fila pra postar (legenda pronta)
--   Agendado  = com data e hora marcadas, o robô publica sozinho
--   Arquivado = já publicado
--
-- Reversão (se algum dia precisar):
--   update conteudo_organico set status='Feito'  where status='Arquivado';
--   update conteudo_organico set status='Fazer'  where status='Fazendo';
--   alter table conteudo_organico drop column etapa;

-- 1) Sub-etapa dentro de "Fazendo", igual ao que existe em ads.etapa.
alter table conteudo_organico
  add column if not exists etapa text
  check (etapa in ('copy', 'producao'));

comment on column conteudo_organico.etapa is
  'Sub-etapa dentro de "Fazendo": copy ou producao. Sempre null fora de Fazendo.';

-- 2) Migração dos dados existentes.
-- A ordem importa: "Feito" vira "Arquivado" ANTES de qualquer outra coisa,
-- senão os cards que já estavam publicados se misturariam com o novo
-- significado de "Feito" (peça pronta, ainda não publicada).
update conteudo_organico set status = 'Arquivado' where status = 'Feito';
update conteudo_organico set status = 'Fazendo'   where status in ('Fazer', 'Produção');

-- Postagem e Agendado mantêm o nome e o sentido, nada a fazer com eles.
