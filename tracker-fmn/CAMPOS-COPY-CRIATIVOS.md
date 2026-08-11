# Campos de Copy dos Criativos - Tracker FMN
> Aprovado em 2026-07-09. Revisado em 2026-08-03 (estrutura unificada Roteiro/Estética Visual/Prompt, aplicada também ao Orgânico). Fonte de verdade pra estrutura de campos do bloco "Copy" no card de anúncio (`kanban.jsx`) e no card orgânico (`organico.jsx`), por tipo/plataforma de criativo.

## Regra geral (ADS e Orgânico)

O campo **Roteiro** sempre contém as 3 partes — Gancho, Desenvolvimento e CTA — não necessariamente rotuladas separadamente no texto, mas as 3 precisam estar presentes. Vale pra todo material gerado, tanto Anúncio quanto Orgânico.

**Imagem** (ADS e Orgânico) sempre tem **Estética Visual** (descrição de cena/composição) e **Prompt** (o prompt de geração em si) como campos separados. **Reels** não tem Prompt (não se gera vídeo por prompt de imagem), só Estética Visual (direção de filmagem).

**Informações Adicionais** é o nome único (rótulo e coluna `observacoes`) pro catch-all, tanto em `ads` quanto em `conteudo_organico`.

**Texto Principal e Descrição (ADS) sempre terminam com CTA de clique.** Todo `texto_principal` de anúncio precisa fechar chamando pra clicar em SAIBA MAIS — a linguagem pode ser adaptada pro tom de cada ADS específico (ex: "Clique em Saiba Mais", "Clica ali embaixo", "Saiba mais agora"), mas o chamado pra clicar sempre precisa estar presente. **A `descricao_ad` segue a mesma regra**, sempre com uma chamada de clique no fechamento, não só o `texto_principal`.

**Conteúdo pode ir além do artigo de origem, mas sempre com aviso (regra fixa, 2026-08-07).** Quando uma peça nasce de um artigo do blog, ela não fica presa ao que está escrito lá. Pode e deve puxar o que é conexo: o "sabendo disso, o fotógrafo pode e deve fazer o seguinte", uma frase de impacto que a matéria não traz, um desdobramento prático, uma analogia nova. O artigo é ponto de partida, não teto.

**A contrapartida é obrigatória: toda vez que uma peça sair do escopo do artigo, avisar o Felipe explicitamente**, dizendo o que foi acrescentado e de onde veio. Ele é advogado e responde pelo que publica, então precisa saber o que é citação da matéria e o que é extrapolação. Sem esse aviso, o risco é publicar como se fosse conteúdo já revisado por ele quando não é.

Isso vale principalmente pra afirmação jurídica: dado, número, artigo de lei e citação de decisão continuam presos à fonte, sem exceção. A liberdade é de argumento, exemplo, aplicação prática e forma, não de fato.

**Nunca afirmar mais do que a fonte primária sustenta (regra fixa, 2026-08-07).** Quando a peça conta um caso real, o que ela afirma como fato precisa estar na decisão, na lei ou no documento. O que veio de reportagem entra atribuído ("segundo a imprensa", "o jornalista que revelou o caso disse"), nunca como fato próprio.

Isso apareceu duas vezes no mesmo lote, e as duas passaram despercebidas até alguém desconfiar:

- As peças afirmavam que as fotos foram feitas **"da rua"**. A decisão diz apenas "a partir de um ponto externo, com equipamento de alta capacidade óptica", sem especificar o lugar. Pior: o jornalista que revelou o caso afirmou textualmente que a foto **não** foi feita da rua.
- Depois, a arte afirmou que foi **"usando um drone"**. Também não está na decisão, veio da imprensa.

O detalhe traiçoeiro é que o corpo do artigo estava certo o tempo todo ("posicionado do lado de fora do prédio"). Quem errou foi o título, o resumo e as peças, que especificaram mais do que a fonte para ganhar concretude. Concretude é boa, mas não vale inventar o que não está escrito.

Regra prática antes de publicar peça sobre caso real: separe o que é **fato da decisão** do que é **relato de imprensa** e do que é **sua interpretação**, e trate cada um no registro certo. Em processo que ainda corre, registrar também que é liminar e não sentença.

