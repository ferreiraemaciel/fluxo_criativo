# Identidade Visual: Novidade de Produto

> Referência fixa para o sexto formato do Índice (`IDENTIDADE-VISUAL-INDICE.md`): a arte que anuncia
> uma novidade de um produto nosso (Blindagem, FMN Pro e os que vierem). Primeira peça: ORG 320,
> código por e-mail antes de assinar, em 15/10/2026.
>
> Este formato é um **gerador**, não um prompt. A arte é montada em HTML e renderizada em PNG pelo
> `novidade-visual/render.py`. Não passa por gerador de imagem, então o texto sai sempre nítido e
> certo. Para fazer uma peça nova, copie um exemplo, troque o texto e rode. Não recomece do zero.

---

## Quando usar

A pergunta é: **isso é algo que o produto passou a fazer e o usuário já pode usar hoje?**

- É novidade de produto, com a tela ou o resultado dele como protagonista: **este formato**.
- É uma tese, uma frase solta: Citação Crua.
- É um caso real com cena e personagem: Caso Real.
- São itens para consultar e salvar: Card de Consulta.

Serve para dois leitores ao mesmo tempo: quem já usa **fica sabendo**, quem não usa **fica com
vontade**. Por isso a peça mostra o produto funcionando, não só diz que mudou.

---

## Duas exceções às regras dos outros formatos

Combinadas com o Felipe em 15/10/2026. Estão aqui para ninguém "corrigir" a peça depois.

1. **Não leva o `@felipeferreirafotografo`.** A marca do produto no topo (escudo do Blindagem, ícone
   do FMN Pro) e o selo NOVIDADE fazem esse papel. O @ continua obrigatório nos outros cinco
   formatos.
2. **Não precisa parecer feita à mão.** Os outros formatos pedem cara humanizada e imperfeita. Esta
   peça é polida de propósito: vidro, sombra e profundidade, como as novidades de produto que
   admiramos (referência: o perfil @46graus). Isso não é imagem de IA: é HTML renderizado.

**O que continua valendo igual:** 1080x1350, 4:5. A legenda nunca repete o texto da arte. A conferência
obrigatória depois que a arte fica pronta. Frase de terceiro sempre com atribuição.

---

## Anatomia: o quadro é fixo, só o "hero" muda

De cima para baixo, sempre nesta ordem:

| Parte | Regra |
|---|---|
| **Topo** | Marca do produto à esquerda, selo dourado NOVIDADE à direita. |
| **Hero** | O bloco com a tela ou o resultado do produto, em 3D, com o lado maior na **esquerda** (sentido de leitura). Um elemento em dourado é a novidade. |
| **Título** | Frase afirmativa, **2 linhas, até uns 36 caracteres**. Uma palavra em dourado, o resto em branco e cinza. Sem pergunta. |
| **Apoio** | Até 3 linhas. Primeiro o que é, em negrito, depois como usar. Sem sigla e sem termo técnico. |
| **Rodapé** | Fixo, centralizado, amarelo: "Já disponível para todos os usuários, confira". Se a novidade ainda não é para todos, troque a frase (ex.: "Já disponível no FMN Pro, confira"). |
| **Fundo** | Azul-marinho (Blindagem) ou marrom-escuro (FMN Pro), com textura. Padrão **camurça**. Existem **papel** e **lisa**. Nunca riscos ou quadriculado. |

---

## Os cinco heros

Escolha pelo tipo de novidade. Todos aceitam a mesma regra: **um elemento dourado, o que é novo**.

