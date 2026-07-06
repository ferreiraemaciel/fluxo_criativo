# PROMPT FINAL: Investigar Criativos Escalados na Biblioteca da Meta (Multi-Mercado)

> Cole esse bloco no início de uma nova conversa, edite só a seção VARIÁVEIS.
> Resultado: arquivo `criativos-escalados.html` na pasta do projeto, tema claro, links clicáveis, filtro por mercado.

---

## VARIÁVEIS (edite antes de usar)

- **NICHO ESPECÍFICO:** `[ex: marketing digital e infoprodutos / lançamento de cursos online]`
- **Concorrentes que eu já quero investigar:** `[liste os nomes]`
- **Concorrentes adicionais a descobrir:** `4 brasileiros + 4 em inglês (US) + 4 em espanhol (LATAM/Espanha)`
- **Países de cobertura:** Brasil (BR), Estados Unidos (US), México (MX), Argentina (AR), Colômbia (CO), Espanha (ES)
- **Critério de escala:** o mesmo criativo usado em 3 ou mais anúncios distintos

---

## REGRA CRÍTICA DE NICHO (LEIA E APLIQUE)

Filtre com rigor. Antes de incluir qualquer concorrente no relatório final, faça este teste com o criativo mais escalado dele: "isso ensina alguma habilidade do meu nicho específico?". Se a resposta for "sim, totalmente", inclui. Se for "talvez, é mais sobre mentalidade/vida/relacionamento/imóveis", marque como "PIVOTOU PARA FORA DO NICHO" e mantenha no relatório como nota estratégica.

Para nicho de marketing digital e infoprodutos:

- INCLUIR: tráfego pago, copywriting, lançamento, gestor de tráfego, criação de produto digital, afiliação, funil de venda, automação de marketing, IA aplicada a marketing, vendas digitais 1-on-1
- EXCLUIR ou MARCAR COMO PIVOT: coaches de mentalidade pura (PROTAGON style), terapeutas, palestrantes religiosos, mentores de relacionamento, conferências cristãs, real estate, eyewear D2C, aposentadoria, finanças pessoais

Concorrentes conhecidos que JÁ migraram de nicho (não esperar ads de marketing digital deles): Ícaro de Carvalho (foi para aposentadoria/imóveis), Iman Gadzhi (foi para HILLS Eyewear), Carlos Master Muñoz (foi para real estate Querétaro/Yucatán), Wendell Carvalho (foi pesado para Imersão Protagon mentalidade, com sobra de Sprint Digital).

---

## ATALHO ESSENCIAL (não perca tempo descobrindo de novo)

A Biblioteca da Meta hoje mostra abaixo de cada anúncio a etiqueta "X ads use this creative and text" (em outros idiomas: "X anúncios usam este conteúdo" / "X anuncios usan este creative"). Esse número é a métrica de escala. Nunca compare miniaturas visualmente nem clique em "See ad details" um por um. Apenas:

1. `mcp__Claude_in_Chrome__navigate` para a URL da Biblioteca
2. `mcp__Claude_in_Chrome__get_page_text` para extrair o texto inteiro
3. Procure pelo regex `(\d+)\s+ads?\s+use\s+this\s+creative` no resultado
4. Tudo com X >= 3 é escalado

"This ad has multiple versions" sem número, ignore.

---

## URL DA BIBLIOTECA (template)

```
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country={CODIGO}&q={NOME_URL_ENCODED}&search_type=keyword_unordered&media_type=all&sort_data[mode]=total_impressions&sort_data[direction]=desc
```

Códigos de país que cobrem o nicho: BR, US, MX, AR, CO, ES. Use cada um conforme o mercado do concorrente. Espere 5 segundos depois do navigate antes de extrair.

---

## FALLBACKS DE NOMES POR MERCADO (use quando precisar descobrir)

Brasil (vão te dar criativos escalados):
- Erico Rocha, Pedro Sobral, Felipe Azevedo, Pri Calheiros, Conrado Adolpho, Tiago Tessmann, Italo Marsili, Bruno Avila, Paulo Cuenca, Rodrigo Vincenzi, Rafael Rez, Alex Vargas (low ticket sem escala), Marcelo Tavara (alta rotação), Marcelo Braggion (alta rotação), Micha Menezes (alta rotação)

Estados Unidos (inglês):
- Alex Hormozi (Acquisition.com + Skool), Sabri Suby (Sell Like Crazy book funnel), Russell Brunson (ClickFunnels, baixa escala), Iman Gadzhi (PIVOT eyewear, evitar), Sam Ovens, Tai Lopez, Frank Kern, Brendon Burchard, Pat Flynn

LATAM/Espanha (espanhol):
- Josue Peña (top finding, vendedor digital certificado, mercado US-Hispano), Vilma Núñez (curso $47 marca personal), Carlos Master Muñoz (PIVOT real estate, evitar), Romuald Fons, Pau Ninja, Joan Boluda, Convertia, Cristóbal Amatriain, Juan Diego Gómez

Os nomes em LATAM/Espanha frequentemente retornam zero anúncios na Biblioteca. Tenha 2 a 3 fallbacks prontos por se algum não tiver ads ativos.

---

## PROBLEMA DE PERMISSÃO (avisar o aluno)