**Roteiro de Reels sempre em pegada natural de fala, nunca robótico (regra fixa, 2026-08-06).** O texto do campo Roteiro (ADS e Orgânico, plataforma Reels) precisa soar como o Felipe falando de verdade pra câmera, não como um texto escrito lido em voz alta. Frases curtas, contrações ("tava", "tá"), pausas de fala reais, jeito de contar caso ("outro dia eu tava numa aula..."), nunca a cadência simétrica e "redondinha demais" de texto gerado por IA. Depois de escrever o roteiro, reler em voz alta mentalmente: se soar como texto de vídeo institucional, reescrever mais solto. Isso não dispensa o Manual da Copy nem o checklist Light Copy (zero travessão, zero exclamação), só pede que dentro dessas regras o tom fique conversacional.

---

## ADS — Reels

| Ordem | Campo na tela | Coluna no banco | O que vai ali |
|---|---|---|---|
| 1 | Headline | `headline` | Sempre 2 frases nos primeiros segundos do vídeo: uma de segmentação (ex: "Fotógrafo e Videomaker") e outra curta que chame muito a atenção. |
| 2 | Roteiro | `roteiro` | As três partes narradas juntas: Hook, Desenvolvimento e CTA (é falado no vídeo). |
| 3 | Estética Visual | `estetica_visual` | Cenas, ângulo, cor, som: a parte estética da gravação e edição do vídeo inteiro (não só do hook). Reels não tem Prompt. |
| 4 | Texto Principal | `texto_principal` | Campo do Meta, vai no corpo do anúncio. |
| 5 | Título | `titulo_ad` | Campo do Meta. |
| 6 | Descrição | `descricao_ad` | Campo do Meta. |
| 7 | Informações Adicionais | `observacoes` | Catch-all: o que não cabe nos campos acima (ex: "variante do ADS X"). |
| 8 | Referência | `referencia` | Link ou arquivo usado como referência pra criação do anúncio. |

---

## ADS — Imagem

| Ordem | Campo na tela | Coluna no banco | O que vai ali |
|---|---|---|---|
| 1 | Headline | `headline` | A frase principal / big idea que aparece **escrita na própria imagem** - o título, o hook que chama atenção (diferente do Reels: aqui não é falado, é escrito na imagem). |
| 2 | Roteiro | `roteiro` | Descreve a imagem: quantos elementos/fotos vão ter, quais frases aparecem escritas nela. Sempre mantendo a ideia do Hook (= a Headline), o desenvolvimento (o que mais aparece escrito ou visualmente) e um CTA. |
| 3 | Estética Visual | `estetica_visual` | Descrição de cena/composição (o que a imagem mostra), separado do prompt final. |
| 4 | Prompt | `prompt` | O prompt de geração de imagem em si, pronto pra colar no ChatGPT/Midjourney. Se o prompt deixa espaço de respiro pra escrita entrar na edição posterior, só menciona que existe esse espaço: o texto que vai lá mora no Roteiro, não aqui. |
| 5 | Texto Principal | `texto_principal` | Campo do Meta. |
| 6 | Título | `titulo_ad` | Campo do Meta. |
| 7 | Descrição | `descricao_ad` | Campo do Meta. |
| 8 | Informações Adicionais | `observacoes` | Igual ao Reels. |
| 9 | Referência | `referencia` | Igual ao Reels. |

---

## ADS — Carrossel (migrado em 2026-08-03)

| Ordem | Campo na tela | Coluna no banco | O que vai ali |
|---|---|---|---|
| 1 | Headline | `headline` | Único, no topo do card (não repete por slide). |
| 2 | Slides | `slides` (JSON) | Array de slides, cada um com `roteiro` (o que vai escrito naquele slide), `estetica_visual` (descrição de cena) e `prompt` (prompt de geração), além de `image_url` quando a mídia já foi importada. |
| 3 | Texto Principal | `texto_principal` | Campo do Meta. |
| 4 | Título | `titulo_ad` | Campo do Meta. |
| 5 | Descrição | `descricao_ad` | Campo do Meta. |
| 6 | Informações Adicionais | `observacoes` | Igual aos demais. |
| 7 | Referência | `referencia` | Igual aos demais. |

Cards antigos de Carrossel (campos soltos `hook_visual`/`hook_copy`/`desenvolvimento_cta`) foram migrados automaticamente pra um único slide inicial (`roteiro` = `hook_copy`+`desenvolvimento_cta`, `estetica_visual` = `hook_visual`, `prompt` vazio) — revisar e quebrar em mais slides quando fizer sentido.

