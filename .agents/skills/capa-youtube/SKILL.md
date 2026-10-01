---
name: capa-youtube
description: Gera os prompts para criar a capa (thumbnail) de um vídeo do YouTube, sempre horizontal em 1920x1080. Entrega três prompts separados, capa completa, fundo sozinho e elementos gráficos soltos, prontos para colar no ChatGPT ou em outro gerador de imagem. Lê o contexto do produto ativo, o assunto do vídeo e a foto do criador, e monta a headline no padrão de thumb que funciona no nicho. Use quando o usuário pedir capa de YouTube, thumbnail, thumb, capa de vídeo, arte do vídeo, ou disser que vai subir um vídeo e precisa da imagem de capa.
allowed-tools: Read, Write, Bash, Glob
---

# Capa de YouTube. Prompts para gerar a thumbnail

Gera os prompts de uma capa de vídeo do YouTube. A skill não desenha a imagem: ela entrega prompts prontos, em inglês, para o aluno colar no ChatGPT ou em outro gerador, mais a lista de arquivos que ele precisa anexar.

## Regra de tamanho, sem exceção

**Toda capa é horizontal, 1920x1080, proporção 16:9.** Nunca 1280x720, nunca vertical, nunca quadrado. Mesmo quando o gerador sugerir outro tamanho, o prompt pede 1920x1080.

---

## Passo 0. Contexto

1. Ler `meus-produtos/.ativo` e, em seguida, `meus-produtos/{ativo}/perfil.md`. Interessa o Quadro, a Furadeira e os Decorados, que alimentam a headline da capa.
2. Se houver `idconsumidor.md`, ler também. O nível de consciência do público define se a headline ensina ou se provoca.

Se não houver produto ativo, seguir mesmo assim: a capa pode ser de um vídeo institucional ou de conteúdo.

---

## Passo 1. Entrevista, uma pergunta por vez

**Pergunta 1**
```
Sobre o que é o vídeo?
(ex: "como funciona a assinatura digital de contrato", "os 3 erros que fazem o fotógrafo perder o saldo")
```

**Pergunta 2**
```
Qual o objetivo dessa capa?

1. Atrair clique de quem não conhece você (público frio)
2. Reforçar autoridade para quem já acompanha
3. Apoiar um lançamento ou uma oferta que está no ar
```

**Pergunta 3**
```
Você aparece na capa?

1. Sim, tenho foto para usar
2. Sim, mas preciso escolher a foto
3. Não, só elementos gráficos
```

Se a resposta for 2, listar as fotos disponíveis com `Glob` nas pastas de banco de imagem do aluno e montar uma grade de prévia para ele escolher.

**Pergunta 4**
```
Tem print de tela, produto ou número que precise aparecer?
(ex: print do app, painel com resultado, foto do material)
```

---

## Passo 2. Preparar os anexos

O gerador não inventa o rosto do aluno nem a interface do produto. Os dois entram como anexo.

1. **Foto do criador**: recortar o fundo antes de entregar. Usar OpenCV com GrabCut:

```python
import cv2, numpy as np
from PIL import Image

img = cv2.imread('foto.jpg')
h, w = img.shape[:2]
mask = np.zeros((h, w), np.uint8)
rect = (int(w*0.10), int(h*0.02), int(w*0.82), int(h*0.97))
bgd = np.zeros((1, 65), np.float64); fgd = np.zeros((1, 65), np.float64)
cv2.grabCut(img, mask, rect, bgd, fgd, 6, cv2.GC_INIT_WITH_RECT)
m = np.where((mask == 2) | (mask == 0), 0, 1).astype('uint8') * 255
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
m = cv2.morphologyEx(m, cv2.MORPH_OPEN, k)
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
if n > 1:
    maior = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    m = np.where(lab == maior, 255, 0).astype('uint8')
m = cv2.GaussianBlur(m, (7, 7), 0)
out = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).convert('RGBA')
out.putalpha(Image.fromarray(m))
out.save('01-criador-sem-fundo.png')
```

2. **Print de tela**: usar o arquivo original, nunca uma recriação. Salvar como PNG.

3. Salvar os dois em `~/Downloads/capa-{slug-do-video}/`, numerados na ordem em que o prompt os cita, e entregar ao aluno com `SendUserFile`.

---

## Passo 3. Montar a headline

Regras da headline de capa, que são diferentes das regras de copy de página:

