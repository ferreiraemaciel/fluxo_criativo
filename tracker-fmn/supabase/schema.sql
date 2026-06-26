-- ============================================================
-- TRACKER FMN — Schema Supabase
-- Fotografia é o Meu Negócio
-- ============================================================

-- ============================================================
-- 1. ADS — Gestão de criativos (Kanban)
-- ============================================================
create table ads (
  id                  uuid primary key default gen_random_uuid(),
  numero              integer unique not null,           -- ex: 246, 299, 324
  titulo              text not null,                     -- headline do ADS
  status              text not null default 'fazer'      -- fazer | fazendo-producao | fazendo-teste | fazendo-recorrencia | feito-otimo | feito-mediano
                      check (status in (
                        'fazer',
                        'fazendo-producao',
                        'fazendo-teste',
                        'fazendo-recorrencia',
                        'feito-otimo',
                        'feito-mediano'
                      )),
  tipo                text not null default 'reels'      -- reels | imagem | carrossel
                      check (tipo in ('reels', 'imagem', 'carrossel')),

  -- Copy estruturada
  headline            text,
  hook_visual         text,
  hook_copy           text,
  desenvolvimento_cta text,
  texto_principal     text,
  titulo_ad           text,
  descricao_ad        text,
  posicionamento      text[],                            -- ex: ['Feed Instagram 1080x1350', 'Stories']

  -- Mídia
  media_drive_url     text,                              -- URL do Google Drive
  media_tipo          text check (media_tipo in ('video', 'imagem', 'carrossel')),

  -- Vínculo com Meta Ads (preenchido quando o ADS está no ar)
  meta_ad_id          text,
  meta_ad_url         text,

  -- Performance (calculado automaticamente via funções)
  vendas_total        integer default 0,
  cpa_historico       numeric(10,2),
  gasto_total         numeric(10,2) default 0,

  -- Controle
  isento_regra        text,                              -- ex: 'G6' (isenção E1 para RMKT)
  observacoes         text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ============================================================
-- 2. VENDAS — Recebidas via webhook Hotmart
-- ============================================================
create table vendas (
  id                      uuid primary key default gen_random_uuid(),
  hotmart_transaction_id  text unique not null,
  hotmart_event           text,                          -- PURCHASE_APPROVED | PURCHASE_REFUNDED | etc

  -- Produto
  produto_id              text,
  produto_nome            text,
  valor_bruto             numeric(10,2) not null,
  valor_liquido           numeric(10,2),

  -- Status
  status                  text not null default 'aprovada'
                          check (status in ('aprovada', 'reembolsada', 'pendente', 'cancelada', 'chargeback', 'protesto', 'recuperacao')),
  metodo_pagamento        text,                          -- pix | cartao | boleto

  -- Atribuição UTM (vem no payload do webhook)
  utm_source              text,
  utm_campaign            text,
  utm_medium              text,
  utm_content             text,
  utm_term                text,

  -- Vínculo com Meta (resolvido a partir do utm_content ou utm_campaign)
  meta_ad_id              text,
  meta_campaign_id        text,
  meta_adset_id           text,
  ads_numero              integer references ads(numero) on delete set null,

  -- Dados do comprador (sem PII obrigatório)
  comprador_pais          text default 'BR',

  created_at              timestamptz default now()
);

-- ============================================================
-- 3. INSIGHTS_CACHE — Cache de métricas da Graph API Meta
-- ============================================================
create table insights_cache (
  id              uuid primary key default gen_random_uuid(),
  meta_ad_id      text not null,
  meta_ad_name    text,
  meta_adset_id   text,
  meta_campaign_id text,
  meta_campaign_name text,
  periodo         text not null                          -- maximum | 3d | 5d | 7d | 14d | 30d
                  check (periodo in ('maximum','3d','5d','7d','14d','30d')),
  data_inicio     date,
  data_fim        date,

  -- Métricas brutas
  gasto           numeric(10,2) default 0,
  impressoes      integer default 0,
  cliques         integer default 0,
  link_clicks     integer default 0,
  landing_page_views integer default 0,
  compras         integer default 0,
  valor_compras   numeric(10,2) default 0,
  add_to_cart     integer default 0,
  initiate_checkout integer default 0,

  -- Métricas calculadas
  cpa             numeric(10,2),
  roas            numeric(6,4),
  ctr_unico       numeric(6,4),
  cpm             numeric(10,2),
  frequencia      numeric(6,3),
  connect_rate    numeric(6,4),                          -- landing_page_views / link_clicks
  conv_pagina     numeric(6,4),                          -- compras / landing_page_views
  checkout_rate   numeric(6,4),                          -- compras / initiate_checkout

  -- Vídeo
  hook_rate       numeric(6,4),                          -- video_3s_views / impressoes
  hold_rate       numeric(6,4),                          -- video_p50 / impressoes

  -- Status da campanha no momento do fetch
  status_meta     text,

  atualizado_em   timestamptz default now(),

  unique(meta_ad_id, periodo)
);

-- ============================================================
-- 4. CAMPANHAS — Visão consolidada por campanha Meta
-- ============================================================
create table campanhas (
  id                  uuid primary key default gen_random_uuid(),
  meta_campaign_id    text unique not null,
  meta_campaign_name  text,
  objetivo            text,                              -- OUTCOME_SALES | OUTCOME_LEADS
  status              text,                              -- ACTIVE | PAUSED
  orcamento_diario    numeric(10,2),
  tipo_orcamento      text check (tipo_orcamento in ('ABO','CBO')),

  -- Métricas consolidadas (calculadas a partir de insights_cache)
  gasto_total         numeric(10,2) default 0,
  vendas_total        integer default 0,
  cpa_historico       numeric(10,2),
  gasto_3d            numeric(10,2) default 0,
  vendas_3d           integer default 0,
  cpa_3d              numeric(10,2),
  gasto_5d            numeric(10,2) default 0,
  vendas_5d           integer default 0,
  cpa_5d              numeric(10,2),

  -- Diagnóstico ATP
  regra_disparada     text,                              -- G1 | G2 | G3 | G4 | G5 | G6 | E1
  acao_sugerida       text,
  ultima_analise      timestamptz,

  atualizado_em       timestamptz default now()
);

-- ============================================================
-- 5. DESPESAS
-- ============================================================
create table despesas (
  id          uuid primary key default gen_random_uuid(),
  descricao   text not null,
  categoria   text not null default 'outros'
              check (categoria in ('ferramentas','marketing','pessoal','producao','outros')),
  tipo        text not null default 'unico'
              check (tipo in ('recorrente','unico')),
  valor       numeric(10,2) not null,
  data        date not null,
  ativo       boolean default true,
  observacoes text,
  created_at  timestamptz default now()
);

-- Seed com as despesas já cadastradas na UTMify
insert into despesas (descricao, categoria, tipo, valor, data) values
  ('UTMify',                                  'ferramentas', 'recorrente', 99.90,   '2026-06-01'),
  ('Hotmart Pages e Send',                    'ferramentas', 'recorrente', 165.56,  '2026-06-10'),
  ('InLead',                                  'ferramentas', 'recorrente', 97.00,   '2026-04-01'),
  ('Meta Verifield',                          'ferramentas', 'recorrente', 49.30,   '2026-01-14'),
  ('Fluxo Criativo',                          'outros',      'recorrente', 2200.00, '2026-05-20'),
  ('Miranda Estamparia',                      'producao',    'unico',      514.00,  '2026-04-27'),
  ('Claude anual',                            'ferramentas', 'unico',      1100.00, '2026-04-02'),
  ('INPI Registro de Marca',                  'outros',      'unico',      90.00,   '2026-03-30'),
  ('Claude mensalidade',                      'ferramentas', 'unico',      110.00,  '2026-03-28'),
  ('Programação MCV Rodrigo Dev',             'producao',    'unico',      950.00,  '2026-03-15'),
  ('Domínio fotografiaeomeunegocio.com.br',   'ferramentas', 'unico',      76.00,   '2026-03-06');

-- ============================================================
-- 6. IMPOSTOS E TAXAS
-- ============================================================
create table impostos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  tipo        text not null
              check (tipo in ('percentual_gasto','percentual_receita','fixo_por_venda','outro')),
  aliquota    numeric(6,4),                              -- ex: 0.1215 para 12,15%
  valor_fixo  numeric(10,2),                             -- ex: 1.00 para R$1 fixo Hotmart
  aplicacao   text,                                      -- descricao de onde se aplica
  ativo       boolean default true,
  created_at  timestamptz default now()
);

