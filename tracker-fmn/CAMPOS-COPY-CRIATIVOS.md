# Campos de Copy dos Criativos — Tracker FMN
> Aprovado em 2026-07-09. Fonte de verdade pra estrutura de campos do bloco "Copy" no card de anúncio (kanban.jsx), por tipo de criativo.

Cada card de anúncio (`ads`) tem um bloco "Copy" cujos campos mudam de acordo com `tipo` (`reels`, `imagem`, `carrossel`). As colunas do banco são compartilhadas entre os tipos — só o **rótulo** e a **dica** exibidos na tela mudam.

---

## Reels

| Ordem | Campo na tela | Coluna no banco | O que vai ali |
|---|---|---|---|
| 1 | Headline | `headline` | Sempre 2 frases nos primeiros segundos do vídeo: uma de segmentação (ex: "Fotógrafo e Videomaker") e outra curta que chame muito a atenção. |
| 2 | Roteiro | `roteiro` | As três partes narradas juntas: Hook, Desenvolvimento e CTA (é falado no vídeo). |
| 3 | Estética Visual | `estetica_visual` | Cenas, ângulo, cor, som — a parte estética da gravação e edição do vídeo inteiro (não só do hook). |
| 4 | Texto Principal | `texto_principal` | Campo do Meta — vai no corpo do anúncio. |
| 5 | Título | `titulo_ad` | Campo do Meta. |
| 6 | Descrição | `descricao_ad` | Campo do Meta. |
| 7 | Informações Adicionais | `observacoes` | Catch-all: o que não cabe nos campos acima (ex: "variante do ADS X"). |
| 8 | Referência | `referencia` | Link ou arquivo usado como referência pra criação do anúncio. |

---

## Imagem

| Ordem | Campo na tela | Coluna no banco | O que vai ali |
|---|---|---|---|
| 1 | Headline | `headline` | A frase principal / big idea que aparece **escrita na própria imagem** — o título, o hook que chama atenção. (Diferente do Reels: aqui não é falado, é escrito na imagem.) |
| 2 | Roteiro | `roteiro` | Descreve a imagem: quantos elementos/fotos vão ter, quais frases aparecem escritas nela. Sempre mantendo a ideia do Hook (= a Headline), o desenvolvimento (o que mais aparece escrito ou visualmente) e um CTA. |
| 3 | Prompt para Gerar Imagem | `estetica_visual` | Cola o prompt de geração da imagem. Se o prompt já tem escrita embutida, cola a escrita aqui também. Se o prompt deixa espaço de respiro pra escrita entrar na edição posterior, só menciona que existe esse espaço — o texto que vai lá mora no Roteiro, não aqui. |
| 4 | Texto Principal | `texto_principal` | Campo do Meta. |
| 5 | Título | `titulo_ad` | Campo do Meta. |
| 6 | Descrição | `descricao_ad` | Campo do Meta. |
| 7 | Informações Adicionais | `observacoes` | Igual ao Reels. |
| 8 | Referência | `referencia` | Igual ao Reels. |

---

## Carrossel

**Ainda não migrado** — continua com o layout antigo (Headline, Hook Visual, Hook Copy, Texto Principal, Desenvolvimento + CTA, Título (feed), Descrição, Informações Adicionais, Referência). Mudança fica pra uma próxima rodada, por pedido explícito do usuário.

---

## Campos antigos (Hook Visual / Hook Copy / Desenvolvimento + CTA)

Pra Reels e Imagem, esses três campos **saíram da tela**, mas as colunas (`hook_visual`, `hook_copy`, `desenvolvimento_cta`) **não foram apagadas do banco** — ficam como histórico/backup. Migração automática rodada uma vez (migrations 058 e 059):
- `roteiro` = `hook_copy` + `desenvolvimento_cta` (concatenados), só se `roteiro` ainda estivesse vazio.
- Reels: `estetica_visual` = `hook_visual` (copiado direto).
- Imagem: `hook_visual` **não** foi migrado pra `estetica_visual` — descrição visual antiga não é a mesma coisa que um prompt de geração de imagem pronto pra colar. Campo começa em branco pro usuário preencher de verdade.

Carrossel continua usando os três campos antigos normalmente (não mudou nada ali ainda).

## O que NUNCA muda nessa reestruturação

`texto_principal`, `titulo_ad`, `descricao_ad` são os campos que alimentam a publicação no Meta (MetaAdModal, worker `ads-media`). Essa reestruturação só mexe em rótulo/posição/dica na tela — nunca no nome da coluna nem na lógica de publicação.
