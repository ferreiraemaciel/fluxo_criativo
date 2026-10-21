# Texto, movimento, som e animação

A parte visível do acabamento. Os valores abaixo são ponto de partida calibrado,
não dogma: cor, fonte e tipo de animação mudam conforme a marca e o tema.

---

## Movimento de câmera

```python
# escala fixa num corte
w = int(1080*s)//2*2; h = int(1920*s)//2*2
vf = f"scale={w}:{h},crop=1080:1920:(iw-1080)/2:(ih-1920)*0.38"

# zoom ao longo do corte, feito em alta e reduzido depois (evita tremor)
vf = ("scale=2160:3840,"
      f"zoompan=z='{a}+({b}-{a})*on/{n}':d=1:"
      "x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*0.38':s=1080x1920:fps=30")
```

- `0.38` em vez de `0.5` mantém a janela acima do centro, senão o topo da cabeça some
- `d=1` com `on` (número do quadro) é o que faz o zoompan andar em vídeo
- pré-escalar para 2160x3840 antes do zoompan evita o tremor de um pixel

**Faixa de escala.** Comece em 100 a 118. Se a pessoa disser que o movimento está
tímido, vá para **100 a 122, com diferenças de 8 a 16 pontos entre cortes
vizinhos**. Diferença de 2 ou 3 pontos não é percebida, só pesa o render.

Onde usar o mais fechado: nas frases afiadas, nas viradas, nos números.
Onde usar 100: nos trechos longos de argumento, para dar respiro.

---

## Legenda

### O agrupamento, que é o que mais erra

```python
def fecha_frase(w): return w.rstrip()[-1:] in '.?!'

# 1. quebra em frases
frases, atual = [], []
for a, b, w in palavras:
    atual.append((a, b, w))
    if fecha_frase(w): frases.append(atual); atual = []

# 2. dentro da frase, agrupa por tamanho
for fr in frases:
    blocos, cur = [], []
    for item in fr:
        cur.append(item)
        if len(cur) >= 3 or len(' '.join(x[2] for x in cur)) >= 22:
            blocos.append(cur); cur = []
    if cur:
        # palavra órfã volta pro bloco anterior
        if len(cur) == 1 and blocos and len(blocos[-1]) < 4: blocos[-1].extend(cur)
        else: blocos.append(cur)
```

Sem o passo 1, aparece bloco começando com a sobra da frase anterior
("NO WHATSAPP. E") e o texto para de ler como frase. Foi a primeira correção
pedida.

### Valores

| Item | Ponto de partida |
|---|---|
| Tamanho | 62 px numa tela de 1080 |
| Posição | centro em y 1440 de 1920 |
| Contorno | 6 a 7 px preto |
| Entrada | pop de 2 quadros, 94% → 100% |
| Duração | até o bloco seguinte começar |
| Destaque | só números e palavras do argumento |

### Dois caminhos para desenhar

**Com libass** (`ffmpeg-full`), escreva um `.ass` e queime:

```bash
$FF -i video.mp4 -vf "ass=f=legenda.ass:fontsdir=fontes" saida.mp4
```

No ASS, a cor é `&HBBGGRR`: o amarelo `#f9b64f` vira `&H004FB6F9`. O pop sai com
`{\fad(90,70)\fscx94\fscy94\t(0,110,\fscx100\fscy100)}`.

**Com Pillow**, desenhando PNG por bloco e montando uma faixa com alfa:

```bash
ffmpeg -f concat -safe 0 -i lista_png.txt -vf "fps=30,format=rgba" -c:v qtrle texto.mov
ffmpeg -i video.mp4 -i texto.mov -filter_complex "[0:v][1:v]overlay=0:0:shortest=1" saida.mp4
```

O caminho da Pillow é mais trabalhoso e mais poderoso: dá controle total de
layout, cor por palavra e desenho vetorial. Use ASS quando for só legenda, e
Pillow quando houver gráfico junto.

---

## Headline

- 3 a 5 segundos no começo, e **sem legenda enquanto ela estiver na tela**
- **Fora do rosto.** A faixa de baixo costuma ser o lugar
- Subheadline pequena acima, filtrando o público

Escolha a que faz a pessoa **se reconhecer**, não a que resume. Ofereça três ou
quatro, cada uma com um mecanismo diferente:

| Mecanismo | Exemplo |
|---|---|
| Paralelismo | "A lente você financiou. O combinado você gravou num áudio." |
| Reconhecimento puro | "O casamento foi fechado por áudio" |
| Número específico | "8 mil na lente. 40 segundos de áudio no combinado." |
| Acusação | "Sua câmera tem seguro. Seu trabalho não tem nada." |

---

## Som

### Mixagem

```
[0:a]dynaudnorm=f=200:g=5,highpass=f=85,asplit=2[voz][chave];
[1:a]volume=0.075,afade=t=in:st=0:d=1.2,afade=t=out:st=<fim-1.5>:d=1.5[mus0];
[mus0][chave]sidechaincompress=threshold=0.045:ratio=7:attack=12:release=320[mus];
[voz][mus]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]
```

**A trilha some sozinha quando a pessoa fala.** O `sidechaincompress` usa a voz
como gatilho, o que resolve o problema clássico de a música parecer baixa no
geral e alta na batida. Volume base entre 0,07 e 0,09 com ducking, ou 0,13 sem.

### Efeito pontual

Ancore na palavra, achando o tempo dela na transcrição:

