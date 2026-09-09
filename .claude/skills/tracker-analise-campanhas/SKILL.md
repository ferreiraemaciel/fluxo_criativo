---
name: tracker-analise-campanhas
description: >
  Análise narrada das campanhas de tráfego pago que estão rodando de verdade no Tracker FMN
  (MCV e Blindagem juntos, separados por produto). Lê direto do Supabase do Tracker — nunca da
  Graph API do Meta, nunca do Notion — porque o Tracker já sincroniza tudo sozinho (meta-sync,
  kanban-sync) e já roda as regras G1-G7 de pausa automática. Cobre saúde geral, radar de regras
  (quem está perto de ser pausado sozinho), funil (onde cada anúncio ativo está vazando) com
  leitura VTSD (Urgência Oculta esgotou x nunca decolou), fadiga de criativo x candidatos a
  escalar, lifecycle (campeões e arquivados reativáveis) e orçamento x receita líquida real da
  Hotmart. Toda métrica declara a janela de data exata e se o dado está atualizado. Pode gerar
  um dashboard HTML autocontido além do texto. Use quando o usuário pedir para analisar as
  campanhas, ver como os anúncios estão rodando, rodar a análise do Tracker, ou pedir "ATP"
  (substitui o fluxo antigo de ATP via Notion/Graph API, hoje obsoleto).
---

# Análise de Campanhas — Tracker FMN

Relatório único, direto, sem menu de saídas. O Tracker já faz a sincronização e a pausa automática (G1-G7) sozinho; esta skill só lê o que já está lá e narra o diagnóstico. Nenhuma chamada à Graph API do Meta, nenhuma consulta ao Notion.

**Produtos cobertos:** MCV e BLI, sempre juntos, com corte por produto no relatório (cada um tem ticket e CPA limite próprios, lidos de `regras_atp`). Um produto sem nenhum anúncio ativo ainda aparece na seção de orçamento (com receita real, se houver), nunca desaparece do relatório.

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

Ler `/tmp/tracker-analise-processado.json` (é pequeno, já vem calculado, não ler `/tmp/tracker-analise-bruto.json`, que é o dado cru e pesado).

**Opcional, se o usuário quiser o dashboard visual** (padrão pra uso recorrente/diário, já que não gera texto por IA, é tudo template):
```bash
python3 .claude/skills/tracker-analise-campanhas/scripts/gerar_relatorio_html.py --in /tmp/tracker-analise-processado.json --out <caminho>.html
```
Salvar em `meus-produtos/{produto MCV ou pasta própria do Tracker}/entregas/` não se aplica aqui (não é material de produto VTSD); usar um caminho estável tipo `tracker-fmn/relatorio-campanhas.html` (não versionado, adicionar ao `.gitignore` do tracker-fmn se ainda não estiver) e informar o caminho absoluto no chat, igual qualquer outro arquivo salvo. Enviar o arquivo ao usuário (`SendUserFile`) além de informar o caminho.

Ao final da sessão, apagar os temporários de coleta: `rm /tmp/tracker-analise-bruto.json /tmp/tracker-analise-processado.json` (o HTML final, se gerado, fica).

Se o script falhar com erro de `.env`, é porque `tracker-fmn/.env` não tem `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`, avisar o usuário, não tentar adivinhar credencial nem pedir token no chat.

---

## Passo 1. Honestidade de datas (obrigatório, sempre no topo do relatório)

Antes de qualquer número, declarar:
- `gerado_em_brasilia`: quando esta análise rodou.
- `frescor_dos_dados.ultimo_sync`: até quando o Tracker sincronizou de verdade. Se `pode_estar_desatualizado` vier `true`, avisar isso explicitamente antes dos números (o `meta-sync` roda de 6 em 6h, então mais de ~9h sem sync é sinal de atraso).
- `janelas_declaradas`: a data exata (dd/mm a dd/mm) de cada período usado (7d, 30d, maximum), nunca só "últimos 7 dias" sem a data real. Se `homogenea` vier `false`, avisar que nem todo anúncio está na mesma janela.
- `orcamento_receita.janela_vendas`: a janela exata usada pra receita.

Isso segue o mesmo padrão do `/trafego-analise` (Passo 0.55 dele): datas sempre declaradas em ISO/dd-mm por baixo, nunca só rótulo relativo solto no texto.

---

## Passo 2. Narrar o relatório

Sete seções, nesta ordem. Sempre separar por produto (MCV / BLI) dentro de cada seção, nunca somar os dois num número único (limites de CPA e ticket são diferentes). Português correto, sem travessão, sem exclamação, direto ao ponto, isto é um relatório de operação, não copy de venda, então **não passa pela revisora nem pelo checklist Light Copy** (essas regras valem para material de venda, não para diagnóstico técnico).

### 1. Resumo executivo
Por produto: quantos anúncios ativos, gasto e vendas dos últimos 5 dias, gasto e vendas históricos totais dos que estão ativos hoje. Uma linha de veredito por produto (saudável / atenção / vários em risco).

