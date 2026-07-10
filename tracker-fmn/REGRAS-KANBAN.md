# Regras do Kanban — Tracker FMN
> Aprovadas em 2026-06-20. Revisadas em 2026-07-10 (remoção de Teste/Recorrência,
> saída de Ativos só reativa, remoção da coluna Testar novamente).
> Fonte de verdade para implementação e futuras revisões.
> Fórmula implementada em `supabase/functions/_shared/classificar.ts`
> (compartilhada por `kanban-sync` e `processar-pausas`) e espelhada em
> `frontend/app/kanban.jsx` (`classifyAd`/`resolveTag`, browser não importa Deno).

## Produto
- Ticket: R$297

---

## Tags de Performance

Todo cálculo usa a **somatória histórica** do criativo (todas as campanhas/instâncias
de anúncio que já rodaram com aquele número), nunca só a instância atual.

| Tag | Condição |
|---|---|
| **Ótimo** | ≥ 5 vendas E (CPA < R$297 OU CPA indefinido) |
| **Testar novamente** | 0 vendas E gasto < R$297 — OU — fez venda, gasto < R$297 E CPA < R$297 |
| **Ruim** | 0 vendas E gasto ≥ R$297 |
| **Mediano** | qualquer outro caso (ex.: 1+ venda com gasto ≥ R$297 e CPA ≥ R$297, ou ≥5 vendas com CPA ≥ R$297) |

Não existem mais as tags **Teste** e **Recorrência**. Cards em Fazer/Fazendo/Ativos
não recebem tag automática nenhuma (campo fica nulo). Tag só é calculada para
Campeões (sempre Ótimo) e Arquivados (Testar novamente / Mediano / Ruim).

---

## Colunas — Regras de Entrada e Saída

### Fazer
- **Entra:** card criado (padrão)
- **Tag:** sem tag
- **Sai para:** Fazendo (automático ao receber mídia via importação do Drive — regra
  vale para qualquer forma de importar, ver seção "KANBAN" do CLAUDE.md raiz)

### Fazendo
- **Entra:** sync detecta arquivo de mídia gravado no card
- **Tag:** sem tag
- **Sai para:** Ativos (automático quando o anúncio é publicado e fica ACTIVE no Meta)

### Ativos
- **Entra:** meta_ad_id preenchido + anúncio ACTIVE no Meta (vindo de Fazer/Fazendo)
- **Tag:** nenhuma (nunca recebe Ótimo/Testar novamente/Mediano/Ruim enquanto ativo)
- **Sai para:** só quando o anúncio **para de rodar de verdade no Meta** (pausa via
  `processar-pausas`, reagindo ao alerta G5 de CPA). **Nunca sai automaticamente só
  por performance enquanto ainda está rodando/gastando** — essa foi uma correção
  explícita: um card em Ativos reflete o que está de fato ativo no Meta, e
  classificação de performance só se aplica no momento em que o anúncio é
  efetivamente pausado.

### Campeões
- **Entra:** tag calculada = Ótimo (a partir de Ativos via pausa, ou recalculado a
  partir de Arquivados)
- **Tag:** Ótimo
- **Sai para:** Arquivados, se a tag recalculada deixar de ser Ótimo

### Arquivados
- **Entra:** tag calculada = Testar novamente, Mediano ou Ruim (a partir de Ativos via
  pausa, ou de Campeões se a tag deixar de ser Ótimo)
- **Tag:** mantém a tag recalculada (Testar novamente / Mediano / Ruim), reclassificada
  a cada rodada de sync
- **Sai para:** Campeões, se a tag recalculada virar Ótimo

> A coluna "Testar novamente" foi removida em 2026-07-10 (migração 063). A
> etiqueta continua existindo, mas como uma tag dentro de Arquivados — filtrável
> pela tag, sem ser uma coluna própria do Kanban.

---

## Automações

| Trigger | Ação |
|---|---|
| Mídia gravada no card em "Fazer" | Move para "Fazendo" automaticamente |
| Anúncio publicado e vira ACTIVE no Meta | Move para "Ativos", sem tag |
| Anúncio pausado no Meta (via `processar-pausas`, reagindo a alerta G5) | Recalcula tag e move para Campeões (Ótimo) ou Arquivados (Testar novamente/Mediano/Ruim) |
| Card em Campeões recalculado e deixa de ser Ótimo | Move para Arquivados com a nova tag |
| Card em Arquivados recalculado e vira Ótimo | Move para Campeões |
| Card em Arquivados recalculado com tag diferente da atual | Atualiza a tag, permanece em Arquivados |

---

## Constantes
```
TICKET_VAL = 297.00
```

---

## Concorrência

`kanban-sync` (rota `scope=maximo` e `scope=completo`) usa uma trava em banco
(`kanban_sync_lock`, expira em 10 min) para impedir que duas execuções pesadas
rodem em paralelo e corrompam os agregados por escrita intercalada. Se já tem uma
varredura rodando, a chamada nova retorna `{ok:true, aviso:"já tem uma varredura
rodando, pulei esta"}` sem fazer nada.

`scope=completo` recalcula TODOS os anúncios (inclusive arquivados antigos, cujos
números ficavam congelados desde a última vez que estiveram ativos) usando
`date_preset=maximum` — é o recálculo de referência a rodar quando a fórmula de
classificação mudar.
