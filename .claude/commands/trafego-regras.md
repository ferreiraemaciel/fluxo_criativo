---
name: workshop-marketing:trafego-regras
description: Cria automações no Meta Ads — regras automáticas (adrules_library) com triggers de CPA/CPL/ROAS, agendamento de resumo recorrente via /schedule + Telegram/WhatsApp, e programação liga/pausa de adsets (delivery schedule). Use quando o aluno pedir "automatizar", "regra automática", "se CPA passar de X pause", "me avisa toda segunda", "rodar campanha só em horário comercial", "programar liga/pausa".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, AskUserQuestion
model: sonnet
user-invocable: false
---

# Trafego Regras. Automação, Alertas e Agendamento

Cria automações em 3 dimensões via Marketing API + Skills internas: regras automáticas Meta, resumo recorrente Workshop, programação de delivery de adset.

Especificação completa em `.claude/skills/trafego-regras/SKILL.md`.

---

## Passo 0. Contexto e validação

### 0.1 Produto ativo
Leia `meus-produtos/.ativo` e `perfil.md` (para inferir ticket e tipo_funil — usado nas validações de trigger).

### 0.2 Conexão Meta (gate duro)
Idem `/trafego-otimizar`. Se `META_AUTH_MODO` vazio, aciona `/trafego-conexao`.

### 0.3 Selecao de conta multi-conta
Idem demais commands.

### 0.4 Ler especificações
- `.claude/skills/trafego-regras/SKILL.md`
- Sub-skill conforme escolha do aluno

---

## Passo 1. Menu

```
🤖 TRÁFEGO REGRAS. Automação Meta Ads

[1] Regra automática Meta Ads
    se CPA/CPL/ROAS bater limite, pausa/aumenta budget/notifica

[2] Resumo recorrente
    envio agendado de relatório por Telegram ou WhatsApp

[3] Programação liga/pausa adset
    schedule de delivery por hora/dia da semana

Digite o número:
```

## Passo 2. Sub-fluxo

| Escolha | Sub-skill | Endpoint principal |
|---|---|---|
| [1] | `regra-automatica.md` | `POST /act_<id>/adrules_library` |
| [2] | `resumo-recorrente.md` | `/schedule create` + `/configurar-telegram`/`zapi` |
| [3] | `liga-pausa-schedule.md` | `POST /<adset_id>` (com `adset_schedule`) |

🔍 Próximo passo: validar trigger e canal, depois criar regra PAUSED. Tempo estimado: cerca de 30 segundos.

---

## Passo 3. Coletar inputs

Cada sub-skill define inputs. Padrão geral:
- **[1] Regra automática:** trigger (métrica + operador + valor), gasto mínimo, ação (pausar/ajustar/notificar), scope (campanha/adset/ad).
- **[2] Resumo recorrente:** frequência (diária/semanal/mensal), horário, dia da semana, canal (Telegram/WhatsApp), formato.
- **[3] Liga/pausa:** adset_id, dias da semana, hora_inicio, hora_fim.

---

## Passo 4. Validações

A skill bloqueia ou alerta:
- Trigger sem gasto mínimo (loop de pause em decisão prematura).
- Janela do trigger com gasto < 1× CPA target (dado imaturo).
- Receita sem `lifetime_budget` no adset (sub-fluxo [3] exige).
- Canal não configurado no `.env` (sub-fluxo [2] aciona `/configurar-telegram` ou `/configurar-zapi`).

---

## Passo 5. Preview YAML

Mostrar configuração final completa. Confirmar com SIM.

---

## Passo 6. Criação

- Toda regra/schedule criado nasce **PAUSED**.
- Devolve ID + comando para ativar.
- Salva registro em `meus-produtos/{ativo}/trafego/regras/{id}.md`.
- Atualiza `INDEX.md`.

✅ Concluído: regra criada (PAUSED). Ativação manual via comando devolvido.

---

## Passo 7. Próximos passos

```
Próximos passos:

- Para ativar a regra recém-criada:
  POST /<id> { "status": "ENABLED" }    (ou rode /trafego-regras → opção "ativar")
- Para ver histórico de execução:
  GET /<id>/history
- Para listar todas as regras criadas pelo Workshop:
  /trafego-regras → opção "listar"
- Para revisar campanhas afetadas pela regra:
  /trafego-otimizar
```

---

## Princípios

1. **Toda regra nasce PAUSED.** Aluno ativa explicitamente.
2. **Preview obrigatório.**
3. **Confirmação SIM** antes de criar.
4. **Cooldown mínimo** de 24h por regra para evitar oscilação.
5. **Rollback documentado** (DELETE comando).
6. **Não cria regra com dado imaturo.**
7. **Canal obrigatório configurado** para resumo recorrente.
8. **Schedule de adset exige lifetime_budget.** Avisa antes.
