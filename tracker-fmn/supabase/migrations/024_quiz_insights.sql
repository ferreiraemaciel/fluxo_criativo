-- Migration 024: insight diário do quiz (gerado por rotina, exibido na aba Funis)
create table if not exists quiz_insights (
  id          bigint generated always as identity primary key,
  dia         date not null unique,
  titulo      text not null,
  gancho      text,
  detalhe     text,
  formato     text default 'Reels',
  usado       boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table quiz_insights enable row level security;
drop policy if exists quiz_insights_acesso_total on quiz_insights;
create policy quiz_insights_acesso_total on quiz_insights for all to public using (true) with check (true);

-- semear o insight de hoje com um achado real
insert into quiz_insights (dia, titulo, gancho, detalhe, formato)
select current_date,
  'A maioria não domina nenhum tema jurídico (e nem percebe)',
  'Reels: "Você assina contrato, mas sabe o que está assinando?" Revele que '||p||'% dos fotógrafos admitem não dominar NENHUM tema jurídico, e mostre os 3 mais ignorados.',
  p||'% dos que responderam o quiz marcaram que não dominam nenhum tema jurídico.',
  'Reels'
from (select round(100.0*count(*) filter (where 'Nenhum deles'=any(temas_dominados))/nullif(count(*),0)) p from quiz_leads) x
on conflict (dia) do nothing;
