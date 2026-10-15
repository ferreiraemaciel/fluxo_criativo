-- Acervo de arquivos da campanha (15/10/2026): logos, artes, fotos, vídeos e documentos
-- do pico, num lugar só, para ver e baixar. O arquivo mora no R2; aqui fica o endereço.
create table if not exists pico_arquivos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null references pico_projetos(id) on delete cascade,
  nome text not null,
  categoria text not null default 'arte' check (categoria in ('logo','arte','foto','video','documento')),
  url text not null,
  tamanho bigint,
  criado_em timestamptz not null default now()
);
create index if not exists pico_arquivos_projeto_idx on pico_arquivos(projeto_id);
alter table pico_arquivos enable row level security;
create policy pico_arquivos_ler on pico_arquivos for select to authenticated using (true);
create policy pico_arquivos_inserir on pico_arquivos for insert to authenticated with check (true);
create policy pico_arquivos_apagar on pico_arquivos for delete to authenticated using (true);
create policy pico_arquivos_editar on pico_arquivos for update to authenticated using (true);
