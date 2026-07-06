---
name: gerar-imagem
description: Gera uma imagem via ChatGPT (DALL-E 3) usando automação pelo Claude in Chrome. Recebe um prompt em inglês e um caminho de destino, abre o ChatGPT no navegador, digita o prompt, aguarda a geração, faz o download e salva no projeto. Usa a assinatura ChatGPT Plus do usuário — sem custo adicional de API.
---

# Skill. Gerar Imagem via ChatGPT (Claude in Chrome)

Automação que usa o Claude in Chrome para gerar imagens no ChatGPT (DALL-E 3) sem custo adicional, aproveitando a assinatura Plus do usuário.

## Pré-requisitos

- Extensão Claude in Chrome instalada e conectada
- Usuário com conta ChatGPT Plus ativa (ou acesso ao DALL-E 3)
- Prompt já construído em inglês (fornecido por quem chamou esta skill)
- Caminho de destino definido (ex: `meus-produtos/{ativo}/entregas/criativos/furadeira.png`)

## Fluxo obrigatório

### Passo 1 — Verificar Chrome disponível

Antes de qualquer ação, verificar se `mcp__Claude_in_Chrome__list_connected_browsers` retorna ao menos um browser conectado.

- Se retornar vazio: exibir mensagem ao usuário:
  > "Para gerar a imagem automaticamente, preciso que a extensão Claude in Chrome esteja aberta no seu Chrome. Abra o Chrome e certifique-se que a extensão está ativa, depois me diga para continuar."
  > Aguardar confirmação antes de prosseguir.

### Passo 2 — Navegar ao ChatGPT

Usar `mcp__Claude_in_Chrome__navigate` para abrir:
```
https://chatgpt.com/
```

Aguardar 3 segundos para carregamento completo.

### Passo 3 — Iniciar nova conversa

Usar `mcp__Claude_in_Chrome__get_page_text` para verificar se há um chat anterior aberto.

Se houver, usar `mcp__Claude_in_Chrome__navigate` para:
```
https://chatgpt.com/
```
e clicar no botão "New chat" via `mcp__Claude_in_Chrome__find` buscando por "New chat" ou ícone de novo chat.

### Passo 4 — Selecionar modelo com geração de imagem

Verificar se o modelo atual suporta geração de imagem. O GPT-4o com DALL-E 3 é o padrão do ChatGPT Plus. Se necessário, usar `mcp__Claude_in_Chrome__find` para localizar o seletor de modelo e confirmar que GPT-4o está selecionado.

### Passo 5 — Digitar o prompt

Usar `mcp__Claude_in_Chrome__find` para localizar o campo de input (normalmente `textarea` ou `div[contenteditable]`).

Usar `mcp__Claude_in_Chrome__form_input` para preencher o prompt completo.

Pressionar Enter ou clicar no botão de envio via `mcp__Claude_in_Chrome__find` + clique.

### Passo 6 — Aguardar geração

Usar `mcp__Claude_in_Chrome__get_page_text` em loop (a cada 5 segundos, máximo 90 segundos) até detectar que a imagem foi gerada. Sinais de conclusão:
- Aparecimento de elemento `img` com src contendo `oaidalleapiprodscus` ou `dalle`
- Desaparecimento do indicador de carregamento
- Botão de download visível

Avisar ao usuário com progresso: `⏳ Aguardando geração da imagem no ChatGPT...`

### Passo 7 — Fazer download da imagem

Usar `mcp__Claude_in_Chrome__javascript_tool` para executar:
```javascript
// Encontrar a imagem gerada e obter a URL
const imgs = document.querySelectorAll('img[src*="oaidalle"], img[src*="dalle"], img[src*="openai"]');
const lastImg = imgs[imgs.length - 1];
lastImg ? lastImg.src : null;
```

Com a URL da imagem, usar `mcp__Claude_in_Chrome__javascript_tool` para baixar via fetch e converter para base64, depois salvar no projeto via script Python temporário.

Alternativa se o botão de download estiver visível: usar `mcp__Claude_in_Chrome__find` para localizar o botão de download e clicar.

### Passo 8 — Salvar no projeto

Usar `mcp__Claude_in_Chrome__javascript_tool` para obter a URL definitiva da imagem e então executar via Bash:
```bash
curl -s "{url_da_imagem}" -o "{caminho_destino}"
```

Verificar se o arquivo foi salvo com sucesso.

### Passo 9 — Confirmar entrega

Exibir ao usuário:
```
✅ Imagem gerada e salva.
Caminho: {caminho_absoluto_do_arquivo}
```

## Tratamento de erros

| Situação | Ação |
|---|---|
| Chrome não conectado | Pedir para abrir e reconectar, aguardar confirmação |
| Timeout após 90s | Avisar que o ChatGPT está demorando, pedir para verificar a conexão |
| Imagem não encontrada na página | Capturar screenshot com `mcp__Claude_in_Chrome__find` para diagnóstico |
| Download falhou | Apresentar a URL da imagem para o usuário baixar manualmente |
| Sessão expirada no ChatGPT | Informar que o usuário precisa fazer login e reconectar |

## Notas de uso

- Esta skill é chamada por `/furadeira-visual`, `/criativo-estatico` e por qualquer pedido de imagem no chat
- O prompt deve ser fornecido já em inglês e pronto para envio
- O caminho de destino deve ser definido antes de chamar esta skill
- Nunca exibir o prompt completo no chat se for muito longo — exibir apenas os primeiros 100 caracteres + "..."
