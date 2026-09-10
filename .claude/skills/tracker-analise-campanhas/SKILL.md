---
name: tracker-analise-campanhas
description: >
  Análise das campanhas de tráfego pago (MCV + BLI) do Tracker FMN. Desde 2026-09-09
  o cálculo virou nativo do Tracker: botão "Analisar campanhas" na aba Tráfego chama
  a Edge Function `analise-campanhas` (Deno/TS, zero IA, mesma lógica que nasceu aqui
  como script Python). Esta skill não roda mais script local, ela chama a mesma Edge
  Function via curl e narra o resultado. Use quando o usuário pedir para analisar as
  campanhas, ver como os anúncios estão rodando, pedir "ATP", ou pedir pra ler/interpretar
  o que o botão "Analisar campanhas" do Tracker mostrou.
---

# Análise de Campanhas — Tracker FMN

> Histórico: esta skill nasceu como 3 scripts Python locais (coletar, processar, gerar
> HTML). Em 2026-09-09 a lógica foi portada pra uma Edge Function
> (`tracker-fmn/supabase/functions/analise-campanhas/index.ts`) e um botão nativo na
> aba Tráfego (`tracker-fmn/frontend/app/trafego.jsx`, componente `AnaliseCampanhas`),
> pra não depender de uma sessão do Claude Code rodando toda vez que o Felipe (ou a
> Amanda) quiser ver o número. Os scripts Python foram removidos, a Edge Function é a
> única fonte de verdade agora.

**Dois jeitos de usar, e nenhum precisa de mim pra existir:**

1. **O Felipe/Amanda clicam o botão no Tracker.** Não precisa de mim, o resultado
   aparece na hora, na própria tela. Isso já cobre "ver como as campanhas estão".
2. **Quando o pedido é a mim, pra eu interpretar/diagnosticar**, eu chamo a mesma
   Edge Function (não reescrevo lógica nenhuma, não crio script novo) e narro o
   resultado. Nunca peço pra rodar script Python, esse caminho não existe mais.

---

## Passo 0. Buscar o dado (chamar a Edge Function)

```bash
curl -s -X POST "https://wntzzzuqoqmfcjebmzul.supabase.co/functions/v1/analise-campanhas" \
  -H "Authorization: Bearer ***TOKEN_MASCARADO***" \
  -H "Content-Type: application/json" \
  -o /tmp/tracker-analise-campanhas.json
```

O token é `SUPABASE_SERVICE_KEY` (ou a chave publicável do cliente, `sb_publishable_...`,
já embutida em `tracker-fmn/frontend/app/supabase.js`, também funciona, a Edge Function
não exige service role, só um JWT válido do projeto). Ler o valor real do `.env` na hora
de montar o comando, igual qualquer chamada a Graph API do CLAUDE.md raiz, nunca deixar
o valor literal em nenhum arquivo. Mascarar ao exibir o comando no chat.

Ler `/tmp/tracker-analise-campanhas.json` (é pequeno, já vem calculado). Apagar o
arquivo ao final da conversa.

Se der erro de rede/autenticação, avisar o usuário e não tentar adivinhar credencial.
Se `resumo_por_produto` vier vazio pra um produto (ex: BLI sem nenhum anúncio ativo
hoje), dizer isso com uma linha, não tratar como erro (o `orcamento_receita.por_produto`
continua trazendo o produto mesmo sem ativo, com a receita real da janela se houver).

---

## Passo 1. Honestidade de datas (obrigatório, sempre no topo do relatório)

Antes de qualquer número, declarar:
- `gerado_em_brasilia`: quando esta análise rodou.
- `frescor_dos_dados.ultimo_sync`: até quando o Tracker sincronizou de verdade. Se
  `pode_estar_desatualizado` vier `true`, avisar isso explicitamente antes dos números
  (o `meta-sync` roda de 6 em 6h, mais de ~9h sem sync é sinal de atraso).
- `janelas_declaradas`: a data exata (dd/mm a dd/mm) de cada período usado (7d, 30d,
  maximum), nunca só "últimos 7 dias" sem a data real.
- `orcamento_receita.janela_vendas`: a janela exata usada pra receita.

Mesmo padrão do `/trafego-analise` (Passo 0.55 dele): datas sempre declaradas por
baixo, nunca só rótulo relativo solto no texto.

