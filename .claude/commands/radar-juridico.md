---
name: workshop-marketing:radar-juridico
description: Varredura de notícias jurídicas e decisões de tribunais que afetam o fotógrafo profissional. Pontua cada caso pelo potencial de leitura, identificação e venda, entrega relatório em HTML e pergunta o que estudar a fundo. Roda sob demanda ou pela tarefa semanal agendada.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, Agent, Skill
---

# Radar Jurídico da Fotografia

Varre o Direito do período e devolve o que afeta quem fotografa por profissão, com a lei que sustenta cada caso e o gancho de conteúdo pronto.

## Anúncio inicial

Antes de começar, anuncie:

```
🔍 Próximo passo: varrer notícias jurídicas e decisões do período (2 camadas). Tempo estimado: 4 a 7 minutos.
```

## Passo 1. Definir a janela

Se o usuário não disse o período, use os últimos 7 dias e informe qual janela está usando. Não pergunte, apenas informe. Se ele pediu um período específico ("último mês", "desde a Lei Felca"), use o que ele pediu.

Se o usuário passou um tema junto ("radar jurídico sobre IA"), trate como `foco` e aprofunde nele, sem abandonar a varredura ampla.

## Passo 2. Rodar a varredura

Acionar o agente `radar-juridico-fotografia` via Agent tool, passando:

- `periodo`: a janela definida no Passo 1
- `escopo`: `COMPLETO`, salvo pedido diferente do usuário
- `foco`: o tema, se houver

O agente cuida das duas camadas (notícia jurídica e jurisprudência), aplica o filtro anti-ruído, pontua cada caso pela régua de potencial de conteúdo, salva o relatório ordenado por nota e atualiza o histórico anti-repetição.

## Passo 3. Completar a camada superior (STF e STJ), na conversa

O agente cobre notícia e os buscadores estaduais acessíveis por requisição simples. Ele **não** alcança STF e STJ, que respondem a robô com desafio automático de verificação. Essa parte roda aqui, pelo Chrome do Felipe.

1. Verificar se há Chrome conectado (`mcp__claude-in-chrome__list_connected_browsers`). Se houver mais de um, perguntar qual usar. Se não houver nenhum, pular este passo e registrar no relatório que a camada superior não rodou.
2. Navegar para `https://scon.stj.jus.br/SCON/`. A URL com parâmetros de busca não funciona, é preciso preencher o formulário: localizar o campo "Digite o(s) critério(s) de pesquisa" e o botão "Pesquisar" com `find`, preencher com `form_input`, clicar, e ler com `get_page_text`.
3. Buscas mínimas, adaptadas ao período: `fotógrafo e "direito autoral"`, `fotografia e "direito de imagem"`, `"obra fotográfica"`. Operadores do SCON: `e`, `ou`, `adj`, `não`, `prox`, `mesmo`, `com`, `$`.
4. Repetir no STF quando o tema encostar em intimidade, domicílio ou repercussão geral.
5. Acrescentar os achados ao `.md` da rodada, com número do processo, relator, órgão julgador e data.

**Nunca tentar contornar desafio de verificação automática.** Se o desafio aparecer e não passar sozinho, registre no relatório que a base ficou inacessível naquela rodada e siga.

## Passo 4. Apresentar

Quando o agente devolver, mostre no chat, sem despejar o relatório inteiro:

1. Uma linha dizendo se a rodada foi forte ou fraca.
2. Os casos novos, em lista curta: título, quem ganhou, por que importa.
3. As pautas sugeridas, numeradas.
4. O caminho absoluto do relatório em HTML, como texto copiável, e em seguida entregue o arquivo `.html` ao usuário via SendUserFile com `display: "render"`, para ele ler formatado sem precisar abrir nada. O `.md` é arquivo de trabalho, não é o que se entrega para leitura.

## Passo 5. Perguntar o que aprofundar (etapa obrigatória)

A varredura entrega o mapa, não o estudo. Quem decide o que merece leitura de íntegra é o Felipe, sempre. Nunca aprofundar por conta própria.

Liste os casos numerados, com a recomendação do agente ao lado, e pergunte:

```
Quais casos você quer que eu estude a fundo, lendo a íntegra da decisão?

1. {título do caso 1} (recomendo: sim, porque {motivo})
2. {título do caso 2} (recomendo: não, decisão de rotina)
3. {título do caso 3} (recomendo: sim, porque {motivo})

Responda os números, "todos", ou "nenhum".
```

Aguarde a resposta. Sem ela, não abra nenhum PDF.

## Passo 6. Aprofundar os aprovados

O aprofundamento roda **aqui, na conversa**, não dentro do agente. O motivo é prático: é lendo junto com o Felipe que aparecem as reações que valem ouro ("isso me parece um absurdo jurídico"), e o agente não conversa. Além disso, ler dois ou três PDFs custa pouco contexto, ao contrário da varredura.

Para cada caso aprovado, siga o "Passo de Aprofundamento" descrito em `.claude/agents/radar-juridico-fotografia.md`: abrir o PDF arquivado, ler inteiro, extrair tipo de decisão, quem decidiu, cabimento de recurso, trechos literais, fragilidades confrontadas com a lei e riscos de produzir conteúdo.

Depois:

1. Preencher os quatro campos de aprofundamento no `.md` da rodada.
2. Se dois casos aprofundados se contradisserem, criar a seção 6 (Confronto entre as decisões).
3. Rodar `python3 scripts/radar-juridico-html.py radar-juridico/relatorios/{AAAA-MM-DD}.md`.
4. Entregar o HTML atualizado de novo via SendUserFile.

Em seguida pergunte:

```
1. Transformar uma pauta em artigo do blog FMN
2. Aprofundar mais algum caso
3. Só arquivar por enquanto
```

- Opção 1: acionar `/copy-artigo-blog-fmn` já com o tema, o ângulo, os trechos literais e as fontes em mãos, para o Felipe não precisar recontar a história.
- Opção 2: voltar ao Passo 6 com os novos casos.
- Opção 3: encerrar confirmando o caminho do arquivo.

## Passo 7. Confirmação

```
✅ Concluído: radar jurídico da semana. Caminho: radar-juridico/relatorios/{AAAA-MM-DD}.html
```

## Observações

- Os relatórios são versionados e sobem para o repositório privado (`origin`), para chegarem nas outras máquinas. Um hook de pre-push impede que cheguem ao remote `mentoria`, o espelho compartilhado com alunos.
- A varredura de volume de processos na API do CNJ foi removida em 30/07/2026. Ela contava ações por assunto, e o assunto "Direito de Imagem" no CNJ mistura acidente de trânsito, cobrança bancária e plano de saúde, então o número não media nada sobre fotografia. Não reintroduzir sem pedido expresso.
- Os buscadores de jurisprudência do STF e do STJ respondem a robô com desafio automático de verificação. Nunca tentar contorná-lo. O caminho que funciona é o Chrome do Felipe, conforme o Passo 3. Sem Chrome conectado, o relatório precisa dizer que a camada superior não rodou.
- Quando rodando pela tarefa agendada, pule os Passos 3, 5 e 6 (não há Chrome nem ninguém no chat para responder) e apenas salve o relatório, marcando a camada superior como não executada.
