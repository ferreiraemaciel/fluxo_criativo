---
name: workshop-marketing:radar-juridico
description: Varredura de notícias jurídicas e decisões de tribunais que afetam o fotógrafo profissional. Pontua cada caso pelo potencial de leitura, identificação e venda, entrega relatório em HTML e pergunta o que estudar a fundo. Roda sob demanda ou pela tarefa semanal agendada.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, WebSearch, WebFetch, Agent, Skill, mcp__claude-in-chrome__list_connected_browsers
---

# Radar Jurídico da Fotografia

Varre o Direito do período e devolve o que afeta quem fotografa por profissão, com a lei que sustenta cada caso e o gancho de conteúdo pronto.

O método inteiro (fontes, ordem de varredura, régua de potencial, filtro anti-ruído, formato do relatório, regras de escrita) mora em `.claude/agents/radar-juridico-fotografia.md`. Este command só orquestra: define a janela, aciona o agente, apresenta, e conduz a triagem e o aprofundamento com o Felipe presente.

## Anúncio inicial

Antes de começar, anuncie:

```
🔍 Próximo passo: varrer notícias jurídicas e decisões do período. Tempo estimado: 4 a 7 minutos.
```

## Passo 1. Definir a janela

Se o usuário não disse o período, use os últimos 7 dias e informe qual janela está usando. Não pergunte, apenas informe. Se ele pediu um período específico ("último mês", "desde a Lei Felca"), use o que ele pediu.

Se o usuário passou um tema junto ("radar jurídico sobre IA"), trate como `foco` e aprofunde nele, sem abandonar a varredura ampla.

## Passo 2. Rodar a varredura

Acionar o agente `radar-juridico-fotografia` via Agent tool, passando `periodo`, `escopo` (`COMPLETO` salvo pedido diferente) e `foco`, se houver.

O agente cobre todas as camadas por conta própria, incluindo o STJ e os tribunais estaduais que exigem navegador, usando o navegador embutido do app (`mcp__Claude_Browser__*`). Isso é diferente do Chrome pessoal do Felipe.

**Se o relatório do agente disser que alguma camada degradou** (navegador indisponível, base bloqueada), e o Chrome do Felipe estiver conectado nesta conversa (`mcp__claude-in-chrome__list_connected_browsers`), ofereça completar aquela camada especificamente por ali, repetindo a mesma busca. Só ofereça, não faça sem perguntar, porque é trabalho extra e o Felipe pode preferir seguir com o que já tem.

## Passo 3. Apresentar

Quando o agente devolver, mostre no chat, sem despejar o relatório inteiro:

1. Uma linha dizendo se a rodada foi forte ou fraca, e se alguma camada degradou.
2. Os casos novos, em lista curta: título, nota, quem ganhou, por que importa.
3. As pautas sugeridas, numeradas.
4. O caminho absoluto do relatório em HTML, como texto copiável, e em seguida entregue o arquivo `.html` ao usuário via SendUserFile com `display: "render"`. O `.md` é arquivo de trabalho, não é o que se entrega para leitura.

## Passo 4. Perguntar a triagem (etapa obrigatória)

Todo caso novo nasce com `Decisão: aguardando triagem`. Quem decide é o Felipe, sempre.

```
O que fazer com cada caso novo?

1. {título} ({nota}/18)
2. {título} ({nota}/18)

Para cada um: "aceito", "standby" ou "descarta". Pode responder em lote.
```

Depois da resposta:
- **Aceito ou standby:** atualizar o campo `Decisão` no `.md` da rodada, regerar o HTML.
- **Descartado:** atualizar o campo `Decisão`, e além disso registrar em `radar-juridico/descartados.md` no formato já usado lá, com o motivo dito pelo Felipe.

## Passo 5. Perguntar o que aprofundar

Só faz sentido para os casos aceitos. Pergunte:

```
Quais casos aceitos você quer que eu estude a fundo, lendo a íntegra da decisão?

1. {título} (recomendo: sim, porque {motivo})
2. {título} (recomendo: não, decisão de rotina)

Responda os números, "todos", ou "nenhum".
```

Aguarde a resposta. Sem ela, não abra nenhum PDF.

## Passo 6. Aprofundar os aprovados

O aprofundamento roda **aqui, na conversa**, não dentro do agente. O motivo é prático: é lendo junto com o Felipe que aparecem as reações que valem ouro ("isso me parece um absurdo jurídico"), e o agente não conversa. Além disso, ler dois ou três PDFs custa pouco contexto, ao contrário da varredura.

Para cada caso aprovado, siga o "Passo de Aprofundamento" descrito em `.claude/agents/radar-juridico-fotografia.md`.

Depois:

1. Preencher os quatro campos de aprofundamento no `.md` da rodada.
2. Se dois casos aprofundados se contradisserem, criar a seção Confronto entre as decisões.
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
- A varredura de volume de processos na API do CNJ foi removida em 30/07/2026. Não reintroduzir sem pedido expresso.
