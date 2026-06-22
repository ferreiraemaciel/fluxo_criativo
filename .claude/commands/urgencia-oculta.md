---
name: workshop-marketing:urgencia-oculta
description: Gerar Urgencias Ocultas de forma rapida e standalone, calibradas por nivel do publico (iniciante, intermediario, avancado) ao longo do espectro frio para quente. Usa o produto ativo se existir, senao trabalha so com nicho e descricao do produto digitados. Atalho rapido fora do /produto-concepcao.
allowed-tools: Read, Write, Edit, Bash
model: sonnet
---

# Gerar Urgências Ocultas (rápido, calibrado por nível)

Gera as Urgências Ocultas de um produto sem precisar passar pela concepção inteira. O aluno informa o nicho e descreve o produto (ou usa o produto ativo, se já tiver um), escolhe o nível do público que quer atingir, e recebe a lista completa calibrada para esse nível.

O diferencial deste comando é o **eixo de nível do público**. A mesma transformação gera urgências diferentes para quem está começando, para quem já está no meio do caminho e para quem é avançado. "Posicionamento na prancha" é urgência de iniciante no surf. "Como sair da baforada do tubo" é urgência de avançado. Os dois eixos trabalham juntos:

- **Temperatura** (frio para quente). Já vive nas categorias Urgências Quentes e Urgências Frias. Quente é alta intenção de compra agora. Frio é alto volume de busca, baixa intenção.
- **Nível do público** (iniciante, intermediário, avançado). Calibra o vocabulário, a profundidade e as dores específicas de cada estágio de conhecimento.

Coexiste com `/produto-concepcao`, que gera as Urgências Ocultas dentro do fluxo completo de concepção. Use este comando quando quiser uma lista rápida, testar um novo recorte de público ou gerar variações por nível para criativos diferentes.

## Usage

```
/urgencia-oculta
```

## O Que Fazer

### 1. Carregar contexto (híbrido: produto ativo ou input direto)

Leia `meus-produtos/.ativo`.

**Se existir um produto ativo com `perfil.md`:**

Leia `meus-produtos/{ativo}/perfil.md` e extraia Quadro, nicho e a descrição do produto. Confirme com o aluno em uma pergunta:

```
Detectei o produto ativo: {nome do produto}
Quadro: {quadro}
Nicho: {nicho}

Quer gerar as Urgências Ocultas para este produto?

1. Sim, usar o produto ativo
2. Não, vou digitar outro nicho e produto agora
```

Se 1, siga com os dados do perfil. Se 2, vá para o fluxo de input direto abaixo.

**Se NÃO existir produto ativo (ou o aluno escolheu 2):**

Faça duas perguntas, uma por vez:

Pergunta A:
```
Qual é o nicho?
(ex: "surf para iniciantes", "investimentos", "confeitaria caseira")
```

Pergunta B:
```
Descreva seu produto em uma ou duas frases. O que ele entrega e para quem?
(ex: "Curso que ensina leigos a dar os primeiros passos no marketing digital e fazer a primeira renda extra")
```

Não exija perfil completo, pesquisa de mercado nem idconsumidor. O comando funciona só com nicho + descrição. Se o produto ativo existir, aproveite o que houver de pesquisa-mercado.md para enriquecer, mas nunca trave por falta dela.

### 2. Escolher o nível do público

Pergunte:

```
Para qual nível de conhecimento do público você quer gerar as Urgências Ocultas?

1. Iniciante (o leigo, quem está começando do zero)
2. Intermediário (já começou, está travado num platô, quer evoluir)
3. Avançado (domina o tema, busca detalhe fino e performance de ponta)
4. Gerar os três níveis para comparar

Digite o número:
```

Guarde a escolha. A opção 4 gera as três listas em sequência (anuncie tempo proporcional).

### 3. Anunciar próximo passo

Para um nível:
```
🔍 Próximo passo: gerar as 70 Urgências Ocultas calibradas para o público {nível}. Tempo estimado: cerca de 90 segundos.
```

Para os três níveis (opção 4):
```
🔍 Próximo passo: gerar as Urgências Ocultas para os três níveis de público. Tempo estimado: 3 a 5 minutos.
```

### 4. Gerar a lista (direto, sem agente)

Esta skill é autossuficiente. NÃO acione o agente `gerador-urgencias-ocultas` (ele é exclusivo do `/produto-concepcao` e não deve ser tocado por aqui). Gere você mesmo, usando a base de conhecimento da skill em `.claude/skills/urgencia-oculta/SKILL.md`, que contém:

