-- Peças da campanha (15/10/2026): card do Orgânico ou dos Anúncios pertence a um pico
-- e, opcionalmente, a uma tarefa dele. Uma tarefa pode ter várias peças.
alter table conteudo_organico add column if not exists pico_projeto_id uuid references pico_projetos(id) on delete set null;
alter table conteudo_organico add column if not exists pico_tarefa_id  uuid references pico_tarefas(id)  on delete set null;
alter table ads add column if not exists pico_projeto_id uuid references pico_projetos(id) on delete set null;
alter table ads add column if not exists pico_tarefa_id  uuid references pico_tarefas(id)  on delete set null;
create index if not exists conteudo_organico_pico_idx on conteudo_organico(pico_projeto_id) where pico_projeto_id is not null;
create index if not exists ads_pico_idx on ads(pico_projeto_id) where pico_projeto_id is not null;