| Hero | Use quando a novidade é... | Campos principais | Limite |
|---|---|---|---|
| `corrente` | um fluxo, uma sequência de passos | `itens` com `titulo`, `sub`, `icone`, `chip`, `codigo`, `tag`, `destaque`, `etiqueta` | 2 a 4 itens |
| `tela` | um recurso numa tela ou numa configuração | `janela`, `linhas` com `controle` (`ligado`, `desligado`, `chip`, `valor`) e `destaque` | 3 a 4 linhas |
| `lista` | vários itens novos de uma vez (modelos, recursos) | `itens` com `titulo`, `sub`, `icone`, `novo`, `etiqueta` | até 6 itens |
| `numero` | uma regra ou um número (desconto, prazo, economia) | `rotulo`, `numero`, `legenda`, `passos` | 1 número e até 3 passos |
| `comparativo` | uma melhoria de algo que já existia | `antes` e `agora`, cada um com `titulo`, `sub`, `icone` | 2 cartões |

Se nenhum servir, crie um módulo novo no `render.py` (uma função `hero_...` e um item em `HEROS`) e
documente aqui. Não force a novidade num módulo que não é dela.

**Quando tudo é novo** (ex.: seis modelos novos), deixe `novo: true` para o tom dourado e **não**
ponha a `etiqueta` em todos. O selo NOVIDADE do topo já diz isso.

**Postagem que não é novidade de hoje** (um catálogo, um lembrete do que já existe): troque o selo com
`"selo": "Catálogo"` (ou outra palavra curta e verdadeira). O selo NOVIDADE só vale para o que é novo.

**Comparativo com prévia:** cada lado aceita `previa` (`capa` "marca" ou "foto", `titulo`, `sub`), que
desenha um cartão de link. Use quando a novidade é visual (ex.: a prévia do link no WhatsApp). Antes/agora
só com texto fica fraco.

O gerador cola palavra de 1 ou 2 letras (o, a, de, se) à seguinte, para não sobrar no fim da linha.

---

## Marcas por produto

| Produto | Fundo | Marca | Situação |
|---|---|---|---|
| `blindagem` | azul-marinho, brilho azul e dourado | escudo 3D | Conferida pelo Felipe |
| `fmnpro` | marrom-escuro quase preto, brilho dourado, sem azul | ícone do FMN Pro | Derivada do `og-fmnpro.png` e do app. **Validar na primeira peça** |

Produto novo: copie a logo para `novidade-visual/marcas/<produto>/logo.png` e cadastre as cores em
`MARCAS` no `render.py`. O dourado `#f9b64f` do selo e dos destaques é comum a todos.

---

## Como produzir uma peça

1. **Leia a novidade** na fonte (a novidade publicada no app, o commit, o Backlog). Os números e os
   nomes de tela da arte têm que ser os do produto, nunca inventados.
2. **Escolha o hero** pela tabela acima.
3. **Copie um exemplo** de `novidade-visual/exemplos/` e troque o texto. Marcadores do título:
   `{ouro:palavra}` e `{suave:trecho}`. No apoio, `**negrito**`.
4. **Rode:** `python3 tracker-fmn/novidade-visual/render.py <spec>.json --saida <pasta>`.
5. **Leia o relatório** que ele imprime (linhas do título, escala do hero, avisos) e **olhe a imagem**.
6. **Escreva a legenda** (regras abaixo) e **lance no Tracker** (passos abaixo).

**Versão em vídeo (opcional).** Acrescente `--video` ao comando do passo 4: o gerador anima a mesma
arte e entrega um MP4 1080x1350, 30 quadros por segundo, em cerca de 9 segundos. A ordem é: o título
entra primeiro (é o gancho), o bloco se monta em seguida (cada tipo de hero tem a sua coreografia) e o
rodapé fecha. Precisa de `node` e `ffmpeg`; na primeira vez, `cd novidade-visual/motion && npm install`.
O vídeo sai sem áudio.

