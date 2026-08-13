---
name: "source-command-radar-negocios"
description: "Varredura de mercado e negócio para quem fotografa e filma por profissão (preço, tecnologia, IA, plataformas, comportamento do consumidor, modelo de negócio, tributário, casos de mercado, marketing do nicho). Pontua cada achado pelo potencial de leitura, identificação e venda, entrega relatório em HTML e pergunta a triagem. Roda sob demanda ou pela tarefa semanal agendada."
---

# source-command-radar-negocios

Use this skill when the user asks to run the migrated source command `radar-negocios`.

## Command Template

# Radar de Negócios da Fotografia

Varre o mercado do período e devolve o que afeta a rotina de quem empreende fotografando e filmando, com o dado que sustenta cada achado e o gancho de conteúdo pronto.

O método inteiro (frentes, régua de potencial, filtro anti-ruído, formato do relatório, regras de escrita) mora em `.Codex/agents/radar-negocios-fotografia.md`. Este command só orquestra: define a janela, aciona o agente, apresenta, e conduz a triagem com o Felipe presente.

Este radar é irmão do `/radar-juridico`, não substituto. O jurídico cobre direito de imagem, autoral e contrato. Este cobre o resto do negócio.

## Anúncio inicial

Antes de começar, anuncie:

```
🔍 Próximo passo: varrer mercado e tendências de negócio do período. Tempo estimado: 4 a 7 minutos.
```

## Passo 1. Definir a janela

Se o usuário não disse o período, use os últimos 7 dias e informe qual janela está usando. Se ele pediu uma frente específica ("radar de negócios sobre IA"), trate como `escopo` e `foco`.

## Passo 2. Rodar a varredura

Acionar o agente `radar-negocios-fotografia` via Agent tool, passando `periodo`, `escopo` (`COMPLETO` salvo pedido diferente) e `foco`, se houver.

## Passo 3. Apresentar

Quando o agente devolver, mostre no chat, sem despejar o relatório inteiro:

1. Uma linha dizendo se a rodada foi forte ou fraca, e quais frentes renderam.
2. Os achados novos, em lista curta: título, nota, frente, por que importa.
3. As pautas sugeridas, numeradas.
4. O caminho absoluto do relatório em HTML, como texto copiável, e entregue o arquivo via SendUserFile com `display: "render"`.

## Passo 4. Perguntar a triagem (etapa obrigatória)

```
O que fazer com cada achado novo?

1. {título} ({nota}/18, frente {X})
2. {título} ({nota}/18, frente {X})

Para cada um: "aceito", "standby" ou "descarta". Pode responder em lote.
```

Depois da resposta:
- **Aceito ou standby:** atualizar o campo `Decisão` no `.md` da rodada, regerar o HTML.
- **Descartado:** atualizar o campo, e registrar em `radar-negocios/descartados.md`, com o motivo dito pelo Felipe.

## Passo 5. Aprofundar sob demanda

Só para achados aceitos que citem pesquisa ou estudo com documento completo. Siga o "Passo de Aprofundamento" do agente. Preencha os campos, regere o HTML, entregue de novo.

## Passo 6. Virar conteúdo

Quando o Felipe aprovar um achado para produção, lance como ideia no Tracker FMN seguindo a regra de uma ideia por plataforma (`scripts/tracker-lancar-ideia.py`, um card por formato, com título e descrição escritos para aquele formato).

## Passo 7. Confirmação

```
✅ Concluído: radar de negócios da semana. Caminho: radar-negocios/relatorios/{AAAA-MM-DD}.html
```

## Observações

- Os relatórios são versionados e sobem para o repositório privado (`origin`). Nunca para `mentoria`.
- Nunca nomear concorrente em achado, gancho ou pauta. Regra dura, sem exceção.
