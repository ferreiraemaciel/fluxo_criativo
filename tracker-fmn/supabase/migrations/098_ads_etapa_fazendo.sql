-- ============================================================
-- Sub-etapa "Copy" / "Produção" pra cards na coluna Fazendo (status='fazer').
-- Aprovado em 2026-08-03. Só faz sentido em Fazendo — some sozinho quando
-- o card sai dessa coluna (qualquer transição de status, manual ou automática).
-- ============================================================

alter table ads
  add column if not exists etapa text
  check (etapa in ('copy', 'producao'));

comment on column ads.etapa is 'Sub-etapa dentro de "Fazendo" (status=fazer): copy ou producao. Sempre null fora de Fazendo.';