**Vídeo para anúncio em Reels: sempre 1080x1920 (vertical, 9:16).** Combinado com o Felipe em 16/10/2026. Use `"formato": "reels"` no spec: o quadro fica 1080x1920 com folga em cima (200px) e embaixo (310px) para a interface do Reels. O hero `demo` (janela de navegador, 16 s em laço) tem câmera 3D que balança e se aproxima conforme a ação. Exemplo: `exemplos/demo-verificacao-reels.json`. Hero `carrossel`: fileira de páginas inteiras de contrato lado a lado, cortadas nas pontas, uma em foco e uma setinha (as imagens por modelo estão no Drive, em Modelos de Contratos.../Mockups/Blindagem).

---

## Regras de texto

- **Título e apoio em linguagem simples**, de quem explica para um colega. O que a coisa faz, não
  como ela funciona por dentro.
- **Promessa modesta.** Diga o que o produto garante e nada além. Exemplo real: o código por e-mail
  prova que quem assinou tinha acesso àquele e-mail, não prova identidade. Por isso o título foi
  "mais um elo na prova", e não "prova definitiva".
- **Nome de tela em frase corrida vai em minúscula** ("você liga nas configurações"). Maiúscula só
  quando o nome está sozinho, como o título de uma janela dentro da arte.
- Sem travessão, sem exclamação, sem pergunta no título.
- **Dados de exemplo** na tela (e-mail mascarado, hash curto, nomes fictícios), nunca de cliente
  real. Diga isso nas observações do card.

## Legenda

Segue o tom de legenda do `tom-de-voz-felipe.md` e a regra do índice.

- **Solta e fácil de ler.** Nada de "corrente de evidências", "hash" ou outro termo técnico. Se a
  legenda precisa de explicação, a explicação está errada.
- **Não repete a arte.** A arte já disse o título e o apoio. A legenda abre pela situação do leitor
  ("sabe quando o cliente assina e depois diz que não foi ele") e soma o que a arte não disse.
- 11 a 14 palavras por frase, 4 a 7 vírgulas no texto todo, todo parágrafo com maiúscula.
- Sem vírgula antes de "e", sem travessão, sem exclamação.
- Fecho que gera ação: marcar o fotógrafo que vive aquela situação, com "kkkkkk" quando couber.

---

## Conferência obrigatória antes de entregar

1. O relatório do `render.py` saiu **sem aviso**. Aviso de título que encolheu quer dizer: encurte.
2. **Olhe o hero ampliado.** Nas peças com elos, a linha tem que ser contínua e passar **por trás**
   dos cartões, nunca por cima nem com vão. Foi o defeito que mais custou na primeira peça.
3. **Respiro:** entre o hero e o título tem que sobrar um espaço visível. O gerador já deixa, mas
   confira se nada ficou colado.
4. Acentos, numeração (1, 2, 3 em ordem) e ortografia de tudo que está escrito na arte.
5. O que a arte diz que o produto faz é **verdade hoje**. Abra o produto e confira.
6. Legenda passou na varredura (`grep -n ", e \|—\|!"`) e na régua de frases.

---

## Lançar no Tracker (Orgânico)

Plataforma **Imagem**. O card nasce em Fazendo e vai para **Feito** sozinho ao receber a arte.

1. Criar o card em `conteudo_organico` (tema, plataforma Imagem, responsável, headline, legenda,
   observações com o caminho do arquivo editável e o aviso dos dados de exemplo).
2. Criar a pasta do card no Drive. Com a cozinha da nuvem parada (desde 14/10/2026) é pelo Mac:
   `cd ~/Documents/khronus/cozinha && .venv/bin/python -W ignore local.py criar-pasta --destino tracker --numero N`.
   Ele pode dar "500" e **criar a pasta mesmo assim**: confira no Drive antes de repetir, para não
   duplicar.
3. Copiar o PNG para a pasta `ORG N ...` do Drive sincronizado (`cp`).
4. Importar: `local.py importar --destino tracker --numero N` (se disser "nenhuma midia", espere o
   Drive sincronizar e repita).
5. Gravar o endereço da pasta no card (o id vem de `xattr -p 'com.google.drivefs.item-id#S' <pasta>`).

---