A cada navigate e get_page_text para `facebook.com`, o Claude in Chrome pede permissão. Hoje o pop-up NÃO tem opção "Permitir sempre". O aluno vai precisar aprovar manualmente cada chamada (~28 cliques para 14 concorrentes). Avise antes de começar: "vou disparar 14 buscas em sequência, cada uma vai pedir permissão duas vezes (navigate e get_page_text), pode aprovar tudo de uma rajada".

Se uma chamada der "Tool permission stream closed" ou "Permission denied", retente o tool individual.

---

## SAÍDA OBRIGATÓRIA: HTML COM TEMA CLARO

Crie um arquivo único `criativos-escalados.html` self-contained na pasta do projeto. NÃO salve na área de trabalho (sandbox não acessa `~/Desktop`).

Paleta obrigatória (light theme):

```
--bg: #ffffff       --text: #1a2238
--bg-soft: #f7f9fc  --text-soft: #5b6478
--border: #e5eaf2   --accent: #2563eb
--hot: #dc2626 (20+ anúncios)    --warm: #ea580c (10-19)
--cool: #2563eb (5-9)            --base: #6b7280 (3-4)
```

Tipografia: Inter (Google Fonts). Pesos 400/500/600/700/800.

Estrutura:

1. Header com eyebrow ("Inteligência de Tráfego"), H1, subtitle e chips no topo (data, status, critério, mercados)
2. 4 cards de stats no topo (concorrentes investigados, criativos escalados encontrados, maior escala individual, maior escala fora do BR)
3. Filtro por mercado com 4 botões (Todos / 🇧🇷 Brasil / 🇺🇸 English / 🌎 Español) que mostra/esconde competitors via JS
4. Nav sticky com link para cada concorrente + Resumo Estratégico, contagem de criativos em badge
5. Cards de concorrente. Cada um com `data-region="br|en|es"` para o filtro funcionar. Bandeira emoji no nome (🇧🇷 🇺🇸 🇩🇴 🇲🇽 🇪🇸)
6. Cada criativo é um card. Esquerda: número grande colorido por escala. Direita: descrição da copy/hook, Library ID em fonte mono, link "Ver anúncio" para a Biblioteca
7. Bloco "Padrão Identificado" para cada concorrente em fundo `--accent-soft`
8. Para concorrentes sem criativos escalados, use bloco `empty-state` (fundo laranja claro) explicando o motivo: "alta rotação", "pivot de nicho", "volume excede extração"
9. Resumo Estratégico em 3 colunas: "Quem mais escala UM criativo" / "Sem escala (alta rotação)" / "Fora do nicho atual"
10. Box "Padrão comum entre os que escalam" + box "Diferenças entre mercados" (5 bullets cada, gradient suave)
11. Footer com data e critério

UX:
- Mobile responsive (breakpoint 640px e 768px)
- Hover suave nos cards de criativo
- Scroll suave nos links da nav
- Filtro de país com transição (display none/block)
- Sem dependências além do Google Fonts
- Links de anúncio em `_blank` com `rel="noopener"`

---

## REGRAS DE EXECUÇÃO

1. NÃO use travessão (—) em nenhuma parte. Substitua por vírgula, ponto ou dois pontos.
2. Português brasileiro com acentuação correta nos textos em pt_BR. Inglês correto em textos em inglês. Espanhol correto em textos em espanhol.
3. Anuncie o próximo passo antes de operações longas: `🔍 Próximo passo: investigar criativos escalados de N concorrentes em 3 mercados. Tempo estimado: 20 a 25 minutos.`
4. Use TaskList desde o início (uma tarefa por mercado + uma para o HTML).
5. Para cada concorrente: navigate, get_page_text, extraia. NÃO clique em "See summary details" individualmente.
6. Se a busca por keyword retornar muitos anúncios irrelevantes, filtre pelo nome da página anunciante.
7. Concorrentes sem criativos escalados (estilo Marcelo Távora, Vilma Núñez): registre explicitamente como "alta rotação, sem escala vertical", NÃO descarte.
8. Concorrentes que pivotaram (Iman Gadzhi, Carlos Muñoz): registre como "PIVOTOU PARA FORA DO NICHO" no campo focus.

---

## OUTPUT NO CHAT (curto)

1. `✅ Concluído: investigação dos N concorrentes finalizada e site gerado.`
2. Link clicável: `[Abrir criativos-escalados.html](computer:///{caminho-absoluto})`
3. Caminho copiável em texto puro
4. Mini-resumo de 5 a 8 linhas com top 3 criativos da amostra, padrão estratégico e principais diferenças entre os 3 mercados

Não despeje o conteúdo todo no chat. O aluno lê o site se quiser detalhes.

---

## TROUBLESHOOTING

- "permission_required: www.facebook.com": retente o tool individual, geralmente passa.
- "Tool permission stream closed": o aluno precisa aprovar mais rápido o pop-up. Retente.
- Biblioteca sem indicador de escala: ainda carregando, espere 5s extras e get_page_text de novo.
- "page body text exceeds max_chars": concorrente tem volume gigante, registre como "volume excede extração automática" e siga.
- Concorrente com nome muito comum: prefixe a busca com algo do produto dele (ex: "Russell Brunson ClickFunnels", "Carlos Master Muñoz").
- País não tem ads ativos do concorrente: tente outro país do mesmo idioma (ES → MX, AR, CO, US-hispano).
- Sandbox não acessa ~/Desktop: salve em Documents/{projeto}/ e avise o aluno.
