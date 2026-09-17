---
name: "source-command-criativo"
description: "Migrated source command `criativo`"
---

# source-command-criativo

Use this skill when the user asks to run the migrated source command `criativo`.

## Command Template

# Criativo. Gerador de Criativos Visuais

## O Que Fazer

### 1. Contexto

Leia `meus-produtos/.ativo`, depois `meus-produtos/{ativo}/perfil.md` e `meus-produtos/{ativo}/idconsumidor.md` se existir.

### 2. Escolha do Tipo

```
O que você quer criar?

1. Criativo AIDA (imagem para anúncio em 3 passos)
2. Usar referência visual (editar imagem que você já tem)
3. Carrossel para Instagram (cards com foto real gerada por IA)

Digite o número:
```

### 3. Execução por Tipo

**Opção 1 — Criativo AIDA:**
Leia `.Codex/commands/criativo-aida.md` e execute o fluxo completo. O contexto do produto já foi carregado.

**Opção 2 — Referência Visual:**
Leia `.Codex/commands/img-anuncio.md` e execute o fluxo completo. O contexto do produto já foi carregado.

**Opção 3 — Carrossel para Instagram:**
Acione a skill `carrossel-visual` para conduzir o fluxo completo de 9 etapas com geração de foto por card. O contexto do produto já foi carregado. Requer OPENROUTER_API_KEY ou FREEPIK_API_KEY configurada no `.env`.

---

Todos os arquivos gerados são salvos em `meus-produtos/{ativo}/entregas/criativos/`.
