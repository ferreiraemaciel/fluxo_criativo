---
name: workshop-marketing:trafego-pixel
description: Diagnostica pixels do Meta Ads (Meta Pixel / Datasets) — status, último disparo, eventos rastreados nos últimos 7 dias e pixels sem atividade. Apenas leitura, sem configurar evento. Use quando o aluno perguntar "meu pixel está funcionando?", "quais eventos meu pixel rastreia?", "tem pixel sem atividade?", "qual foi o último disparo do pixel?". Para criar evento personalizado que vire audience, use /trafego-publicos.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill, AskUserQuestion
model: sonnet
user-invocable: false
---

# Trafego Pixel. Diagnóstico de Pixels Meta Ads

Lê e diagnostica os pixels da conta de anúncios. Apenas leitura — esta skill nunca configura evento, edita pixel ou cria custom event. Para essas operações, use `/trafego-publicos`.

A especificação completa está em `.claude/skills/trafego-pixel/SKILL.md`. Este command é o orquestrador.

---

## Passo 0. Contexto e validação

### 0.1 Produto ativo
Leia `meus-produtos/.ativo`. Se existir, leia `meus-produtos/{ativo}/perfil.md` para descobrir `tipo_funil` (define quais eventos são esperados — ex: Purchase para venda direta, Lead para captação).

### 0.2 Conexão Meta (gate duro)
Leia `META_AUTH_MODO` no `.env`.

- **Vazio ou ausente:** acione `/trafego-conexao` antes de prosseguir.
- **MCP_CONECTOR:** confirmar que pelo menos uma tool com prefixo `mcp__*__ads_*` está disponível.
- **APP:** confirmar que `FB_ACCESS_TOKEN_PERMANENTE` e `FB_AD_ACCOUNT_ID` existem no `.env`.

### 0.3 Selecao de conta de anuncio (multi-conta)
Mesma lógica do `/trafego-insights` — se `FB_AD_ACCOUNT_IDS` tem 2+ contas, perguntar qual usar.

### 0.4 Ler especificações
- `.claude/skills/trafego-pixel/SKILL.md`
- Sub-skill conforme escolha do aluno

---

## Passo 1. Menu

```
🔍 TRÁFEGO PIXEL. Diagnóstico de Pixels

[1] Status dos pixels             visão geral de saúde de todos os pixels
[2] Eventos rastreados            drill-down em um pixel específico
[3] Pixels sem atividade          destaque dos pixels silenciosos

Digite o número:
```

## Passo 2. Sub-fluxos

| Escolha | Sub-skill | Endpoint principal |
|---|---|---|
| [1] | `sub-skills/status-pixels.md` | `GET /act_<id>/adspixels` + `GET /<pixel_id>/stats` |
| [2] | `sub-skills/eventos-rastreados.md` | `GET /<pixel_id>/stats?aggregation=event` |
| [3] | `sub-skills/sem-atividade.md` | `GET /act_<id>/adspixels` filtrado |

🔍 Próximo passo: ler dados de pixels via Graph API. Tempo estimado: cerca de 30 segundos.

---

## Passo 3. Apresentar diagnóstico

Cada sub-skill define o formato de output. Padrão:
- Resumo (verde/amarelo/vermelho).
- Tabela detalhada por pixel.
- Sinais críticos consolidados.
- Handoffs sugeridos (`/pagina-pixel`, `/trafego-publicos`, `/trafego-analise [8]`).

✅ Concluído: diagnóstico de pixels.

---

## Passo 4. Próximos passos

```
Próximos passos:

- Para criar audience baseada em evento padrão do pixel: /trafego-publicos opção 1
- Para criar evento personalizado + audience: /trafego-publicos opção 2
- Se pixel não está disparando, instalar/reinstalar: /pagina-pixel
- Para ver impacto em campanhas: /trafego-analise opção [8] (Problemas Ocultos)
```

---

## Passo 5. Salvar diagnóstico (opcional)

Salvar em:
```
meus-produtos/{ativo}/trafego/pixel/{sub-fluxo}-{YYYY-MM-DD}-{hh}.md
```

Cache de 1h. Próxima chamada na mesma janela lê do arquivo.

---

## Princípios

1. **Apenas leitura.** Nunca configurar evento, editar pixel ou criar custom event.
2. **Sempre declarar a janela.**
3. **Status sempre justificado** com critério explícito (ver SKILL.md seção 3).
4. **Sinal crítico sempre ganha handoff.** Nunca deixar achado sem caminho de resolução.
