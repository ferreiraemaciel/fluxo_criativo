-- ============================================================
-- ORG com número fixo, igual aos Anúncios
--
-- Até aqui o "ORG NNN" do Orgânico não existia no banco: era calculado
-- no frontend pela posição do card numa lista ordenada por created_at
-- (`item.numero ?? (idx+1)` em organico.jsx). Consequência: deletar um
-- card do meio renumerava, silenciosamente, todos os cards seguintes.
--
-- Isso quebra na prática, porque a pasta do Drive de cada card é nomeada
-- com esse número ("ORG 019 Tema do card") e o
-- scripts/adicionar-criativo-organico.py resolve a pasta por ele. Depois
-- de uma deleção, cada pasta passava a apontar para o card errado.
-- Aconteceu de verdade em 2026-08-07: 4 cards foram apagados e todos os
-- ORG posteriores desceram 4 posições.
--
-- A partir daqui o número é coluna de verdade, como em `ads.numero`:
-- fixo por card, deleção deixa buraco em vez de renumerar, e card novo
-- recebe max(numero)+1.
--
-- O backfill não é sequencial: cada card recebe o número que já está no
-- nome da pasta dele no Drive, que é a fonte histórica correta. Feito
-- pelo script scratchpad/mapear_org.py (casamento por link do Drive e,
-- na falta dele, por nome normalizado, com desempate por quantidade de
-- arquivos entre Carrossel e Imagem/Reels de mesmo título).
-- ============================================================

alter table conteudo_organico
  add column if not exists numero integer;

comment on column conteudo_organico.numero is
  'Número fixo do card (ORG NNN), espelhado no nome da pasta do Drive. Nunca renumerar: deleção deixa buraco, card novo recebe max(numero)+1.';

-- Índice único parcial: dois cards nunca podem dividir o mesmo número,
-- mas linhas antigas sem número (se houver) não travam a migração.
create unique index if not exists conteudo_organico_numero_uniq
  on conteudo_organico (numero)
  where numero is not null;
