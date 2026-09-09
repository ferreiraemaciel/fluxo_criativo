---
name: tracker-analise-campanhas
description: >
  Análise narrada das campanhas de tráfego pago que estão rodando de verdade no Tracker FMN
  (MCV e Blindagem juntos, separados por produto). Lê direto do Supabase do Tracker — nunca da
  Graph API do Meta, nunca do Notion — porque o Tracker já sincroniza tudo sozinho (meta-sync,
  kanban-sync) e já roda as regras G1-G7 de pausa automática. Cobre saúde geral, radar de regras
  (quem está perto de ser pausado sozinho), funil (onde cada anúncio ativo está vazando),
  fadiga de criativo x candidatos a escalar, lifecycle (campeões e arquivados reativáveis) e
  orçamento x receita líquida real da Hotmart. Use quando o usuário pedir para analisar as
  campanhas, ver como os anúncios estão rodando, rodar a análise do Tracker, ou pedir "ATP"
  (substitui o fluxo antigo de ATP via Notion/Graph API, hoje obsoleto).
---

# Análise de Campanhas — Tracker FMN

Relatório único, direto, sem menu de saídas. O Tracker já faz a sincronização e a pausa automática (G1-G7) sozinho; esta skill só lê o que já está lá e narra o diagnóstico. Nenhuma chamada à Graph API do Meta, nenhuma consulta ao Notion.

**Produtos cobertos:** MCV e BLI, sempre juntos, com corte por produto no relatório (cada um tem ticket e CPA limite próprios, lidos de `regras_atp`).

---

## Passo 0. Anunciar e coletar

Anunciar antes de rodar:
```
🔍 Próximo passo: buscar os dados das campanhas ativas no Tracker e montar o diagnóstico (2 passos). Tempo estimado: cerca de 45 segundos.
```

Rodar os dois scripts em sequência, usando um caminho de arquivo temporário fora do repositório:

```bash
python3 .claude/skills/tracker-analise-campanhas/scripts/coletar_dados.py --out /tmp/tracker-analise-bruto.json
```

```bash
python3 .claude/skills/tracker-analise-campanhas/scripts/processar_analise.py --in /tmp/tracker-analise-bruto.json > /tmp/tracker-analise-processado.json
```

Ler `/tmp/tracker-analise-processado.json` (é pequeno, já vem calculado — não ler `/tmp/tracker-analise-bruto.json`, que é o dado cru e pesado). Ao final da sessão, apagar os dois arquivos temporários (`rm /tmp/tracker-analise-bruto.json /tmp/tracker-analise-processado.json`).

Se o script falhar com erro de `.env`, é porque `tracker-fmn/.env` não tem `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` — avisar o usuário, não tentar adivinhar credencial nem pedir token no chat.

Se `resumo_por_produto` vier vazio para um produto (ex: BLI sem nenhum anúncio ativo hoje), dizer isso com uma linha, não tratar como erro.

---

## Passo 1. Narrar o relatório

Seis seções, nesta ordem. Sempre separar por produto (MCV / BLI) dentro de cada seção — nunca somar os dois num número único, os limites de CPA e ticket são diferentes. Português correto, sem travessão, sem exclamação, direto ao ponto — isto é um relatório de operação, não copy de venda, então **não passa pela revisora nem pelo checklist Light Copy** (essas regras valem para material de venda, não para diagnóstico técnico).

### 1. Resumo executivo
Por produto: quantos anúncios ativos, gasto e vendas dos últimos 5 dias, gasto e vendas históricos totais dos que estão ativos hoje. Uma linha de veredito por produto (saudável / atenção / vários em risco).

### 2. Radar de regras (G1-G7)
- `radar_regras.pendentes_em_ads_ativos`: alertas pendentes que ainda pertencem a um anúncio ativo agora — isso é o que exige atenção real.
- `radar_regras.quase_disparando` (dentro de cada produto em `resumo_por_produto.perto_de_pausar`): anúncios cujo CPA de 3d/5d já bateu ou está perto do limite, que o `meta-sync` deve pausar sozinho no próximo ciclo (até ~6h). Avisar que é automático, não pedir aprovação pra isso — só informar o que vai acontecer.
- `radar_regras.resolvidos_14d`: pausas reais que já aconteceram nos últimos 14 dias, com o motivo (regra G1/G5/G6).
- Se `pendentes_orfaos_count` for alto, mencionar em uma linha que existem N alertas antigos de anúncios que já saíram do ar (não afeta nada hoje, é só sinal de que o `processar-pausas` não está marcando como resolvido — mencionar como observação, não investigar a fundo aqui).

### 3. Funil — onde cada anúncio vaza
Usar `funil[]` (métricas do período de 7 dias). Agrupar por produto, ordenar por ROAS/CPA. Para cada `gargalo` diferente de `saudavel`, explicar com a métrica real (`gargalo_detalhe` já vem pronto) — CTR baixo é problema de criativo, connect rate baixo é problema de página/link, conv_pagina baixa é problema de oferta/copy na página, checkout_rate baixo é problema no pagamento.

### 4. Fadiga x candidatos a escalar
`fadiga[]`: frequência alta (2.5+) com CTR caindo em relação aos últimos 30 dias — sinal de cansaço, candidato a pausar ou trocar criativo. `candidatos_escala[]`: CPA histórico bem abaixo do limite, 3+ vendas, frequência ainda baixa — candidato a receber mais orçamento.

### 5. Lifecycle
`lifecycle.campeoes_atuais`: quem está na coluna Campeões hoje (referência do que funciona). `lifecycle.arquivados_reativaveis`: arquivados com tag Ótimo/Mediano no passado — candidatos a relançar com o mesmo número. `lifecycle.ativos_rodando_45d_ou_mais`: ativos há 45+ dias sem card novo — candidato a refresh de criativo mesmo que ainda esteja saudável.

### 6. Orçamento e receita real
`orcamento_receita.por_produto`: gasto aproximado dos últimos 30 dias, ritmo diário recente (média 5d), projeção pro resto do mês, receita líquida real da Hotmart nos últimos 30 dias atribuída a cada produto (via `ads_numero`), e ROAS real (receita líquida ÷ gasto Meta — diferente do ROAS que o Meta reporta, porque usa o valor líquido de verdade, já com taxa da Hotmart descontada). Mencionar `receita_sem_atribuicao_30d` como a receita do período que não veio de nenhum anúncio rastreado (orgânico, direto, WhatsApp) — é contexto, não é problema.

### Fechamento
Terminar oferecendo follow-up, sem forçar: comparar dois anúncios específicos lado a lado, ou aprofundar um ADS específico (nesses casos, os dados já coletados no processado geralmente bastam; só rodar os scripts de novo se o usuário pedir algo fora da janela já coletada).

```
✅ Concluído: análise das campanhas do Tracker.
```