```
[2:a]volume=0.26,adelay=60370|60370[k2]
```

- Volume entre 0,14 e 0,30
- Para variar o tom do mesmo arquivo: `asetrate=48000*0.55,aresample=48000` (grave)
- **O silêncio também é efeito.** Se o som marca presença (dinheiro entrando),
  não marque a ausência: o contraste fica mais forte mudo

---

## Animação explicativa

### A faixa

O topo da tela é onde está a cabeça. Para abrir espaço sem distorcer nada, a
imagem **desce** e a faixa que sobra recebe o gráfico:

```bash
# uma expressão só, com as janelas somadas (não se sobrepõem)
E="470*(between(t,a1,b1)*min(1,(t-a1)/0.35)*min(1,(b1-t)/0.35) + ...)"
ffmpeg -i video.mp4 -f lavfi -i color=c=0x0e0e0e:s=1080x1920:r=30 \
  -filter_complex "[1:v][0:v]overlay=0:'$E':shortest=1" base.mp4
```

Uma linha de 3 ou 4 px na cor da marca fecha a faixa embaixo e dá acabamento.

### Escolha dos momentos

De três a cinco no vídeo inteiro. Cada um precisa ser **uma ideia que a imagem
explica melhor que a fala**:

- uma lista que empilha enquanto a pessoa enumera
- uma barra que corre, representando tempo
- dois números lado a lado, representando contraste
- um carimbo que bate, representando veredito

### O caminho do HTML, que é o melhor deles

**Desde 21/10/2026 dá para desenhar a cena como página e capturar quadro a
quadro.** É o caminho mais rápido e o que chega mais perto de peça de agência,
porque você ganha de graça tudo que o navegador já sabe: fonte web, flexbox,
grade, gradiente, sombra, borda arredondada, `clip-path`, filtro, e curva de
animação de verdade.

```javascript
const { chromium } = require('playwright');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 470 } });
await p.goto('file://' + process.cwd() + '/cena.html');
await p.waitForTimeout(450);                       // deixa a fonte carregar
for (let i = 0; i < quadros; i++) {
  // congela o relógio da animação no instante desejado
  await p.evaluate(ms => document.getAnimations().forEach(a => {
    a.pause(); a.currentTime = ms;
  }), (i / 30) * 1000);
  await p.screenshot({ path: `quadros/${String(i).padStart(4,'0')}.png` });
}
```

A chave é `document.getAnimations()`: ele pega todas as animações CSS da página,
pausa e posiciona no instante exato. Assim o quadro 37 é sempre o mesmo quadro
37, sem depender de quanto o computador demorou para desenhar.

**Como amarrar com a fala:** o `animation-delay` de cada elemento é o tempo dele
em relação ao início da janela. Se a janela começa aos 27,80 s do vídeo e a
pessoa diz "escolhe o menor" aos 34,15 s, o delay daquele elemento é 6,35 s.
Mudou o corte, recalcula os delays.

**Instalação** (uma vez, dentro da pasta de trabalho):

```bash
npm init -y && npm install playwright && npx playwright install chromium
```

**Para gráfico que fica por cima da imagem** (e não dentro da faixa), capture com
`{ omitBackground: true }` e um `body` transparente: sai PNG com alfa.

**O que isso abre:** interface falsa (player com onda, barra de busca, caixa de
seleção), tabela que preenche linha por linha, balão de conversa, etiqueta,
mapa, planta, barra de progresso de tópicos. Tudo o que um site faz, a cena faz.

### Recorte da pessoa sem croma

`rembg` (já instalado, modelo `isnet-general-use`) separa a pessoa do fundo num
quadro. Serve para a pessoa aparecer **na frente** do gráfico em vez de embaixo
dele. Custa caro por quadro, então use em trechos curtos.

### Movimento

```python
def expo_out(p): return 1 - pow(2, -9 * p)          # entrada que freia
def back_out(p):                                     # salto com peso
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * pow(p-1, 3) + c1 * pow(p-1, 2)
```

Vetor simples, cor da marca, nada de brilho, partícula ou sombra colorida.
**Toda animação tem som próprio**, casado com o movimento, não com a fala.

### Armadilha da Pillow

`Image.alpha_composite` ignora destino negativo em silêncio. Para colar algo que
sai do quadro, use `paste` com máscara. E para arredondar canto sem apagar a
transparência que a peça já tinha:

```python
mascara = Image.new('L', im.size, 0)
ImageDraw.Draw(mascara).rounded_rectangle([0,0,im.width-1,im.height-1], r, fill=255)
im.putalpha(ImageChops.multiply(im.split()[3], mascara))
```

---

## Capa

Quadro do próprio vídeo, **sem legenda nenhuma**, com a melhor reação (riso,
espanto, mão na testa). Nada de moldura, logo ou caixa de fundo.

- Escureça só a parte de baixo, com desfoque no degradê
- Texto dentro do recorte que o perfil mostra: **1080x1350 central** de um
  1080x1920, ou seja, de y=285 a y=1635
- Entregue duas ou três opções com o quadro e o texto variando, e mostre a
  prévia de como cada uma fica na grade

---

## Conferência antes de entregar

1. Extraia 4 ou 5 quadros em momentos diferentes e monte uma tira para olhar
2. Leia a lista inteira dos blocos de legenda procurando erro de transcrição
3. Confira se a duração do vídeo, da trilha e da faixa de texto batem
4. Diga à pessoa o que você deduziu (palavra corrigida, take descartado)
