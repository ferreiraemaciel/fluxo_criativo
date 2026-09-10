-- 110: referencias por tarefa do pico de vendas.
-- Exemplos reais (videos, posts, paginas, documentos, skills) que aparecem
-- dentro da tarefa no momento em que ela vai ser feita.
alter table pico_template_tarefas add column if not exists referencias jsonb not null default '[]'::jsonb;
alter table pico_tarefas          add column if not exists referencias jsonb not null default '[]'::jsonb;
