# Tracker FMN — Status de Implementação

> Documento vivo. Atualizado conforme avançamos. Última atualização: 2026-06-16

---

## 1. Infraestrutura / Backend

| Item | Descrição | Status |
|---|---|---|
| Banco Supabase | Tabelas `ads`, `vendas`, `despesas`, `insights_cache` | ✅ Pronto |
| Frontend React | App em `frontend/app/*.jsx`, servido na porta 3030 | ✅ Pronto |
| Sync Drive → Supabase | `sync_drive.py` varre pastas e vincula mídia | ✅ Pronto |
| Criar pastas no Drive | `drive_sync_pastas.py` cria pasta p/ AD sem pasta (idempotente) | ✅ Pronto |
| Pasta Criativos pública | Thumbnails carregam sem autenticação | ✅ Pronto |
| Sync vendas Hotmart | `sync_hotmart.py` puxa vendas da API Hotmart | ✅ Pronto |
| Sync insights Meta | `sync_insights.py` agrega gasto/CPA/vendas por criativo (ADS XXX) somando todas as instâncias em todas as campanhas (total + 3d + 5d) | ✅ Pronto |
| Agregação multi-instância | Mesmo criativo em várias campanhas = soma por nome "ADS XXX". 582 anúncios → 291 criativos | ✅ Pronto |
| Sync recorrente x backfill | Recorrente: só `status='ativo'`. Backfill único: `--all`. Reativou? Volta pra Ativos e entra no sync | ✅ Pronto |
| Runner agendado | `sync_runner.py` roda pastas + organizar + drive + hotmart + insights | ✅ Pronto |
| Migração Notion → Supabase | 328 ADs com copy migrada (one-time, Notion descontinuado) | ✅ Concluído |

---

## 2. Banco de Dados (migrações aplicadas)

| Migração | Descrição | Status |
|---|---|---|
| Status enum das colunas | Constraint `ads_status_check` com 5 novos valores | ✅ Aplicado |
| Migração de status | 240 ADs movidos para `fazer/fazendo/ativo/finalizado/arquivado` | ✅ Aplicado |
| Colunas 3d/5d em `ads` | `gasto_3d, vendas_3d, cpa_3d, gasto_5d, vendas_5d, cpa_5d` | ✅ Aplicado |
| Constraint UNIQUE insights | `(meta_ad_id, periodo)` para upsert | ✅ Existente |

---

## 3. Aba Criativos (Kanban)

| Item | Descrição | Status |
|---|---|---|
| 5 colunas novas | Fazer · Fazendo · Ativos · Finalizados · Arquivados | ✅ Pronto |
| Tags Ativos | Teste (estreia) / Recorrência (já rodou) | ✅ Pronto |
| Regras de classificação | Ótimo (≥5 vendas, CPA≤R$207,90), Mediano (1-4 vendas ou gasto≥R$297), Ruim (0 vendas) | ✅ Pronto |
| Modal de detalhe | Campos de copy editáveis (headline, hooks, texto, CTA, título, descrição) | ✅ Pronto |
| Carrossel de mídia | Multi-imagem via `media_files` + fallback `media_drive_url` legado | ✅ Pronto |
| Criar novo AD | Insere no Supabase + pasta no Drive (via runner) | ✅ Pronto |
| Copiar UTM global | Botão no topo | ✅ Pronto |

---

## 4. Aba Visão Geral (Dashboard)

