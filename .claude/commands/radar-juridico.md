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
5. O caminho absoluto do relatório, como texto copiável.

Depois pergunte:

```
1. Transformar uma pauta em artigo do blog FMN
2. Aprofundar um caso específico
3. Só arquivar por enquanto
```

- Opção 1: acionar `/copy-artigo-blog-fmn` já com o tema, o ângulo e as fontes do caso escolhido em mãos, para o aluno não precisar recontar a história.
- Opção 2: rodar o agente de novo com `foco` no caso escolhido e escopo `NOTICIA_JURIS`, buscando a íntegra da decisão.
- Opção 3: encerrar confirmando o caminho do arquivo.

## Passo 4. Confirmação

```
✅ Concluído: radar jurídico da semana. Caminho: radar-juridico/relatorios/{AAAA-MM-DD}.md
```

## Observações

- O relatório fica em pasta ignorada pelo git. Nada do radar sobe para o espelho da mentoria.
- A chave da API do CNJ vive em `DATAJUD_API_KEY` no `.env` da raiz. É uma chave pública do CNJ e pode ser rotacionada por eles a qualquer momento. Se a API responder 401, o caminho é conferir a chave atual em `datajud-wiki.cnj.jus.br/api-publica/acesso/` e atualizar o `.env`.
- Quando rodando pela tarefa agendada, pule o Passo 3 (não há ninguém no chat para responder) e apenas salve o relatório.
