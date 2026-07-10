-- Migration 066: marca se a venda já disparou a mensagem de boas-vindas do
-- WhatsApp, pra não reenviar em caso de retry do webhook da Hotmart (o mesmo
-- evento pode chegar mais de uma vez).
alter table vendas add column if not exists whatsapp_boas_vindas_enviado boolean not null default false;