| Item | Descrição | Status |
|---|---|---|
| KPIs reais | Faturamento, Lucro, Gasto Meta, Margem, Vendas, CPA | ✅ Pronto |
| Filtro "Hoje" largura | Bug de encolher a tela corrigido | ✅ Pronto |
| Imposto Meta | Só calcula quando há faturamento (não mostra valor absurdo) | ✅ Pronto |
| Gráfico semanal | Número da barra não corta mais | ✅ Pronto |
| Vendas por Fonte | UTM cru normalizado (Facebook Ads, Instagram, etc.) | ✅ Pronto |
| Ranking de ADs | Thumbnail sem corte (objectFit contain) | ✅ Pronto |
| Gasto/Lucro/Margem por filtro | Gasto agora vem de `gasto_diario` (gasto real por dia, somado no range). Despesas recorrentes prorrateadas pelos dias do período | ✅ Pronto |
| Heatmap Vendas por Período | Respeita o filtro de período selecionado | ✅ Pronto |
| Cards colapsados (2 linhas) | Ranking de ADs e Funil colapsavam a 1px (bug flex). flexShrink:0 corrigiu | ✅ Pronto |
| Recuperação de Vendas | Frontend lê tabela `recuperacao_vendas`. Falta o webhook Hotmart → Supabase popular a tabela | ⚠️ Precisa webhook |
| Sync gasto diário | `sync_insights.py` busca gasto da conta dia a dia (60 dias) → `gasto_diario` | ✅ Pronto |

---

## 5. Aba Financeiro

| Item | Descrição | Status |
|---|---|---|
| Dados da tabela `vendas` | Dinâmico, não tabela estática | ✅ Pronto |
| Presets de período | Hoje, 7d, 30d, Mês, Máximo | ✅ Pronto |
| Período padrão | Mês atual até hoje (inclui vendas novas) | ✅ Pronto |
| Crash do HotmartTab | Campo `preco` inexistente corrigido (preço médio real) | ✅ Pronto |
| Aba Despesas | CRUD de despesas + receitas + balanço | ✅ Pronto |
| Aba Impostos | 3 cards: Imposto sobre Nota (6% editável), Imposto Meta (12,15% editável), Taxa Hotmart. Alíquotas na tabela `config`, clica e edita | ✅ Pronto |
| Imposto sobre Nota | Incide sobre faturamento bruto (Simples Nacional). Aparece no Breakdown do Dashboard e desconta do Lucro Real. Alíquota editável | ✅ Pronto |
| Aba Custo de Produtos | Editável: lê tabela `produtos`, custo editável inline (clica e digita), margem recalcula sozinha. Infoproduto começa em R$ 0 | ✅ Pronto |
| Servidor no-cache | `frontend/serve.py` envia headers no-cache. Evita o navegador servir versões antigas dos .jsx após edições | ✅ Pronto |

---

## 6. Aba Tráfego

| Item | Descrição | Status |
|---|---|---|
| Alertas de regras | RG1-RG6 com sugestão de ação | ✅ Pronto |
| Regras gerais / específicas | Configuração de thresholds | ✅ Pronto |
| Tabela de anúncios reais | Ativos > conjunto > campanha, com gasto/CPA/vendas total+3d+5d | ✅ Pronto (1184 linhas) |
| Botão Sincronizar | Relê o banco com feedback "Sincronizando..." (cron atualiza o banco a cada 5 min) | ✅ Pronto |
| Botão Análise | Análise real: varre os ativos, aplica regras (G1 CPA>ticket, G5 CPA 3d+5d>limite, gasto sem venda) e grava os alertas reais no banco. Sem mais dados fake | ✅ Pronto |
| Ticket/limite corrigidos | TICKET 1497 → 297, limite CPA R$207,90 (70%). Coloração e header corrigidos | ✅ Pronto |

---

## 7. Pendências / A Definir

| Item | Descrição | Prioridade |
|---|---|---|
| Aba Sistema | ✅ FEITO. Conexões, contadores, última sync (tabela sync_status), comandos manuais | ✅ Pronto |
| Custo de Produtos dinâmico | ✅ FEITO. Editável inline, tabela `produtos`, margem recalcula | ✅ Pronto |
| Botão Sincronizar (Tráfego) | Só relê do banco. Para forçar busca nova precisa de ponte frontend↔Python | Média |
| Agendamento automático | ✅ Confirmado: cron a cada 5 min rodando `sync_runner.py` (registra em sync_status) | ✅ Confirmado |
| Seletor de fonte Notion x Meta no modal | Aguardando Meta voltar + seu OK (ver 7.1) | A definir |