- **Três a cinco palavras por linha**, no máximo quatro linhas.
- **Caixa alta**, fonte condensada e pesada.
- **A primeira palavra carrega o assunto.** Ela é a única que sobrevive em 24 pixels de altura, que é o tamanho da thumb no celular. Palavra de enchimento na primeira posição (Modelos, Como, Aprenda, Descubra) desperdiça a posição mais valiosa.
- **Uma palavra em cor de destaque**, com fundo sólido atrás. É ela que carrega a promessa.
- **Números sempre em algarismo**, nunca por extenso.
- Proibido: travessão, exclamação, emoji, pergunta.

---

## Passo 4. Elementos de apoio

Escolher no máximo **cinco**. Mais que isso vira poluição e derruba a leitura no celular.

| Elemento | Quando usa | Como descrever no prompt |
|---|---|---|
| Contorno na silhueta | Sempre que o criador aparece | `clean light rim outline around the person, 4 to 6 px` |
| Glow atrás da pessoa | Sempre que o criador aparece | `soft colored glow behind the subject` |
| Etiqueta com número | Quando há um número forte no assunto | `solid pill badge with the text "..."` |
| Print em moldura | Quando o vídeo mostra ferramenta | `realistic device mockup with thin bezels` |
| Selo de resultado | Quando há prova ou prazo | `solid circle with a white checkmark` / `small pill reading "1 MIN"` |
| Seta | Quando precisa dirigir o olho | `curved arrow pointing from the hand to the screen` |
| Logo de marca | Só com autorização do aluno | citar a marca pelo nome |

**Marca de terceiro é decisão do aluno.** Ao sugerir logo de plataforma (WhatsApp, Instagram, Meta), avisar que é marca de terceiro e oferecer a alternativa genérica, como balão de mensagem em vez do ícone do WhatsApp.

---

## Passo 5. Entregar os três prompts

Sempre os três, nessa ordem, em blocos de código separados e **em inglês**.

### Prompt 1. Capa completa

Estrutura fixa:

```
Create a YouTube thumbnail, 1920x1080, 16:9.

Use the attached images exactly as they are, do not redraw them:
- Image 1: {descrição do criador e onde posicionar}
- Image 2: {descrição do print e onde posicionar}

Background: {descrição do fundo, sempre uma peça única e contínua}.

{lista dos elementos de apoio escolhidos}

{lado} side, bold condensed uppercase sans-serif, heavy weight,
left aligned, stacked in {N} lines:
{LINHA 1}
{LINHA 2}
{LINHA DE DESTAQUE}   ← this word in {cor} on a {cor} rounded box
{LINHA MENOR}

{badges e selos, com o texto exato}

Style: high contrast YouTube thumbnail, {nicho}, clean and professional,
crisp typography, no clutter, no lens flare, no AI-looking gradients,
no fake UI. All Portuguese text must be spelled exactly as written above.
```

### Prompt 2. Só o fundo

Para quem prefere montar no Photoshop com controle total. Sempre sem texto, sem pessoas, sem objetos.

### Prompt 3. Elementos soltos

Badges, selos e ícones em fundo transparente, num canvas 2048x2048, para o aluno posicionar como quiser.

---

## Passo 6. Avisos que sempre acompanham a entrega

Entregar junto com os prompts, sem exceção:

1. **Acento em português.** O gerador erra com frequência. Se voltar sem acento, pedir a correção citando a palavra específica, que ele arruma sem refazer a imagem.
2. **Rosto alterado.** Geradores tendem a retocar quem aparece na foto. Frase de proteção para acrescentar ao fim do prompt: `Do not alter, retouch, restyle or regenerate the person's face in any way. Composite the attached cutout as-is.`
3. **Peso do arquivo.** O YouTube aceita até 2 MB. Se passar, salvar como JPEG em qualidade 90.

---

## Checklist antes de entregar

- [ ] Os três prompts pedem 1920x1080 explicitamente
- [ ] Os prompts estão em inglês, o texto da capa em português
- [ ] A primeira palavra da headline carrega o assunto
- [ ] No máximo cinco elementos de apoio
- [ ] Os arquivos de anexo foram gerados, numerados e entregues
- [ ] Nenhum travessão, exclamação, emoji ou pergunta na headline
- [ ] Os três avisos do Passo 6 estão na mensagem

---

## Referência de estilo

O padrão que funciona no nicho está em `references/padrao-thumb.md`. Ler antes de montar a headline e escolher os elementos.
