-- Coluna categoria de recusa em vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS categoria_recusa text;

-- Tabela de abandono de carrinho
CREATE TABLE IF NOT EXISTS abandono_carrinho (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_nome    text,
  produto_id      text,
  oferta_codigo   text,
  nome            text,
  email           text,
  telefone        text,
  documento       text,
  pais            text,
  checkout_url    text,
  created_at      timestamptz,
  inserted_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abandono_email    ON abandono_carrinho(email);
CREATE INDEX IF NOT EXISTS idx_abandono_created  ON abandono_carrinho(created_at);

-- View recuperacao_vendas usada pelo dashboard
CREATE OR REPLACE VIEW recuperacao_vendas AS
SELECT
  id,
  comprador_nome          AS nome,
  produto_nome,
  valor_bruto             AS valor,
  status,
  comprador_telefone      AS telefone,
  comprador_email         AS email,
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
  created_at,
  NULL::timestamptz       AS recuperado_at
FROM abandono_carrinho;
