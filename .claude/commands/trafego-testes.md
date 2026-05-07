---
name: workshop-marketing:trafego-testes
description: Cria testes A/B disciplinados e variações estruturadas no Meta Ads — A/B de criativo, headline, audiência, faixa etária, posicionamento, lance, estrutura, duplicar campanha alterando UMA dimensão, e fluxo composto de campanha de remarketing (público + campanha). Toda criação documenta hipótese e devolve handoff para /trafego-analise [3] após D+7. Use quando o aluno pedir "testar A vs B", "duplicar minha melhor campanha mudando idade", "criar campanha de remarketing", "Reels vs Feed", "broad vs segmentado".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, AskUserQuestion
model: sonnet
user-invocable: false
---

# Trafego Testes. A/B e Variações Estruturadas Meta Ads

Cria testes A/B com hipótese documentada, mesmo budget nos lados, modelo limpo (UMA dimensão variando), e devolve handoff para leitura após período mínimo.

Especificação completa em `.claude/skills/trafego-testes/SKILL.md`.

---

## Passo 0. Contexto e validação

### 0.1 Produto ativo
Leia `meus-produtos/.ativo`. Leia `perfil.md` (para ticket — define mínimo de conversões, 50 low/mid, 30 high) e `idconsumidor.md` (para sugestões VTSD nos sub-fluxos de audiência).

### 0.2 Conexão Meta (gate duro)
Idem demais commands `/trafego-*`.

### 0.3 Selecao de conta multi-conta
Idem demais commands.

### 0.4 Ler especificações
- `.claude/skills/trafego-testes/SKILL.md`
- Sub-skill conforme escolha do aluno

---

## Passo 1. Menu

```
🧪 TRÁFEGO TESTES. A/B e Variações Meta Ads

[1] A/B de criativo                     imagem A vs B, ou imagem vs vídeo
[2] A/B de headline                     até 3 variações de copy
[3] A/B de audiência                    broad vs segmentado, ou audience X vs Y
[4] A/B de faixa etária                 ex: 25-34 vs 35-44
[5] A/B de posicionamento               Reels vs Feed vs Stories
[6] A/B de lance                        auto vs cost cap
[7] A/B de estrutura                    Advantage+ vs ABO manual
[8] Duplicar com variação               pega entidade existente, duplica mudando 1 coisa
[9] Campanha de remarketing             fluxo composto: audience + campanha

Digite o número:
```

### Redirecionamentos

Se aluno pedir algo fora do escopo, redirecionar:
- "Pausar todos com CPA > X" → **`/trafego-otimizar`** (acoes-lote, não é teste)
- "Aumentar 20% nas top 3" → **`/trafego-escalar`** (escala, não é teste)
- "Criar campanha do zero" → **`/trafego-criar-campanha`**

---

## Passo 2. Sub-fluxo

| Escolha | Sub-skill |
|---|---|
| [1] | `ab-criativo.md` |
| [2] | `ab-headline.md` |
| [3]/[4] | `ab-audiencia.md` (cobre faixa etária) |
| [5] | `ab-posicionamento.md` |
| [6] | `ab-lance.md` |
| [7] | `ab-estrutura.md` |
| [8] | `duplicar-variando.md` |
| [9] | `campanha-remarketing.md` (orquestra publicos + criar-campanha) |

---

## Passo 3. Coletar hipótese

Antes de qualquer input técnico, perguntar:
```
Qual a sua hipótese para esse teste?

(ex: "Vídeo converte mais que imagem em audiência fria de tarot porque mostra a leitura
acontecendo, ativando a Mandala Tipo 12 - Imagem")

A hipótese é salva e usada na leitura D+7.
```

Se o aluno não tem hipótese clara, sugerir 2-3 hipóteses possíveis com base no contexto VTSD.

---

## Passo 4. Coletar inputs específicos

Cada sub-skill define os inputs. Comum a todos:
- `entity_id` (campanha ou adset onde testar)
- `budget_diario` (mesmo nos lados)
- Variações (A vs B, ou A/B/C para headline)

🔍 Próximo passo: criar entidades PAUSED com a variação. Tempo estimado: cerca de 30 segundos.

---

## Passo 5. Preview YAML

Mostrar configuração completa: nome final (`[WS-AB] {dim}-{slug}`), modelo (ads_mesmo_adset ou adsets_separados), variações, constantes, budget, janela mínima, data de leitura prevista.

```
confirma criar como PAUSED? (digite SIM)
```

---

## Passo 6. Criação

- Cria entidades PAUSED via Marketing API.
- Salva hipótese + plano em `meus-produtos/{ativo}/trafego/testes/{slug}.md`.
- Devolve IDs + comandos de reversão.
- Sinaliza data de leitura (D+7).

✅ Concluído: teste A/B criado. Aguardando ativação manual e período mínimo.

---

## Passo 7. Próximos passos

```
Próximos passos:

1. Ativar as entidades no Gerenciador (PAUSED → ACTIVE).
2. Aguardar 7 dias com 50+ conversões em cada lado (30+ para high ticket).
3. Em {data D+7}, rodar /trafego-analise opção [3] Criativos para ler resultado.

Para deletar o teste antes do prazo (rollback):
   DELETE /<id_A>
   DELETE /<id_B>
```

---

## Princípios

1. **UMA dimensão por teste.** Sem exceção.
2. **Mesmo budget** nos lados.
3. **Mínimo 50 conversões/lado** (30 high ticket).
4. **Mínimo 7 dias** de janela.
5. **Hipótese documentada** antes de subir.
6. **Toda criação nasce PAUSED.**
7. **Convenção `[WS-AB]`** no nome.
8. **Handoff para /trafego-analise [3]** após D+7.
9. **Não pausa perdedora automaticamente.** Aluno decide na leitura.
10. **Não escala vencedora automaticamente.** Encaminha para `/trafego-escalar`.