---

## Orgânico (`conteudo_organico`) — Reels, Carrossel e Imagem

Mesma lógica dos ADS, campos compartilhados entre `conteudo_organico` e `ads` (mesmo nome de coluna nas duas tabelas: `headline`, `roteiro`, `estetica_visual`, `prompt`, `observacoes`, `referencia`).

| Campo | Reels | Carrossel | Imagem |
|---|---|---|---|
| Headline | ✅ | ✅ (único, topo) | ✅ |
| Roteiro | ✅ | dentro de cada slide | ✅ |
| Estética Visual | ✅ (sem Prompt) | dentro de cada slide | ✅ (com Prompt) |
| Prompt | ❌ não existe | dentro de cada slide | ✅ |
| Slides (`roteiro`, `estetica_visual`, `prompt`, `image_url` por item) | — | ✅ só aqui | — |
| Legenda da postagem (`legenda`) | ✅ | ✅ | ✅ |
| Informações Adicionais (`observacoes`) | ✅ | ✅ | ✅ |
| Referência (`referencia`) | ✅ | ✅ | ✅ |

Sem Título nem Descrição no Orgânico — só fazem sentido nos ADS (campos do Meta Ads Manager). `tema` continua existindo à parte, é só o nome interno do card no board (nunca aparece pro público).

---

## Campos antigos (histórico, nunca apagados)

- **ADS** — `hook_visual`, `hook_copy`, `desenvolvimento_cta`: saíram da tela pra Reels/Imagem desde a migração 058/059. Pra Carrossel, foram a fonte da migração automática de 2026-08-03 (ver acima), colunas continuam existindo como backup.
- **Orgânico** — `gancho`, `desenvolvimento`, `cta`, `prompt_imagem`: saíram da tela na reestruturação de 2026-08-03. Migração automática: `roteiro` = `gancho`+`desenvolvimento`+`cta` (concatenados, só se `roteiro` estivesse vazio), `headline` = `gancho` (melhor candidato disponível), `prompt` (Imagem) = `prompt_imagem`. Nos slides de Carrossel, `titulo`+`subtitulo` viraram `roteiro` do slide, `visual` virou `estetica_visual`, `prompt` manteve. Os campos `tipo` (Capa/Contexto/...) e `tag` ("Slide N") dos slides **somem de vez**, não viram nem organização interna.

## O que NUNCA muda nessa reestruturação

`texto_principal`, `titulo_ad`, `descricao_ad` são os campos que alimentam a publicação no Meta (MetaAdModal, worker `ads-media`). Essa reestruturação só mexe em rótulo/posição/dica na tela, nunca no nome da coluna nem na lógica de publicação.

---

## Título nunca leva o formato (regra fixa, 2026-07-13)

O título de qualquer criativo — anúncio pago (`ads.titulo`) ou conteúdo orgânico (`conteudo_organico.tema`) — **nunca** deve conter a palavra do formato ("Imagem", "Carrossel", "Reels", "Vídeo", etc.), nem entre parênteses, nem como sufixo/prefixo.

**Why:** o formato já existe como tag/campo próprio (`tipo` no `ads`, `plataforma` no `conteudo_organico`) e aparece visualmente no card. Repetir no título é redundante e não serve pra nada.

**Errado:**
- "Parceria SoClick x Blindagem (Imagem)"
- "ECA Digital — Sua autorização venceu (Carrossel)"
- "Contrato genérico virou risco (Reels)"

**Certo:**
- "Parceria SoClick x Blindagem"
- "ECA Digital — Sua autorização venceu"
- "Contrato genérico virou risco"

Quando o mesmo tema vira **múltiplos criativos de formatos diferentes** (ex: a mesma parceria em Imagem, Carrossel e Reels), o título de cada card continua idêntico ao tema em si — a distinção entre eles fica só pela tag de formato visível no card, nunca escrita no título.

---

## Drive: ADS vai em "Criativos", ORG vai em "Organico" (regra fixa, 2026-07-22)

`ADS` (tráfego pago) e `ORG` (conteúdo orgânico) são dois fluxos separados no Tracker, cada um com sua própria pasta raiz no Drive. **Nunca misturar as duas.**

