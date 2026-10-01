---
name: "source-command-capa-youtube"
description: "Gera os prompts da capa (thumbnail) de um vídeo do YouTube, sempre em 1920x1080 horizontal. Entrega três prompts separados, a capa completa, o fundo sozinho e os elementos gráficos soltos, mais os arquivos que precisam ser anexados no gerador. Use quando o usuário pedir capa de YouTube, thumbnail, thumb, capa de vídeo ou arte de vídeo."
---

# source-command-capa-youtube

Use this skill when the user asks to run the migrated source command `capa-youtube`.

## Command Template

# Capa de YouTube

Monta os prompts da thumbnail de um vídeo, no padrão que funciona no nicho, e prepara os arquivos de anexo.

## Usage

```
/capa-youtube
```

## O que acontece

1. Lê o produto ativo em `meus-produtos/.ativo` e o `perfil.md` correspondente.
2. Faz quatro perguntas, uma por vez: assunto do vídeo, objetivo da capa, se o criador aparece, e se há print ou número para mostrar.
3. Recorta o fundo da foto do criador e separa o print, numerados, em `~/Downloads/capa-{slug}/`.
4. Monta a headline seguindo a régua de capa, que é diferente da régua de copy de página.
5. Entrega três prompts em inglês: capa completa, fundo sozinho, elementos soltos.
6. Entrega os avisos de acento, de rosto alterado e de peso do arquivo.

## Regra fixa

Toda capa sai em **1920x1080**, horizontal. Sem exceção.

## Execução

Acionar a skill `capa-youtube`, que carrega o fluxo completo e a referência de estilo em `.Codex/skills/capa-youtube/references/padrao-thumb.md`.