### 2. Radar de regras (G1-G7)
- `radar_regras.pendentes_em_ads_ativos`: alertas pendentes que ainda pertencem a um anúncio ativo agora, isso é o que exige atenção real.
- `resumo_por_produto.{produto}.perto_de_pausar`: anúncios cujo CPA de 3d/5d já bateu ou está perto do limite, que o `meta-sync` deve pausar sozinho no próximo ciclo (até ~6h). Avisar que é automático, não pedir aprovação pra isso, só informar o que vai acontecer.
- `radar_regras.resolvidos_14d`: pausas reais que já aconteceram nos últimos 14 dias, com o motivo (regra G1/G5/G6). Um `ads_numero` nulo nesse histórico é achado real (bug conhecido: `meta-sync` às vezes não grava o número no alerta antes do card ser relançado), mostrar como "não identificado" em vez de esconder ou inventar o número.
- Se `pendentes_orfaos_count` for alto, mencionar em uma linha que existem N alertas antigos de anúncios que já saíram do ar (não afeta nada hoje).

### 3. Funil, com leitura VTSD
Usar `funil[]` (métricas do período de 7 dias). Agrupar por produto, ordenar por ROAS/CPA. Para cada `gargalo` diferente de `saudavel`, explicar com a métrica real (`gargalo_detalhe` já vem pronto): CTR baixo é problema de criativo, connect rate baixo é problema de página/link, conv_pagina baixa é problema de oferta/copy na página, checkout_rate baixo é problema no pagamento.

Quando `leitura_vtsd` de um item vier `esgotou`, `nunca_decolou` ou `sem_comparacao_confiavel`, usar esse vocabulário na narração (é a mesma leitura que o `/trafego-analise` usa: fadiga = "a Urgência Oculta esgotou"; CTR sempre baixo = "essa Urgência Oculta nunca decolou com esse público", não é fadiga, é oferta/gancho que não encontrou o problema certo). O bloco `leitura_vtsd` no topo do JSON já traz a contagem consolidada e o aviso de que o Tracker não sincroniza HOT/COLD/SUPERCOLD (público por temperatura), então essa classificação de público não entra no relatório, só funil e fadiga de criativo.

### 4. Fadiga x candidatos a escalar
`fadiga[]`: frequência alta (2.5+) com CTR caindo em relação aos últimos 30 dias, sinal de cansaço, candidato a pausar ou trocar criativo. `candidatos_escala[]`: CPA histórico bem abaixo do limite, 3+ vendas, frequência ainda baixa, candidato a receber mais orçamento.

### 5. Lifecycle
`lifecycle.campeoes_atuais`: quem está na coluna Campeões hoje (referência do que funciona). `lifecycle.arquivados_reativaveis`: arquivados com tag Ótimo/Mediano no passado, candidatos a relançar com o mesmo número (cobre todo o histórico de arquivados da conta, `lifecycle.cobertura_arquivados` traz a contagem total varrida). `lifecycle.ativos_rodando_45d_ou_mais`: quem tem o **ad_id atual** rodando há 45+ dias sem refresh. Importante: isso usa a idade do anúncio no Meta (`insights_cache periodo=maximum`), nunca `ads.created_at` do card, porque um lote inteiro de cards pode ter sido criado de uma vez só no banco (achado real, 11/06/2026) sem relação nenhuma com quando o criativo de fato entrou no ar, um card "antigo" no Tracker pode estar rodando um relançamento de poucos dias.

### 6. Orçamento e receita real
`orcamento_receita.por_produto` traz duas medidas deliberadamente separadas, nunca fundir as duas num "ROAS 30d" único:
- **Receita líquida na janela declarada** (`receita_liquida_janela`, dado real, direto da tabela `vendas`) contra **gasto estimado na mesma janela** (`gasto_estimado_mesma_janela`, estimativa a partir do ritmo confiável de 5 dias, `media_diaria_5d × 30`, rotulado como estimativa). Não existe hoje no Tracker um "gasto real dos últimos 30 dias" medido com precisão (`insights_cache periodo=30d` só tem umas dezenas de linhas na conta inteira, cobre só o que está sendo sincronizado ativamente agora, sempre subconta quando um anúncio foi relançado dentro da janela).
- **ROAS de vida inteira dos anúncios ativos agora** (`roas_vida_ativos` = `receita_vida_ativos ÷ gasto_vida_ativos`), os dois lados vêm de fonte confiável e agregada por número do card, então são comparáveis de verdade. É a métrica de referência pra dizer se o que está rodando hoje está pagando o próprio gasto.
- Mencionar a divergência entre `vendas_total_vida_ativos_meta` (o que o Meta/pixel reporta como conversão) e `n_vendas_vida_ativos_hotmart` (o que a Hotmart aprovou de fato com esse `ads_numero` atribuído) quando os dois números forem bem diferentes, isso é achado real de atribuição, não erro do relatório.
- `receita_sem_atribuicao_na_janela`: receita da janela que não veio de nenhum anúncio rastreado (orgânico, direto, WhatsApp), é contexto, não é problema.

### Fechamento
Terminar oferecendo follow-up, sem forçar: comparar dois anúncios específicos lado a lado, aprofundar um ADS específico, ou gerar o dashboard em HTML se ainda não foi gerado (nesses casos, os dados já coletados no processado geralmente bastam, só rodar os scripts de novo se o usuário pedir algo fora da janela já coletada).

```
✅ Concluído: análise das campanhas do Tracker.
```
