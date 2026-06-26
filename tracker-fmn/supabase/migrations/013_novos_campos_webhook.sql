-- Campos novos do webhook Hotmart v4 em vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS afiliado_nome      text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS afiliado_codigo    text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS produto_garantia   timestamptz;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comprador_bairro   text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comprador_end      text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS comprador_cpf      text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS is_assinatura      boolean DEFAULT false;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS is_funil           boolean DEFAULT false;

-- Campos de rastreamento em abandono_carrinho
ALTER TABLE abandono_carrinho ADD COLUMN IF NOT EXISTS sck          text;
ALTER TABLE abandono_carrinho ADD COLUMN IF NOT EXISTS utm_source   text;
ALTER TABLE abandono_carrinho ADD COLUMN IF NOT EXISTS utm_campaign text;
ALTER TABLE abandono_carrinho ADD COLUMN IF NOT EXISTS meta_ad_id   text;

-- Recriar VIEW recuperacao_vendas com campos extras (drop obrigatório para mudar estrutura de colunas)
DROP VIEW IF EXISTS recuperacao_vendas;
CREATE VIEW recuperacao_vendas AS
SELECT
  id,
  comprador_nome          AS nome,
  produto_nome,
  valor_bruto             AS valor,
  status,
  comprador_telefone      AS telefone,
  comprador_email         AS email,
  comprador_cidade        AS cidade,
  comprador_estado        AS estado,
  afiliado_nome,
  motivo_recusa,
  categoria_recusa,
  created_at,
  NULL::timestamptz       AS recuperado_at
FROM vendas
WHERE status IN ('cancelada', 'recuperacao', 'pendente')
UNION ALL
SELECT
  id,
  nome,
  produto_nome,
  NULL::numeric           AS valor,
  'abandono'              AS status,
  telefone,
  email,
  NULL::text              AS cidade,
  NULL::text              AS estado,
  NULL::text              AS afiliado_nome,
  NULL::text              AS motivo_recusa,
  NULL::text              AS categoria_recusa,
  created_at,
  NULL::timestamptz       AS recuperado_at
FROM abandono_carrinho;