insert into impostos (nome, tipo, aliquota, valor_fixo, aplicacao) values
  ('Imposto Meta Ads',         'percentual_gasto',   0.1215, null,  'Incide sobre gastos em anúncios em contas BRL'),
  ('Taxa Hotmart variável',    'percentual_receita', 0.099,  null,  'Incide sobre faturamento bruto de cada venda'),
  ('Taxa Hotmart fixa',        'fixo_por_venda',     null,   1.00,  'R$ 1,00 fixo por transação aprovada');

-- ============================================================
-- 7. PRODUTOS — Custo e ticket de cada produto
-- ============================================================
create table produtos (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  ticket              numeric(10,2) not null,
  custo               numeric(10,2) default 0,
  hotmart_produto_id  text,
  ativo               boolean default true,
  created_at          timestamptz default now()
);

insert into produtos (nome, ticket, hotmart_produto_id) values
  ('Modelos de Contrato Visual | Fotógrafos e Videomakers', 297.00, null),
  ('Pack Pro Lightroom - Tons Impecáveis',                   97.00,  null),
  ('Mensagens que Vendem | Fotógrafos e Videomakers',        47.00,  null),
  ('40 Ideias de Cenários Natalinos',                        27.00,  null),
  ('Combo - Packs de Presets',                               67.00,  null),
  ('Mensagens que Vendem - APP',                             47.00,  null),
  ('Blindagem',                                              97.00,  null);

