-- Migration 057: tabela de pageviews da página de upsell (Blindagem).
-- Alimentada por um beacon client-side na própria página estática
-- (blindagem-upsell/index.html), usando a anon/publishable key — não
-- substitui nem interfere no Meta Pixel, que continua rodando em paralelo.
-- Serve só pra calcular "quantos viram vs quantos compraram" no dashboard.

create table if not exists upsell_pageviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  meta_ad_id text,
  referrer text
);

alter table upsell_pageviews enable row level security;

-- Anon (a própria página pública) só pode INSERIR, nunca ler/listar.
drop policy if exists "upsell_pageviews_insert_anon" on upsell_pageviews;
create policy "upsell_pageviews_insert_anon"
  on upsell_pageviews for insert
  to anon
  with check (true);
