-- Migration 065: tabela de mensagens do WhatsApp (Cloud API oficial).
-- Guarda tudo que sai (templates automáticos, respostas manuais do time) e
-- tudo que entra (respostas dos leads/compradores), pra alimentar a aba
-- Conversas do Tracker e a lógica de janela de serviço de 24h.

create table if not exists whatsapp_mensagens (
  id             bigint generated always as identity primary key,
  telefone       text not null,        -- normalizado, só dígitos com DDI (ex: 5548996450791)
  nome           text,                 -- melhor nome conhecido pro contato (vendas/quiz_leads)
  direcao        text not null check (direcao in ('saida','entrada')),
  tipo           text not null default 'texto' check (tipo in ('template','texto','botao')),
  corpo          text,                 -- texto final enviado/recebido (template já com variáveis substituídas)
  template_nome  text,                 -- nome do template, quando tipo='template'
  wa_message_id  text,                 -- id da mensagem no WhatsApp (pra casar status de entrega/leitura)
  status         text default 'enviado' check (status in ('enviado','entregue','lido','falhou','recebido')),
  origem         text,                 -- quiz | venda_mcv | manual | resposta_lead
  lida_pelo_time boolean not null default false,  -- controla o "não lido" da caixa de entrada
  raw            jsonb,                -- payload bruto do webhook/API, por segurança
  created_at     timestamptz not null default now()
);

create index if not exists whatsapp_mensagens_telefone_idx    on whatsapp_mensagens (telefone, created_at desc);
create index if not exists whatsapp_mensagens_wa_message_idx  on whatsapp_mensagens (wa_message_id);
create index if not exists whatsapp_mensagens_nao_lidas_idx   on whatsapp_mensagens (lida_pelo_time) where direcao = 'entrada' and lida_pelo_time = false;

alter table whatsapp_mensagens enable row level security;

create policy whatsapp_mensagens_service_role_all
  on whatsapp_mensagens for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy whatsapp_mensagens_authenticated_select
  on whatsapp_mensagens for select
  using (auth.role() = 'authenticated');

create policy whatsapp_mensagens_authenticated_insert
  on whatsapp_mensagens for insert
  with check (auth.role() = 'authenticated');

create policy whatsapp_mensagens_authenticated_update
  on whatsapp_mensagens for update
  using (auth.role() = 'authenticated');