- **ADS (anúncio pago)**: pasta raiz `Criativos`, subpastas nomeadas `ADS {numero} {titulo}` (padrão lido por `scripts/sync_drive.py`, regex `^ADS\s+(\d+)`).
- **ORG (conteúdo orgânico)**: pasta raiz `Organico`, subpastas nomeadas `ORG {numero} {titulo}`. **Nunca criar pasta `ORG ...` dentro de `Criativos`** — são fluxos e responsáveis de sincronização diferentes.

Se o número do card não deixar claro o fluxo, checar o prefixo antes de criar ou procurar a pasta: `ADS` = tráfego pago, `ORG` = orgânico.

---

## Orgânico — importar mídia do Drive nunca apaga texto do slide (regra fixa, 2026-08-01)

`scripts/adicionar-criativo-organico.py` sobrescrevia o campo `slides` inteiro só com `{"image_url": ...}` toda vez que importava mídia nova do Drive, apagando título, subtítulo, prompt e tag que já estavam salvos em cada slide. Aconteceu pelo menos 2 vezes (ORG 015/016 e ORG 024), sempre com o mesmo sintoma: "subi a imagem e o texto do card sumiu".

**Corrigido:** o script agora lê os slides já existentes do card (`slides_existentes`) e mescla com as novas `image_url` por índice (`merge_slides`), preservando qualquer outro campo (`titulo`, `subtitulo`, `visual`, `tag`, `prompt`) que já estivesse ali. Só o campo `image_url` é substituído pelo novo valor.

Se outro fluxo de importação de mídia orgânica for criado no futuro (novo script, novo endpoint), seguir o mesmo padrão: nunca sobrescrever `slides` do zero, sempre buscar o valor atual primeiro e mesclar.

---

## Ideias — vira card, vira "Convertido" (regra fixa, 2026-07-23)

Toda ideia da aba Ideias que virar card, seja em Anúncio (`ads`) ou em Orgânico (`conteudo_organico`), tem que ter o `status` da linha em `ideias` atualizado pra `Convertido` (o próprio enum já usado pelo botão de converter em `ideias.jsx`, `STATUS_COLS = ['Ideia', 'Convertido']`). Nunca deixar uma ideia já usada com status `Ideia`, senão ela aparece disponível de novo pra virar outro card por engano.

**Fluxo normal (pelo botão "Converter" na tela):** já cobre isso sozinho, via `handleConvert` em `ideias.jsx` — cria o card (Ads ou Orgânico) e atualiza o status na mesma ação, nenhum passo extra necessário.

**Fluxo manual (Claude criando o card direto via API/SQL, sem passar pelo botão):** sempre atualizar o `status` da ideia de origem pra `Convertido` como parte da mesma operação, nunca só criar o card e esquecer a ideia. Se o Claude não souber o `id` da ideia de origem, perguntar ou localizar antes de finalizar a tarefa.

---

## Conteúdo Orgânico — Imagem: todo prompt "sem texto" precisa listar os textos (regra fixa, 2026-07-14)

A tabela `conteudo_organico` (Conteúdo Orgânico) **não tem campo `roteiro`** como o `ads` (anúncio pago) tem. Isso já causou um card (ORG 015) sair com um `prompt_imagem` que dizia "no text" mas sem nenhum registro em lugar nenhum de qual texto deveria ser escrito depois no Canva/PS. Card inútil na prática: gera a imagem, mas ninguém sabe o que datilografar em cima.

**Regra:** toda vez que um `prompt_imagem` de Imagem orgânica pedir fundo/cena **sem texto** (ou com "espaço de respiro" pra escrita posterior), o próprio campo `prompt_imagem` precisa terminar com uma seção extra, sempre no mesmo formato:

```
[... prompt de geração da imagem ...]

---

TEXTOS PARA ESCREVER NA IMAGEM (o prompt acima gera só o fundo, sem texto):

1. [posição/zona] : "[texto exato]"
2. [posição/zona] : "[texto exato]"
...
```

Cada item da lista precisa corresponder a uma zona/espaço mencionado explicitamente na parte de geração do prompt (ex: "label acima do caminho da esquerda", "headline no terço inferior"). Nunca deixar a lista genérica ("escreva o título aqui") — sempre com o texto final, pronto pra copiar e colar.

**Aplica-se também a Reels e Carrossel do Conteúdo Orgânico** sempre que o prompt gerar cena sem texto embutido — mesma lógica, mesmo formato, dentro do campo de prompt correspondente (ex: dentro de cada `prompt` de slide, no caso do carrossel).
