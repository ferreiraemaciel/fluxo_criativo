-- Migration 080: rastreamento de custo por mensagem (WhatsApp + Anthropic).
alter table whatsapp_mensagens add column if not exists tokens_entrada integer;
alter table whatsapp_mensagens add column if not exists tokens_saida integer;
alter table whatsapp_mensagens add column if not exists custo_usd numeric(10,5);

-- Tabela de preços editável sem precisar redeploy. Valores em USD.
-- Ajustar aqui se o preço da Meta ou da Anthropic mudar.
create table if not exists custo_precos (
  chave text primary key,
  valor numeric(12,6) not null,
  descricao text,
  updated_at timestamptz not null default now()
);

insert into custo_precos (chave, valor, descricao) values
  ('whatsapp_template_utility_usd',  0.0068, 'Preço estimado por envio de template categoria Utilidade (Brasil, USD)'),
  ('whatsapp_template_marketing_usd', 0.0625, 'Preço estimado por envio de template categoria Marketing (Brasil, USD)'),
  ('anthropic_haiku_input_por_mtok',  1.00,   'Preço Claude Haiku 4.5, input, USD por milhão de tokens'),
  ('anthropic_haiku_output_por_mtok', 5.00,   'Preço Claude Haiku 4.5, output, USD por milhão de tokens')
on conflict (chave) do nothing;
