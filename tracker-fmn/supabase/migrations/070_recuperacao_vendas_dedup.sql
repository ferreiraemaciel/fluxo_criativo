-- Migration 070: dedup na view recuperacao_vendas.
-- Antes: UNION ALL entre vendas (cancelada/recuperacao/pendente) e
-- abandono_carrinho sem exclusão nenhuma. Quando a Hotmart manda o evento
-- de abandono de carrinho E, depois, um evento de recuperação/cancelamento
-- pra mesma pessoa/produto, ela aparecia duas vezes na lista (o "Samyra
-- duplicada" reportado). A linha de vendas tem mais dado (cidade, estado,
-- motivo_recusa, valor), então ela é a preferida: a linha de abandono_carrinho
-- só entra se NÃO existir uma venda com o mesmo e-mail para o mesmo produto
-- nos status que já cobrem esse carrinho.
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
  ac.id,
  ac.nome,
  ac.produto_nome,
  NULL::numeric           AS valor,
  'abandono'              AS status,
  ac.telefone,
  ac.email,
  NULL::text              AS cidade,
  NULL::text              AS estado,
  NULL::text              AS afiliado_nome,
  NULL::text              AS motivo_recusa,
  NULL::text              AS categoria_recusa,
  ac.created_at,
  NULL::timestamptz       AS recuperado_at
FROM abandono_carrinho ac
WHERE NOT EXISTS (
  SELECT 1 FROM vendas v
  WHERE v.status IN ('cancelada', 'recuperacao', 'pendente')
    AND v.comprador_email = ac.email
    AND v.produto_nome IS NOT DISTINCT FROM ac.produto_nome
);
