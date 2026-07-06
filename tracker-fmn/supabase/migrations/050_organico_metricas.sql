-- Migration 044: métricas de posts orgânicos (Instagram / Facebook)
-- Puxa o desempenho dos posts via Graph API (o token já tem instagram_manage_insights
-- e read_insights). Guarda um snapshot diário por post, cobrindo TODOS os posts da
-- conta, não só os publicados pelo Tracker. Espelha o padrão de insights_cache dos anúncios.

-- 1. Liga o post criado no Tracker ao id do post no Meta (preenchido na publicação).
--    Sem esse id, não dá pra casar o post do Tracker com as métricas dele.
alter table conteudo_organico
  add column if not exists meta_media_id text;

-- 2. Tabela de métricas orgânicas: um registro por post por dia (histórico de curva).
create table if not exists organico_metricas (
  id                 bigint generated always as identity primary key,
  meta_media_id      text not null,
  ig_user_id         text,
  media_type         text,           -- IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type text,           -- FEED | REELS | STORY
  permalink          text,
  caption            text,
  posted_at          timestamptz,    -- horário do post no Instagram

  -- métricas (valor conhecido no dia da captura)
  reach              integer,
  likes              integer,
  comments           integer,
  saved              integer,
  shares             integer,
  total_interactions integer,
  profile_visits     integer,
  follows            integer,
  video_views        integer,

  data               date        not null default (now() at time zone 'America/Sao_Paulo')::date,
  captured_at        timestamptz not null default now(),

  unique (meta_media_id, data)
);

create index if not exists organico_metricas_media_idx  on organico_metricas (meta_media_id);
create index if not exists organico_metricas_data_idx   on organico_metricas (data);
create index if not exists organico_metricas_posted_idx on organico_metricas (posted_at);

-- 3. RLS: mesmo padrão das demais tabelas do Tracker (só usuário autenticado lê;
--    a função de sync usa service role e passa direto pela RLS).
alter table organico_metricas enable row level security;
drop policy if exists tracker_auth_all on organico_metricas;
create policy tracker_auth_all on organico_metricas
  for all to authenticated using (true) with check (true);
