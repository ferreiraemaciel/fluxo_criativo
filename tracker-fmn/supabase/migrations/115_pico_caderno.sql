-- 115: o caderno da Black dentro do Tracker.
-- Conteúdo gerado por scripts/sync-caderno.py a partir de BLACK-FRIDAY-2026.md.
create table if not exists pico_caderno (
  id uuid primary key default gen_random_uuid(),
  numero integer not null default 0,
  titulo text not null,
  html text not null,
  texto text,
  ordem integer not null default 0,
  atualizado_em timestamptz not null default now());
alter table pico_caderno enable row level security;
drop policy if exists pico_caderno_auth on pico_caderno;
create policy pico_caderno_auth on pico_caderno for all to authenticated using (true) with check (true);
