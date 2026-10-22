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

Um prompt por slide, canvas **1122 x 1402**, sangria total (sem moldura, sem
margem branca, sem borda).

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

Canvas 1122 x 1402. Toda caixa de texto tem `width: 860`, `left: 131`,
`text_align: center`.

| Papel | Fonte | Peso | Corpo | Cor | Espaçamento |
|---|---|---|---|---|---|
| Eyebrow (capa) | Inter | Bold | 26 | `#8a7c66` | 200 |
| Headline (capa) | Playfair Display | Bold | 64 | `#23201b` | 0 |
| Tag (slides 2 a 6) | Inter | Bold | 26 | `#8a7c66` | 200 |
| Corpo (slides 2 a 6) | Inter | Regular | 44 | `#2a251e` | 0 |
| Fonte da lei | Inter | Bold | 22 | `#8a7c66` | 150 |
| Arroba | Inter | Regular | 28 | `#8a7c66` | 0 |
| Título do fecho | Playfair Display | Bold | 58 | `#ffffff` | 0 |
| CTA LINK NA BIO | Inter | Bold | 38 | `#ffffff` | 200 |

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

Contagem, à esquerda:

- 5 bolinhas de 18 x 18, `corner_rounding: 9`
- `top: 1304`
- `left: 131, 165, 199, 233, 267`
- preenchida na cor da tinta do slide, vazia a 25% de opacidade

Setas, à direita:

- 3 chevrons de 16 x 34, `top: 1296`
- `left: 931, 957, 983`
- `view_box` 24 x 48, path `M2 2 L20 24 L2 46 L10 24 Z`

Linha da fonte da lei, quando houver, em `top: 1263`.

Esse rodapé é a parte que mais escorrega. No ORG 341 os slides 4, 5 e 6 saíram
26 px mais baixos e isso aparece na passagem de um slide pro outro. **Conferir
`top` de todos os elementos de rodapé dos 7 slides antes de exportar.**

---

## Passo 6. Exportar e entregar

```bash
# export-design com format {"type":"png"} em cada design, depois:
python3 - <<'PY'
from PIL import Image
for i in range(1, 8):
    Image.open(f'{i:02d}.png').convert('RGB') \
        .resize((1080, 1350), Image.LANCZOS) \
        .save(f'{i:02d}.jpg', 'JPEG', quality=92)
PY
```

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

1. Rodapé no mesmo `top` nos 7 slides.
2. Nenhuma caixa de texto inventada pela separação sobrou na arte.
3. Corpo e cor conforme a tabela, slide escuro com a paleta clara.
4. Proporção nunca esticada. Redimensionar sempre mantendo 1122:1402 para 1080:1350.
5. Texto passou pelo tom de voz (`.claude/rules/tom-de-voz-felipe.md`) e pelo
   checklist de Light Copy.

---

## Referência

ORG 341, "Recesso sem cláusula", 7 slides, 22/10/2026. Foi o carrossel em que o
método fechou.
