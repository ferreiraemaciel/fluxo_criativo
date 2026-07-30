---
name: workshop-marketing:radar-juridico
description: Varredura de notícias jurídicas, decisões de tribunais e processos judiciais que afetam o fotógrafo profissional. Entrega relatório com casos, base legal e pauta de conteúdo sugerida. Roda sob demanda ou pela tarefa semanal agendada.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, Agent, Skill
---

# Radar Jurídico da Fotografia

Varre o Direito do período e devolve o que afeta quem fotografa por profissão, com a lei que sustenta cada caso e o gancho de conteúdo pronto.

## Anúncio inicial

Antes de começar, anuncie:

```
🔍 Próximo passo: varrer notícias jurídicas, decisões e processos do período (3 camadas). Tempo estimado: 4 a 7 minutos.
```

## Passo 1. Definir a janela

Se o usuário não disse o período, use os últimos 7 dias e informe qual janela está usando. Não pergunte, apenas informe. Se ele pediu um período específico ("último mês", "desde a Lei Felca"), use o que ele pediu.

Se o usuário passou um tema junto ("radar jurídico sobre IA"), trate como `foco` e aprofunde nele, sem abandonar a varredura ampla.

## Passo 2. Rodar a varredura

Acionar o agente `radar-juridico-fotografia` via Agent tool, passando:

- `periodo`: a janela definida no Passo 1
- `escopo`: `COMPLETO`, salvo pedido diferente do usuário
- `foco`: o tema, se houver

O agente cuida das três camadas (notícia, jurisprudência, processos via API do CNJ), aplica o filtro anti-ruído, salva o relatório e atualiza o histórico anti-repetição.

## Passo 3. Apresentar

Quando o agente devolver, mostre no chat, sem despejar o relatório inteiro:

1. Uma linha dizendo se a rodada foi forte ou fraca.
2. Os casos novos, em lista curta: título, quem ganhou, por que importa.
3. O dado de tendência dos tribunais em uma frase.
4. As pautas sugeridas, numeradas.
5. O caminho absoluto do relatório em HTML, como texto copiável, e em seguida entregue o arquivo `.html` ao usuário via SendUserFile com `display: "render"`, para ele ler formatado sem precisar abrir nada. O `.md` é arquivo de trabalho, não é o que se entrega para leitura.

## Passo 4. Perguntar o que aprofundar (etapa obrigatória)

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

## Passo 5. Aprofundar os aprovados

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
- Opção 2: voltar ao Passo 5 com os novos casos.
- Opção 3: encerrar confirmando o caminho do arquivo.

## Passo 6. Confirmação

```
✅ Concluído: radar jurídico da semana. Caminho: radar-juridico/relatorios/{AAAA-MM-DD}.html
```

## Observações

- O relatório fica em pasta ignorada pelo git. Nada do radar sobe para o espelho da mentoria.
- A chave da API do CNJ vive em `DATAJUD_API_KEY` no `.env` da raiz. É uma chave pública do CNJ e pode ser rotacionada por eles a qualquer momento. Se a API responder 401, o caminho é conferir a chave atual em `datajud-wiki.cnj.jus.br/api-publica/acesso/` e atualizar o `.env`.
- Quando rodando pela tarefa agendada, pule o Passo 3 (não há ninguém no chat para responder) e apenas salve o relatório.
