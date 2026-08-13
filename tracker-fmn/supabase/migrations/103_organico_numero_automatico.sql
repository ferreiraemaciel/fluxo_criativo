-- Migração 103: garante que todo card do Orgânico nasça com número (2026-08-08).
--
-- Motivo: a lógica que atribui o número vivia SÓ no frontend. Quem inserisse
-- direto no banco (script, importação em lote, outra sessão) criava card sem
-- número — aconteceu com 6 cards em 2026-08-08 03:41. Card sem número não
-- consegue ter pasta no Drive nem importar mídia, porque a pasta é encontrada
-- pelo número. Colocando a regra no banco, não existe mais caminho que escape.
--
-- Preenche buraco antes de usar número novo (mesma regra do frontend e dos
-- Anúncios): se 12, 21 e 22 estão livres, o próximo card pega o 12.
--
-- Reversão:
--   drop trigger if exists trg_organico_numero on conteudo_organico;
--   drop function if exists organico_atribui_numero();
--   drop index if exists idx_organico_numero_unico;

create or replace function organico_atribui_numero()
returns trigger language plpgsql as $$
begin
  if new.numero is null then
    select min(t.n) into new.numero
    from generate_series(
      1,
      coalesce((select max(numero) from conteudo_organico), 0) + 1
    ) as t(n)
    where not exists (
      select 1 from conteudo_organico c where c.numero = t.n
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_organico_numero on conteudo_organico;
create trigger trg_organico_numero
  before insert on conteudo_organico
  for each row execute function organico_atribui_numero();

-- Índice único: duas pastas com o mesmo número no Drive quebrariam a
-- importação (ela acha a pasta pelo número). Melhor falhar o insert do que
-- criar a ambiguidade silenciosamente.
create unique index if not exists idx_organico_numero_unico
  on conteudo_organico (numero)
  where numero is not null;

-- Backfill dos 6 cards que ficaram sem número, preenchendo os buracos
-- existentes (12, 21, 22, 40, 41) antes de seguir pro próximo livre.
do $$
declare
  r record;
  livre int;
begin
  for r in select id from conteudo_organico where numero is null order by created_at, id loop
    select min(t.n) into livre
    from generate_series(1, coalesce((select max(numero) from conteudo_organico), 0) + 1) as t(n)
    where not exists (select 1 from conteudo_organico c where c.numero = t.n);
    update conteudo_organico set numero = livre where id = r.id;
  end loop;
end $$;
