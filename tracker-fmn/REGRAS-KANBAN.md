# Regras do Kanban — Tracker FMN
> Aprovadas em 2026-06-20. Fonte de verdade para implementação e futuras revisões.

## Produto
- Ticket: R$297
- CPA limite: R$207,90 (70% do ticket)
- Gasto mínimo para teste válido: R$145,53 (70% do CPA limite)

---

## Tags de Performance

| Tag | Condição |
|---|---|
| **Ótimo** | ≥ 5 vendas E CPA < R$297 |
| **Mediano** | 1 a 4 vendas — OU — ≥ 5 vendas com CPA ≥ R$297 |
| **Ruim** | 0 vendas E gasto < R$145,53 |
| **Testar novamente** | 0 vendas E gasto ≥ R$145,53 |
| **Teste** | Entrando em Ativos vindo de Fazendo ou Testar novamente |
| **Recorrência** | Entrando em Ativos vindo de Campeões |

Recorrência pausada: ao sair de Campeões, recalcula para Ótimo/Mediano/Ruim pelas regras acima.

---

## Colunas — Regras de Entrada e Saída

### Fazer
- **Entra:** card criado (padrão)
- **Tag:** sem tag
- **Sai para:** Fazendo (sync auto ao detectar criativo no Drive)

### Fazendo
- **Entra:** sync detecta arquivo de mídia na pasta do Drive do AD
- **Tag:** sem tag
- **Sai para:** Ativos (automático ao criar anúncio no Meta)

### Ativos
- **Entra:** meta_ad_id preenchido + anúncio ACTIVE no Meta
- **Tag ao entrar:**
  - Vindo de Fazendo → **Teste**
  - Vindo de Campeões → **Recorrência**
  - Vindo de Testar novamente → **Teste**
- **Sai para:** Campeões, Testar novamente ou Arquivados (por sugestão automática)

### Campeões
- **Entra:** tag calculada = Ótimo
- **Tag:** Ótimo
- **Sai para:** Ativos (manual, vira Recorrência)

### Testar novamente
- **Entra:** tag calculada = Testar novamente
- **Tag:** Testar novamente
- **Sai para:**
  - Ativos (manual → vira Teste)
  - Arquivados (botão "Retirar do teste" OU regras Mediano/Ruim se preenchidas)

### Arquivados
- **Entra:** tag calculada = Mediano ou Ruim (vindo de Ativos ou Testar novamente)
- **Tag:** mantém a tag recalculada (Mediano ou Ruim)

---

## Automações

| Trigger | Ação |
|---|---|
| Sync detecta mídia no Drive de AD em "Fazer" | Move para "Fazendo" automaticamente |
| AD criado no Meta (meta_ad_id salvo) | Move para "Ativos", tag = Teste |
| Tag calculada vira Ótimo (em Ativos) | Sugere mover para Campeões |
| Tag calculada vira Testar novamente (em Ativos) | Sugere mover para Testar novamente |
| Tag calculada vira Mediano ou Ruim (em Ativos ou Testar novamente) | Sugere mover para Arquivados |
| Botão "Retirar do teste" em card na coluna Testar novamente | Move para Arquivados, recalcula tag |
| Card movido manualmente para Ativos vindo de Campeões | Tag = Recorrência |
| Card pausado/saindo de Campeões | Recalcula tag: Ótimo / Mediano / Ruim |

---

## Constantes
```
TICKET_VAL     = 297.00
CPA_LIMITE     = 207.90   (70% do ticket)
GASTO_MIN_TEST = 145.53   (70% do CPA limite)
```