## Histórico de ajustes

- 2026-10-15: Criado a partir do ORG 320 (código por e-mail antes de assinar). Referência visual: o
  perfil @46graus. O Felipe aprovou a versão com textura de camurça, 3D com o lado maior à esquerda,
  rodapé amarelo centralizado e uma única tag verde "Assinado". Aprendizados: a linha dos elos
  precisa passar por trás dos cartões (com fundo opaco), porque encurtar a linha deixava um vão que
  parecia defeito; o prefixo "Agora no Blindagem" foi tirado porque o selo NOVIDADE já diz isso;
  menu em frase corrida vai em minúscula. Legenda refeita depois para ficar solta e sem repetir a
  arte.
- 2026-10-15 (mesmo dia): Transformado em gerador com cinco heros e duas marcas, testado com cinco
  novidades diferentes (corrente, número, lista, tela e antes/agora) para provar que o modelo serve
  além do primeiro caso. Entrou a regra de **sem @** e a exceção de aparência.

---

## Capa de tutorial (formato `capa`, 1920x1080)

Combinado com o Felipe em 16/10/2026. As capas dos vídeos de tutorial do app (tabela `public.tutorials`, banco do Blindagem) seguem este estilo, não o cartão antigo preto com a etiqueta TUTORIAL.

**Regras**
- Tamanho **1920x1080** (thumbnail de YouTube, horizontal). `"formato": "capa"` no spec.
- **Selo "Tutorial" no canto superior direito**, nunca ao lado da marca.
- **Texto à esquerda**, janela 3D à direita, fundo camurça, marca do produto no topo esquerdo.
- **Título curto, até 4 linhas, uma palavra ou trecho em dourado.** O nome completo do tutorial vai em negrito na frase de apoio, sem frase de fechamento ("também se faz uma vez só" foi cortada).
- **Hero mostra o visual do que o tutorial ensina**, não uma lista abstrata. Foto de capa de verdade quando o tema é foto (usar a foto da própria FeM, nunca foto de aluno). Logo de fotógrafo fictícia (monograma com abertura de lente) no lugar de foto de perfil.
- Hero `tela` para configuração com linhas e chaves. Hero `linkcliente` para a página que o cliente recebe (capa, perfil, nome do estúdio, botão).
- Dados de exemplo fictícios (Marina Costa Fotografia). Textos das linhas vêm do próprio app.

**Como fazer uma nova**
1. Ler o tutorial em `public.tutorials` (título, descrição) e abrir a tela real no app para usar os nomes certos.
2. Copiar `tracker-fmn/novidade-visual/exemplos/` ou os specs de `output/capas-tutoriais/specs/` e trocar título, apoio e as linhas do hero.
3. `python3 tracker-fmn/novidade-visual/render.py spec.json --saida pasta`, ler o relatório e olhar a imagem.
4. Mostrar ao Felipe. Depois de aprovada, ele troca a miniatura no YouTube.

**No app, a miniatura é automática.** O Blindagem monta a imagem pelo endereço `i.ytimg.com/vi/<id>/maxresdefault.jpg` (e `mqdefault` no admin). Trocou no YouTube, o app acompanha sozinho, com um pequeno atraso de cache. Não existe campo de capa no app para subir imagem.

**Texto do tutorial por escrito.** Cada tutorial tem um passo a passo em `tracker-fmn/tutoriais-blindagem/`. Antes de escrever, abrir o código da tela (nome de aba, cartão e botão) para não descrever o que mudou. **Onde o texto aparece no app:** a aba Tutoriais mostra `public.perguntas_frequentes` (campo `resposta`, até 4.000 caracteres, texto simples com quebras de linha). O passo a passo vai NO FIM da `resposta` da pergunta que o vídeo responde (a que tem o mesmo `youtube_video_id`), não na `descricao` de `tutorials`, que só o admin vê. Atualizar as duas costuma valer a pena.