- A definição das 7 categorias (Dores, Dúvidas, Desejos, Assuntos Relacionados, Urgências Quentes, Urgências Frias, Urgências Inusitadas)
- As regras de qualidade (10 itens exatos por categoria, específico para o nicho, sem travessão, sem exclamação, dúvidas na voz do público)
- As definições de calibração por nível (iniciante, intermediário, avançado)
- A estrutura de saída obrigatória

Para gerar, cruze:

- Quadro / transformação principal (do perfil.md ou inferido da descrição)
- Nicho e descrição do produto
- Conteúdo de `pesquisa-mercado.md` **se existir** (caso contrário, gere a partir do conhecimento do nicho)
- **Nível do público alvo** escolhido no passo 2: calibre TODAS as 7 categorias para esse nível

Produza o bloco markdown das 7 categorias com 10 itens cada (70 itens), calibrado para o nível.

Para a opção 4 (três níveis), gere três blocos, um por nível.

### 5. Mostrar o resultado e pedir aprovação

Mostre a lista completa na tela com o cabeçalho do nível:

```
✅ Urgências Ocultas para "{produto}" — nível {nível}:

{bloco das 7 categorias}

1. Aprovar e salvar
2. Quero ajustar algo (trocar categoria, regerar, mudar nível)
```

Para a opção 4, mostre as três listas separadas por um cabeçalho de nível cada uma, depois peça a aprovação única no final.

### 6. Tratar resposta

**Se 1 (aprovar):** seguir para passo 7.

**Se 2 (ajustar):** perguntar o que ajustar (categoria específica, regerar a lista inteira, trocar o nível) e regerar só o que foi pedido. Voltar ao passo 5.

### 7. Salvar

**Se há produto ativo:**

Salve a lista como entregável em `meus-produtos/{ativo}/entregas/urgencias-ocultas/{nivel}.md` (crie a pasta se não existir). Para a opção 4, salve um arquivo por nível.

Depois ofereça sincronizar com o perfil:

```
Quer também substituir a seção Urgências Ocultas do perfil.md por esta versão?

1. Sim, atualizar o perfil.md (vira a fonte oficial do produto)
2. Não, manter só como entregável
```

Se 1, substitua a seção `## Urgências Ocultas` do `meus-produtos/{ativo}/perfil.md` pelo bloco gerado e rode o painel:

```
py -3 scripts/painel-incremental.py --slug {ativo}
```

Se o script falhar, avise para rodar manualmente depois.

**Se NÃO há produto ativo:**

Pergunte:

```
Quer salvar esta lista num arquivo para usar depois?

1. Sim, salvar
2. Não, só vou copiar da tela
```

Se 1, gere um slug a partir do nicho e salve em `meus-produtos/_avulsos/urgencias-ocultas/{slug-nicho}-{nivel}.md` (crie as pastas se não existirem). Se 2, encerre só com a lista na tela.

### 8. Mensagem final

```
✅ Concluído: Urgências Ocultas geradas para o nível {nível}.
Caminho: {caminho absoluto do arquivo salvo, se houver}

Próximo:
- /copy-anuncio para transformar uma urgência em anúncio
- /criativo-estatico para virar criativo de imagem
- /copy-social para virar gancho de conteúdo
- /urgencia-oculta de novo para gerar outro nível e testar recortes diferentes
```

Sempre exiba o caminho absoluto como texto copiável quando salvar arquivo.

## Regras

- Não fazer entrevista longa. No máximo nicho, produto e nível. O resto o agente resolve.
- Não exigir pesquisa-mercado.md nem idconsumidor.md. Usa se tiver, gera sem se não tiver.
- Não chamar a skill `revisora`. Urgências Ocultas são matéria-prima (temas, dores, dúvidas), não copy de venda finalizada. Mesmo assim, proibido travessão (—) e ponto de exclamação (!).
- 7 categorias com exatamente 10 itens cada. Total 70 por nível.
- Calibração por nível é obrigatória quando o aluno escolhe um nível. Iniciante fala a língua do leigo, avançado fala técnico.
- Anunciar "próximo passo" antes da geração (regra global do CLAUDE.md).
- Português brasileiro com acentuação correta. Aplicar as palavras críticas listadas no CLAUDE.md.
- Erros sempre em português claro, sem detalhe técnico.