-- ============================================================
-- 8. REGRAS ATP — Configuração das regras G1-G7 + E1
-- ============================================================
create table regras_atp (
  id          uuid primary key default gen_random_uuid(),
  codigo      text unique not null,                      -- G1 | G2 | G3 | G4 | G5 | G6 | G7 | E1
  nome        text not null,
  descricao   text,
  ativo       boolean default true,
  parametros  jsonb default '{}',                        -- thresholds configuráveis
  created_at  timestamptz default now()
);

insert into regras_atp (codigo, nome, descricao, parametros) values
  ('G1', 'Gasto sem conversão',          'Gasto acumulado ≥ 1× ticket sem nenhuma venda → pausar',
   '{"multiplicador_ticket": 1}'),
  ('G2', 'CPA histórico crítico',        'CPA histórico > limite máximo por N dias seguidos → pausar',
   '{"dias_consecutivos": 3}'),
  ('G3', 'Acumulação de vendas',         'Acumular vendas/CPA histórico antes de atualizar Notion',
   '{}'),
  ('G4', 'Frequência alta',             'Frequência 7d > 3.5 com CPA piorando → alertar refresh criativo',
   '{"frequencia_limite": 3.5}'),
  ('G5', 'CPA recente acima do limite', 'CPA 3d E CPA 5d ambos acima do limite → pausar',
   '{"cpa_limite": 207.90}'),
  ('G6', 'Connect rate baixo',          'Connect rate < 60% por 3 dias → alertar problema técnico na página',
   '{"connect_rate_minimo": 0.60, "dias": 3}'),
  ('G7', 'Atualização de status',       'Após ação (pausa/escala), atualizar status no Notion e no Kanban',
   '{}'),
  ('E1', 'Isenção RMKT',               'ADS marcados como RMKT ficam isentos de G6 (audiência pequena)',
   '{}');

