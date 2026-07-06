-- Migration 017: tabela quiz_leads
-- Guarda os leads do funil em quiz (Fotógrafo Protegido), histórico do inLead
-- e os novos capturados pela vitrine própria. Base da aba Funis do Tracker.

create table if not exists quiz_leads (
  id                  bigint generated always as identity primary key,
  funnel_slug         text not null default 'fotografo-protegido',
  code                text not null,
  created_at          timestamptz,

  -- contato
  email               text,
  nome                text,        -- nulo no histórico (inLead só pegava e-mail)
  whatsapp            text,        -- nulo no histórico

  -- respostas do quiz (perguntas estáveis viram colunas para gráfico fácil)
  area_atuacao        text,
  profissionalizacao  text,
  tipo_negocio        text,
  confianca_clientes  text,
  situacoes           text[],
  custo_processo      text,
  usa_contrato        text,
  tipo_contrato_atual text,
  foco_artistico      text,
  sentimentos         text[],
  protege_dinheiro    text,
  temas_dominados     text[],
  entende_contrato    text,
  quer_modelos        text,

  completou_lead      boolean not null default false,

  -- atribuição
  utm_source          text,
  utm_medium          text,
  utm_campaign        text,
  utm_content         text,
  utm_term            text,
  device_platform     text,
  ip                  text,
  tracking_raw        text,

  origem              text not null default 'inlead_import',  -- inlead_import | novo
  respostas           jsonb,   -- mapa completo legível
  raw                 jsonb,   -- linha original do export, por segurança
  imported_at         timestamptz not null default now(),

  unique (funnel_slug, code)
);

create index if not exists quiz_leads_created_at_idx   on quiz_leads (created_at);
create index if not exists quiz_leads_origem_idx       on quiz_leads (origem);
create index if not exists quiz_leads_campaign_idx     on quiz_leads (utm_campaign);
create index if not exists quiz_leads_area_idx         on quiz_leads (area_atuacao);
create index if not exists quiz_leads_completou_idx    on quiz_leads (completou_lead);
