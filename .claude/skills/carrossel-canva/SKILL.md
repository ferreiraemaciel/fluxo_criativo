---
name: carrossel-canva
description: Monta carrossel de Instagram do FMN pelo caminho Canva. O GPT desenha os slides (com os textos dentro), a separação de camadas do Canva transforma cada peça e cada bloco de texto em elemento editável, e aqui se corrige texto, tipografia, cor e rodapé por coordenada exata. Método aprovado pelo Felipe em 22/10/2026 no ORG 341.
allowed-tools: Read, Write, Bash
---

# Carrossel pelo Canva (método aprovado)

Esse é o caminho padrão do carrossel do FMN desde 22/10/2026. Nasceu depois de duas
tentativas que não deram certo: montar tudo em HTML (ficou engessado e com cara de
template) e pedir peça recortada pro GPT (nunca alinha entre slides).

O que funcionou: **o GPT desenha o slide inteiro, inclusive os textos, e o Canva
desmonta esse JPG em camadas.** O texto volta como caixa de texto de verdade, com
fonte casada. A partir daí é tudo ajuste por coordenada, que é onde dá pra garantir
que os 7 slides fiquem idênticos no que tem que ser idêntico.

---

## Antes de tudo

Ler, nessa ordem:

1. `tracker-fmn/IDENTIDADE-VISUAL-INDICE.md`
2. `tracker-fmn/IDENTIDADE-VISUAL-CARROSSEL.md`

A regra de narrativa, capa com revelação parcial, CTA fechada e "a identidade
acompanha o tema" vem de lá. Esta skill cuida só da execução visual.

---

## Passo 1. Prompt pro GPT

**Um prompt só para o carrossel inteiro**, canvas **1080 x 1350** (o formato padrão
do projeto), sangria total: sem moldura, sem margem branca, sem borda.

Nunca fatiar em um prompt por slide. O Felipe não vai colar oito vezes o que cabe
numa vez. O prompt traz o bloco de estilo uma única vez e depois a lista dos slides,
cada um com a cena e o texto dele.

### Três coisas que o prompt sempre pede, sem exceção

**1. Objeto de identificação em todo slide, inclusive no CTA.** Uma câmera antiga,
uma lente, um tripé, um rolo de filme, um cartão de memória, desenhado no mesmo
estilo e com o mesmo detalhe de cor do carrossel. Sem isso a peça é bonita e o
fotógrafo não se vê dentro dela, e aí ela não filtra o público. O slide de CTA é o
que mais escapa, porque a tendência é deixar só o texto grande. Ele precisa do
objeto também.

**2. Os fundos limpos, avulsos, no fim do mesmo prompt.** Depois dos slides, pedir
uma imagem por cor de fundo que o carrossel usa, vazia, só fundo com a textura,
sem nenhum elemento e sem nenhum texto. Serve para remendar fundo no Canva quando
um texto for movido ou um elemento apagado. Se o carrossel tem creme, vermelho e
amarelo, são três fundos avulsos. Isso vai no prompt desde a primeira vez, nunca
depois.

**3. Encaixe entre o slide de quebra e os vizinhos.** Quando um slide muda a cor de
fundo inteira, ele não pode parecer de outro carrossel. O prompt precisa dizer qual
elemento atravessa a quebra: o mesmo objeto do slide anterior reaparecendo na cor
nova, ou um pedaço de desenho que sai por uma borda e entra na borda oposta do
seguinte. A continuidade do carrossel mora nesse encaixe, não no desenho bonito.

No prompt entra:

- O estilo escolhido pro carrossel inteiro (sugerir 2 ou 3 estilos argumentados ao
  Felipe e esperar o ok antes de ir pro GPT). Estilo é por carrossel, não é acervo.
- O objeto desenhado à mão, na posição aproximada do terço superior.
- **Os textos do slide já escritos na arte**, na tipografia que a gente quer.
  Isso é o pulo do gato: o Canva devolve eles como camada de texto editável.
- A instrução de deixar o terço inferior limpo, com fundo contínuo, para o texto
  e o rodapé.

Nunca pedir peça recortada em PNG transparente para montar depois. Não alinha.

---

## Passo 2. Conferir a área limpa

```bash
python3 tracker-fmn/carrossel-visual/conferir-area-limpa.py <arquivo.jpg>
```

Desvio padrão até ~4 é fundo limpo. Acima de 15 tem sujeira na faixa reservada e
o slide volta pro GPT.

---

## Passo 3. Subir pro Canva e separar camadas

1. `create-upload-url` e POST dos bytes do JPG.
2. `separate-image-layers` com o asset, depois `get-separate-image-layers-job`
   até terminar.
3. `create-design-from-candidate` com o resultado. Um design por slide.

**Um design por slide, não uma prancha com 7 páginas.** A prancha foi testada e
atrapalha: qualquer ajuste de um slide arrasta o resto e a exportação vira um
arquivo só.

### O que esperar do resultado

