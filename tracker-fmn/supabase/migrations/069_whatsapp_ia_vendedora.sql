-- Migration 069: base pra IA vendedora conversar com os leads no WhatsApp.
-- Fica tudo desligado por padrão (whatsapp_ia_ativa = false); ninguém recebe
-- mensagem de IA até o usuário ligar manualmente pelo botão no Tracker.

alter table whatsapp_contatos add column if not exists ia_pausada    boolean not null default false;
alter table whatsapp_contatos add column if not exists precisa_humano boolean not null default false;
alter table whatsapp_contatos add column if not exists estagio_venda  text not null default 'descoberta'
  check (estagio_venda in ('descoberta','encantamento','fechamento'));

create table if not exists app_config (
  chave      text primary key,
  valor      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table app_config enable row level security;

create policy app_config_service_role_all
  on app_config for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy app_config_authenticated_all
  on app_config for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

insert into app_config (chave, valor)
values ('whatsapp_ia_ativa', 'false'::jsonb)
on conflict (chave) do nothing;