---

## Passo 2. Narrar o relatório

Sete seções, nesta ordem. Sempre separar por produto (MCV / BLI) dentro de cada seção,
nunca somar os dois num número único (limites de CPA e ticket são diferentes).
Português correto, sem travessão, sem exclamação, direto ao ponto, isto é um relatório
de operação, não copy de venda, então **não passa pela revisora nem pelo checklist
Light Copy**.

### 1. Resumo executivo
Por produto: quantos anúncios ativos, gasto e vendas dos últimos 5 dias, gasto e
vendas históricos totais dos que estão ativos hoje. Uma linha de veredito por produto
(saudável / atenção / vários em risco).

### 2. Radar de regras (G1-G7)
- `radar_regras.pendentes_em_ads_ativos`: alertas pendentes que ainda pertencem a um
  anúncio ativo agora, isso é o que exige atenção real.
- `resumo_por_produto.{produto}.perto_de_pausar`: anúncios cujo CPA de 3d/5d já bateu
  ou está perto do limite, que o `meta-sync` deve pausar sozinho no próximo ciclo
  (até ~6h). Avisar que é automático, não pedir aprovação pra isso, só informar.
- `radar_regras.resolvidos_14d`: pausas reais dos últimos 14 dias, com o motivo. Um
  `ads_numero` nulo é achado real (o `meta-sync` às vezes não grava o número no
  alerta antes do card ser relançado), mostrar como "não identificado".
- Se `pendentes_orfaos_count` for alto, mencionar em uma linha (não exige ação).

### 3. Funil, com leitura VTSD
Usar `funil[]` (métricas do período de 7 dias). Agrupar por produto, ordenar por
ROAS/CPA. Para `gargalo` diferente de `saudavel`, usar `gargalo_detalhe` (já vem
pronto). Quando `leitura_vtsd` vier `esgotou`, `nunca_decolou` ou
`sem_comparacao_confiavel`, usar esse vocabulário (mesma leitura do `/trafego-analise`:
fadiga = "a Urgência Oculta esgotou"; CTR sempre baixo = "essa Urgência Oculta nunca
decolou com esse público", não é fadiga). `leitura_vtsd.aviso_hot_cold` no topo do
JSON explica que o Tracker não sincroniza HOT/COLD/SUPERCOLD, então essa classificação
de público não entra no relatório.

### 4. Fadiga x candidatos a escalar
`fadiga[]`: frequência alta com CTR caindo, candidato a pausar ou trocar criativo.
`candidatos_escala[]`: CPA histórico bem abaixo do limite, 3+ vendas, frequência
ainda baixa, candidato a receber mais orçamento.

### 5. Lifecycle
`lifecycle.campeoes_atuais`: quem está em Campeões hoje. `lifecycle.arquivados_reativaveis`:
arquivados com tag Ótimo/Mediano, candidatos a relançar (cobre todo o histórico,
`lifecycle.cobertura_arquivados` traz a contagem). `lifecycle.ativos_rodando_45d_ou_mais`:
usa a idade do **ad_id atual** (não `ads.created_at`, que pode refletir um bulk import
no banco sem relação com a idade real do criativo no Meta).

### 6. Orçamento e receita real
`orcamento_receita.por_produto` traz duas medidas deliberadamente separadas:
- **Receita líquida na janela declarada** (real, tabela `vendas`) x **gasto estimado
  na mesma janela** (estimativa a partir do ritmo de 5 dias, rotulado como tal). Não
  existe no Tracker um "gasto real de 30 dias" medido com precisão.
- **ROAS de vida inteira dos ativos** (`roas_vida_ativos`), os dois lados vêm de fonte
  confiável agregada por número do card. É a métrica de referência.
- Mencionar a divergência entre `vendas_total_vida_ativos_meta` (o que o Meta/pixel
  reporta) e `n_vendas_vida_ativos_hotmart` (o que a Hotmart aprovou de fato) quando
  forem bem diferentes, é achado real de atribuição.
- `receita_sem_atribuicao_na_janela`: contexto, não é problema.

### Fechamento
Oferecer follow-up sem forçar: comparar dois anúncios, aprofundar um ADS específico.
Sugerir "pode clicar 'Analisar campanhas' de novo no Tracker quando quiser ver ao vivo,
sem precisar de mim" quando fizer sentido.