-- ============================================================
-- 9. ALERTAS — Log de regras disparadas e ações tomadas
-- ============================================================
create table alertas (
  id              uuid primary key default gen_random_uuid(),
  ads_numero      integer references ads(numero) on delete set null,
  meta_ad_id      text,
  meta_campaign_id text,
  regra_codigo    text references regras_atp(codigo),
  mensagem        text not null,
  acao_tomada     text,                                  -- pausado | reduzido | alertado | ignorado
  dados_snapshot  jsonb,                                 -- snapshot das métricas no momento do disparo
  resolvido       boolean default false,
  created_at      timestamptz default now()
);

-- ============================================================
-- 10. CONFIGURACOES — Variáveis do app por conta
-- ============================================================
create table configuracoes (
  id                      uuid primary key default gen_random_uuid(),
  meta_ad_account_id      text,
  meta_auth_modo          text default 'APP',
  cpa_limite              numeric(10,2) default 207.90,
  ticket_principal        numeric(10,2) default 297.00,
  notion_db_id            text,
  zapi_instance           text,
  zapi_token              text,
  alertas_whatsapp_ativo  boolean default false,
  updated_at              timestamptz default now()
);

-- ============================================================
-- FUNÇÕES AUXILIARES
-- ============================================================

-- Atualiza updated_at automaticamente
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger ads_updated_at
  before update on ads
  for each row execute function set_updated_at();

create trigger campanhas_updated_at
  before update on campanhas
  for each row execute function set_updated_at();

-- Recalcula vendas e CPA do ADS quando uma venda é inserida/atualizada
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

create trigger venda_inserida
  after insert or update on vendas
  for each row
  when (new.ads_numero is not null)
  execute function recalcular_ads_performance();

-- ============================================================
-- ÍNDICES — Performance nas queries mais comuns
-- ============================================================
create index idx_vendas_ads_numero     on vendas(ads_numero);
create index idx_vendas_meta_ad_id     on vendas(meta_ad_id);
create index idx_vendas_status         on vendas(status);
create index idx_vendas_created_at     on vendas(created_at desc);
create index idx_insights_meta_ad_id   on insights_cache(meta_ad_id);
create index idx_insights_periodo      on insights_cache(periodo);
create index idx_alertas_ads_numero    on alertas(ads_numero);
create index idx_alertas_resolvido     on alertas(resolvido);
create index idx_ads_status            on ads(status);
create index idx_ads_meta_ad_id        on ads(meta_ad_id);

-- Seed de configurações iniciais (inclui UTM template)
insert into configuracoes (
  meta_ad_account_id,
  cpa_limite,
  ticket_principal
) values (
  '551241914600634',
  207.90,
  297.00
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Ativar após configurar autenticação no Lovable
-- ============================================================
alter table ads              enable row level security;
alter table vendas            enable row level security;
alter table insights_cache   enable row level security;
alter table campanhas        enable row level security;
alter table despesas         enable row level security;
alter table impostos         enable row level security;
alter table produtos         enable row level security;
alter table regras_atp       enable row level security;
alter table alertas          enable row level security;
alter table configuracoes    enable row level security;

-- Política temporária para desenvolvimento (libera tudo para usuário autenticado)
-- TROCAR por políticas específicas antes de ir para produção
create policy "dev_acesso_total" on ads              for all using (true);
create policy "dev_acesso_total" on vendas            for all using (true);
create policy "dev_acesso_total" on insights_cache   for all using (true);
create policy "dev_acesso_total" on campanhas        for all using (true);
create policy "dev_acesso_total" on despesas         for all using (true);
create policy "dev_acesso_total" on impostos         for all using (true);
create policy "dev_acesso_total" on produtos         for all using (true);
create policy "dev_acesso_total" on regras_atp       for all using (true);
create policy "dev_acesso_total" on alertas          for all using (true);
create policy "dev_acesso_total" on configuracoes    for all using (true);
