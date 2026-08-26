-- Tracker FMN — produto de cada ADS (MCV ou BLI)
--
-- Combinado com Felipe em 2026-08-26: até aqui a conta só rodava anúncio do
-- MCV, então ticket e CPA limite eram valores únicos, chumbados em regras_atp
-- sem distinção de produto. Com anúncio de Blindagem entrando agora, cada ADS
-- precisa dizer de qual produto ele é, e as regras automáticas (G1 gasto sem
-- venda, G5 CPA acima do limite) precisam usar o valor do produto certo —
-- senão um anúncio de Blindagem seria julgado pelo ticket do MCV.
--
-- Todo ADS que já existe é MCV (era o único produto da conta), por isso o
-- default 'MCV' + backfill. ADS novo de Blindagem entra como 'BLI'.

alter table public.ads
  add column if not exists produto text not null default 'MCV';

update public.ads set produto = 'MCV' where produto is null;

alter table public.ads
  drop constraint if exists ads_produto_check;

alter table public.ads
  add constraint ads_produto_check check (produto in ('MCV', 'BLI'));

create index if not exists ads_produto_idx on public.ads (produto);

comment on column public.ads.produto is
  'Produto que o anúncio vende: MCV (Modelos de Contrato Visual, R$297) ou BLI (Blindagem, R$397). Define qual ticket/CPA limite as regras G1 e G5 aplicam — ver regras_atp.parametros.por_produto.';
