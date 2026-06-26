-- Migração 001: trigger recalcular_ads_performance com CPA
-- Aplicar no Supabase: Dashboard → SQL Editor → colar e executar

create or replace function recalcular_ads_performance()
returns trigger as $$
declare
  v_vendas   integer;
  v_gasto    numeric;
begin
  select count(*) into v_vendas
  from vendas
  where ads_numero = new.ads_numero
  and status = 'aprovada';

  select gasto_total into v_gasto
  from ads
  where numero = new.ads_numero;

  update ads
  set
    vendas_total  = v_vendas,
    cpa_historico = case when v_vendas > 0 and v_gasto > 0
                         then round(v_gasto / v_vendas, 2)
                         else null end
  where numero = new.ads_numero;

  return new;
end;
$$ language plpgsql;
