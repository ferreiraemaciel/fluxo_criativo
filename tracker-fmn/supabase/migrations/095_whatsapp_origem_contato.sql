-- Migração 095: marca de onde veio cada contato do WhatsApp (2026-07-31).
--
-- Motivo: a partir de agora o abandono de carrinho da Hotmart vira contato no
-- WhatsApp automaticamente, pra ação de recuperação de venda com o Claudinho.
-- Sem essa marca, esse contato ficaria misturado com os leads que vieram do
-- quiz, e não daria pra saber com quem se está falando nem medir a recuperação
-- separadamente.
--
-- Valores previstos:
--   quiz               -> respondeu o quiz do Fotógrafo Protegido (padrão histórico)
--   abandono_carrinho  -> chegou no checkout da Hotmart e não concluiu
--   compra             -> comprador (boas-vindas pós-compra)
--   manual             -> contato criado à mão no Tracker
--
-- Seguro de aplicar: só adiciona coluna anulável com padrão, não altera nem
-- apaga dado existente. Reversão, se algum dia precisar:
--   alter table whatsapp_contatos drop column origem;

alter table whatsapp_contatos
  add column if not exists origem text default 'quiz';

comment on column whatsapp_contatos.origem is
  'De onde veio o contato: quiz | abandono_carrinho | compra | manual. Usado pra identificar visualmente na aba Conversas e medir recuperação de carrinho separada dos leads de quiz.';

-- Índice: a tela de Conversas filtra por origem pra destacar recuperação.
create index if not exists idx_whatsapp_contatos_origem
  on whatsapp_contatos (origem);
