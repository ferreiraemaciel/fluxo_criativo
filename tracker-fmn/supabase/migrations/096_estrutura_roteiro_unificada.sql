-- ============================================================
-- Estrutura de copy unificada (Headline/Roteiro/Estética Visual)
-- Aprovada em 2026-08-03. Ver CAMPOS-COPY-CRIATIVOS.md.
--
-- Regra geral: o campo "roteiro" sempre contém as 3 partes (Gancho,
-- Desenvolvimento, CTA), não necessariamente rotuladas no texto, mas
-- as 3 têm que estar presentes.
--
-- Colunas antigas (gancho, desenvolvimento, cta, prompt_imagem em
-- conteudo_organico) são preservadas como histórico, nunca apagadas.
-- ============================================================

-- ── conteudo_organico ───────────────────────────────────────────
alter table conteudo_organico
  add column if not exists headline        text,
  add column if not exists roteiro         text,
  add column if not exists estetica_visual text,
  add column if not exists prompt          text,  -- só Imagem/slide de Carrossel usa
  add column if not exists observacoes     text;

comment on column conteudo_organico.headline is 'Texto escrito na própria arte/vídeo (hook visual).';
comment on column conteudo_organico.roteiro is 'Gancho + Desenvolvimento + CTA, sempre as 3 partes presentes (rotuladas ou não).';
comment on column conteudo_organico.estetica_visual is 'Descrição de cena/filmagem/composição. Para Imagem, acompanha um Prompt separado.';
comment on column conteudo_organico.prompt is 'Prompt de geração de imagem (só Imagem e slides de Carrossel; Reels não usa).';
comment on column conteudo_organico.observacoes is 'Informações Adicionais — catch-all, mesmo nome usado em ads.observacoes.';

-- ── ads ─────────────────────────────────────────────────────────
-- Carrossel ainda não tinha estrutura por slide (ficava tudo em campos
-- soltos: headline, hook_visual, hook_copy, desenvolvimento_cta).
-- Agora usa o mesmo formato de slides do Orgânico.
alter table ads
  add column if not exists slides text;

comment on column ads.slides is 'Só Carrossel: array JSON de slides, cada um com {roteiro, estetica_visual, prompt, image_url}.';