- O objeto desenhado vira um `rect` com mídia, podendo girar e redimensionar.
- O fundo vira outro `rect` em tela cheia.
- O texto desenhado vira `text` de verdade, com `fontRef` casado.
- **A separação inventa texto onde o GPT fez rabisco de escrita fake.** Num livro
  desenhado, por exemplo, ela leu linhas que não são palavras e escreveu coisa sem
  sentido. Conferir todas as caixas de texto e apagar ou reescrever as inventadas.

---

## Passo 4. Sistema tipográfico (fixo)

Canvas 1080 x 1350. Toda caixa de texto tem `width: 828`, `left: 126`,
`text_align: center`.

| Papel | Fonte | Peso | Corpo | Cor | Espaçamento |
|---|---|---|---|---|---|
| Eyebrow (capa) | Inter | Bold | 25 | `#8a7c66` | 200 |
| Headline (capa) | Playfair Display | Bold | 62 | `#23201b` | 0 |
| Tag (slides do meio) | Inter | Bold | 25 | `#8a7c66` | 200 |
| Corpo (slides do meio) | Inter | Regular | 42 | `#2a251e` | 0 |
| Fonte da lei | Inter | Bold | 21 | `#8a7c66` | 150 |
| Arroba | Inter | Regular | 27 | `#8a7c66` | 0 |
| Título do fecho | Playfair Display | Bold | 56 | `#ffffff` | 0 |
| CTA LINK NA BIO | Inter | Bold | 37 | `#ffffff` | 200 |

Slide de fundo escuro: tag e fonte da lei em `#edc4bd`, corpo em `#f7f2e8`.

Entrelinha: 1,12 em headline e título de fecho. 1,5 no corpo. 1,2 no resto.

Substitutos quando a fonte não estiver disponível: Work Sans no lugar de Inter,
Lora no lugar de Playfair Display.

**Limitação real do MCP do Canva:** `format_text` controla corpo, peso, estilo,
cor, decoração, entrelinha, alinhamento e lista. **Não controla família de fonte.**
Para travar a família existem dois caminhos: pedir a fonte certa no prompt do GPT
(a separação casa a família sozinha) ou usar `autofill-design` sobre um Brand
Template. Nunca prometer troca de fonte por `format_text`.

---

## Passo 5. Rodapé (coordenadas fixas em todos os slides)

Contagem, à esquerda. **Uma bolinha por slide**, nunca cinco fixas:

- bolinhas de 17 x 17, `corner_rounding: 9`
- `top: 1256`
- primeira em `left: 126`, as seguintes de 33 em 33 (126, 159, 192, 225, 258, 291, 324, 357)
- preenchida na cor da tinta do slide, vazia a 25% de opacidade

Setas, à direita:

- 3 chevrons de 15 x 33, `top: 1248`
- `left: 897, 922, 947`
- `view_box` 24 x 48, path `M2 2 L20 24 L2 46 L10 24 Z`
- o último slide não leva seta

Linha da fonte da lei, quando houver, em `top: 1216`.

### Capa e último slide não levam rodapé

A primeira e a última página ficam **sem bolinhas e sem setas**. A capa precisa do
peso inteiro da headline, e no fecho a contagem não serve para nada, porque não tem
próximo slide. Marcação só nos slides do meio.

Isso vale por padrão. Se o Felipe pedir a contagem na capa ou no fecho, aí sim
entra, com as mesmas coordenadas dos outros.

Esse rodapé é a parte que mais escorrega. No ORG 341 os slides 4, 5 e 6 saíram
26 px mais baixos e isso aparece na passagem de um slide pro outro. **Conferir
`top` de todos os elementos de rodapé dos 7 slides antes de exportar.**

---

## Passo 6. Exportar e entregar

`export-design` com `format {"type":"png"}` em cada design. O PNG ja sai em
1080 x 1350, então é só converter para JPEG 92, sem redimensionar e sem esticar.

Salvar os JPGs na pasta do card dentro do Drive sincronizado:

```
~/Library/CloudStorage/GoogleDrive-ferreiraemacielfoto@gmail.com/Meu Drive/Fotografia é o Meu Negócio/Tracker/Orgânico/ORG <n> <tema>/
```

A conta de serviço não tem cota e não consegue subir arquivo. A cópia é sempre
pela pasta sincronizada. Esperar cerca de 45 segundos de sincronização e importar:

```bash
cd tracker-fmn && python3 scripts/adicionar-criativo-organico.py --numero <n> --auto
```

O card sai de "Fazer" sozinho ao receber a mídia, pela regra do kanban.

---

## Conferência obrigatória antes de entregar

1. Rodapé no mesmo `top` em todos os slides do meio, e ausente na capa e no fecho.
1b. Todo slide tem objeto de identificação do ofício, inclusive o de CTA.
1c. Os fundos avulsos vieram junto, um por cor usada.
2. Nenhuma caixa de texto inventada pela separação sobrou na arte.
3. Corpo e cor conforme a tabela, slide escuro com a paleta clara.
4. Proporção nunca esticada. O arquivo nasce e morre em 1080 x 1350.
5. Texto passou pelo tom de voz (`.claude/rules/tom-de-voz-felipe.md`) e pelo
   checklist de Light Copy.

---

## Referência

ORG 341, "Recesso sem cláusula", 7 slides, 22/10/2026. Foi o carrossel em que o
método fechou.
