-- Migration 059: estende a estrutura Roteiro/Prompt pra criativos de Imagem.
-- Reaproveita as MESMAS colunas do Reels (roteiro, estetica_visual) -- na
-- tela, pra tipo=imagem, estetica_visual passa a se chamar "Prompt para
-- Gerar Imagem" (kanban.jsx decide o rotulo pelo tipo do card).
--
-- Hook Visual / Hook Copy / Desenvolvimento+CTA continuam intactos no banco
-- (historico), só saem da tela pra imagem tambem.
--
-- Migração automática, uma vez só: junta hook_copy + desenvolvimento_cta em
-- roteiro (mesmo padrão da migration 058, agora pra tipo=imagem). NÃO migra
-- hook_visual -> estetica_visual aqui: a descrição visual antiga não é a
-- mesma coisa que um prompt de geração de imagem pronto para colar, então
-- o campo novo começa em branco para o usuário preencher de verdade.

update ads
set roteiro = trim(both E'\n' from
  coalesce(nullif(trim(hook_copy), ''), '') ||
  case when nullif(trim(hook_copy), '') is not null and nullif(trim(desenvolvimento_cta), '') is not null
       then E'\n\n' else '' end ||
  coalesce(nullif(trim(desenvolvimento_cta), ''), '')
)
where tipo = 'imagem'
  and (roteiro is null or trim(roteiro) = '')
  and (coalesce(trim(hook_copy), '') <> '' or coalesce(trim(desenvolvimento_cta), '') <> '');
