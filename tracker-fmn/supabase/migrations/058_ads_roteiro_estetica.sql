-- Migration 058: nova estrutura de copy pra criativos de Reels.
-- Substitui, na tela, os campos Hook Visual / Hook Copy / Desenvolvimento+CTA
-- por dois campos novos: roteiro (hook+desenvolvimento+cta narrados juntos)
-- e estetica_visual (som, cor, angulo, cenas — o audiovisual como um todo).
--
-- Os campos antigos NÃO são apagados nem removidos da tabela — ficam como
-- histórico/backup, só saem da tela. Se um dia quisermos deletar de vez,
-- é uma migration separada.

alter table ads add column if not exists roteiro text;
alter table ads add column if not exists estetica_visual text;

comment on column ads.roteiro is 'Reels: hook + desenvolvimento + CTA narrados juntos (substitui hook_copy + desenvolvimento_cta na tela)';
comment on column ads.estetica_visual is 'Reels: som, cor, angulo, cenas — a parte estetica do audiovisual (substitui hook_visual na tela, com escopo do video inteiro)';

-- Migração automática, uma vez só: pros reels que já têm conteúdo nos campos
-- antigos e ainda não têm nada nos novos, preenche roteiro/estetica_visual
-- a partir do que já existe. Não sobrescreve se o campo novo já tiver algo.
update ads
set roteiro = trim(both E'\n' from
  coalesce(nullif(trim(hook_copy), ''), '') ||
  case when nullif(trim(hook_copy), '') is not null and nullif(trim(desenvolvimento_cta), '') is not null
       then E'\n\n' else '' end ||
  coalesce(nullif(trim(desenvolvimento_cta), ''), '')
)
where tipo = 'reels'
  and (roteiro is null or trim(roteiro) = '')
  and (coalesce(trim(hook_copy), '') <> '' or coalesce(trim(desenvolvimento_cta), '') <> '');

update ads
set estetica_visual = hook_visual
where tipo = 'reels'
  and (estetica_visual is null or trim(estetica_visual) = '')
  and coalesce(trim(hook_visual), '') <> '';