---

## 7.1 AGUARDANDO CONFIRMAÇÃO (Meta fora do ar em 2026-06-12)

> Estes itens dependem do Meta voltar para você validar os números antes de prosseguir.

### Cruzamento Notion x Meta — feito, falta validar
- ✅ Dados manuais do Notion (Vendas, CPA, Performance, Status) salvos nas colunas `*_notion` da tabela `ads` (346 ADS).
- ✅ Relatório de divergências gerado: `scripts/relatorio_divergencias_notion.md` (11 divergências de 346).
- ⏳ **A confirmar quando o Meta voltar:** revisar as 11 divergências e decidir caso a caso qual valor vale (Meta automático ou Notion manual).

### As 11 divergências para revisar
| ADS | Vendas Meta | Vendas Notion | CPA Meta | CPA Notion | Decisão |
|----:|------------:|--------------:|---------:|-----------:|---------|
| 12  | 17 | 11 | R$135 | R$168 | ⏳ |
| 49  | 16 | 8  | R$173 | R$256 | ⏳ |
| 185 | 1  | 0  | R$122 | R$29  | ⏳ |
| 245 | 1  | 1  | R$441 | R$210 | ⏳ |
| 246 | 19 | 17 | R$131 | R$139 | ⏳ |
| 252 | 0  | 7  | —     | R$177 | ⏳ (Meta sem dado, provável fallback Notion) |
| 267 | 3  | 1  | R$263 | R$217 | ⏳ |
| 269 | 2  | —  | R$390 | R$255 | ⏳ |
| 284 | 3  | 2  | R$100 | R$126 | ⏳ |
| 314 | 4  | 4  | R$180 | R$305 | ⏳ |
| 320 | 7  | 5  | R$167 | R$124 | ⏳ |

### Ponto de atenção
- **ADS 252:** Meta não tem dado nenhum. Verificar se o anúncio no Meta segue o nome "ADS 252" (a varredura agrupa por nome). Se o nome estiver diferente, corrigir no Meta para o sync capturar.
- **Padrão geral:** Meta tende a mostrar MAIS vendas que o Notion porque agora soma todas as campanhas onde o criativo rodou. Confirmar se faz sentido com o que você lembra de cada criativo.

### Próximo passo proposto (a confirmar)
- ⏳ Construir seletor de fonte no modal do ADS: você escolhe Meta ou Notion por criativo, e o card passa a exibir o valor escolhido. Aguardando seu OK para construir.

### Re-rodar quando o Meta voltar
```
cd tracker-fmn
python3 scripts/sync_insights.py --all     # re-agrega dados do Meta
python3 scripts/sync_notion_dados.py       # re-compara com Notion
```

---

## 9. Backlog — Funcionalidades Futuras

| ID | Funcionalidade | Descrição | Prioridade | Status |
|---|---|---|---|---|
| BKL-001 | Sugestão de criativo ao pausar AD | Quando um anúncio for pausado (via bell confirm na interface ou via sync Python), o app deve indicar automaticamente um criativo sugerido para colocar no lugar. Detalhes do comportamento a definir pelo usuário em sessão futura. | Alta | 📋 Backlog |

---

## 8. Bugs conhecidos resolvidos nesta sessão

- ✅ Thumbnail cortada no ranking
- ✅ Filtro "Hoje" encolhia a tela
- ✅ Imposto Meta mostrava valor negativo absurdo
- ✅ Número da barra do gráfico semanal cortado
- ✅ Vendas por Fonte com URL UTM crua
- ✅ Sync insights erro 37 meses (date_preset)
- ✅ Sync insights erro 409 (on_conflict na URL)
- ✅ Colunas 3d/5d faltando na tabela ads
- ✅ Crash do HotmartTab (campo preco)
