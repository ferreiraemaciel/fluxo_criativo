-- Migração 063: remove a coluna "Testar novamente" do Kanban (2026-07-10).
-- Decisão do usuário: a etiqueta continua existindo (Ótimo/Testar novamente/
-- Mediano/Ruim), só deixa de ser uma coluna própria — os cards passam a
-- morar em "Arquivados", filtráveis pela etiqueta. Ver REGRAS-KANBAN.md e
-- supabase/functions/_shared/classificar.ts pra nova fórmula.
update ads set status = 'arquivado' where status = 'testar-novamente';
