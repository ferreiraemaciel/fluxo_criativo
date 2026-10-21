# Decupagem e corte

Como transformar dois ou três arquivos brutos numa linha do tempo limpa.

---

## 1. Audite os arquivos antes

```bash
ffprobe -v error -show_entries format=duration \
  -show_entries stream=width,height,r_frame_rate -of default=nw=1 bruto.MOV
```

**Atenção com a rotação.** Celular grava 1920x1080 com a rotação nos metadados,
e o `ffprobe` mostra o tamanho do sensor, não o da imagem. O ffmpeg já gira ao
decodificar. Para saber o que você realmente tem, extraia um quadro e olhe:

```bash
ffmpeg -nostdin -v error -ss 20 -i bruto.MOV -frames:v 1 -vf scale=640:-1 olha.jpg
```

---

## 2. Separe os trechos de fala pelo silêncio

```python
import subprocess, re

def trechos_de_fala(wav, duracao, ruido='-33dB', pausa=0.6, minimo=0.45):
    """Devolve [(inicio, fim)] de cada ilha de fala do arquivo."""
    out = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-nostdin', '-i', wav,
         '-af', f'silencedetect=noise={ruido}:d={pausa}', '-f', 'null', '-'],
        capture_output=True, text=True).stderr
    sil, cur = [], None
    for l in out.splitlines():
        m = re.search(r'silence_start: ([-\d.]+)', l)
        if m: cur = float(m.group(1))
        m = re.search(r'silence_end: ([\d.]+)', l)
        if m and cur is not None:
            sil.append((cur, float(m.group(1)))); cur = None
    if cur is not None: sil.append((cur, duracao))
    # junta silêncios colados
    merged = []
    for a, b in sorted(sil):
        if merged and a <= merged[-1][1] + 0.05:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    fala, prev = [], 0.0
    for a, b in merged:
        if a - prev > minimo: fala.append((prev, a))
        prev = b
    if duracao - prev > minimo: fala.append((prev, duracao))
    return fala
```

O limiar de `-33dB` e pausa de `0.6s` funciona para fala caseira em ambiente
silencioso. Em sala com ar condicionado, suba para `-30dB`.

---

## 3. Transcreva trecho a trecho

```bash
# para cada (a, b) da lista
ffmpeg -nostdin -v error -ss $a -t $(($b-$a+0.25)) -i audio.wav -ac 1 -ar 16000 seg/$i.wav -y
whisper-cli -m "$MODELO" -f seg/$i.wav -l pt -nt
```

Imprima a lista inteira numa tabela `arquivo | índice | início | fim | texto`.
**É essa tabela que revela as repetições**, porque a mesma frase aparece três,
quatro, seis vezes seguidas com variações.

---

## 4. Escolha as tomadas

Para cada trecho do conteúdo, escolha uma, nesta ordem:

1. A que vai até o fim sem tropeço
2. A mais curta entre as completas
3. A com mais vida na voz

E **corte fora o que repete o argumento** com outras palavras. Normalmente são
duas ou três frases, e elas são a diferença entre denso e arrastado.

Guarde a seleção num arquivo, uma linha por corte, porque você vai refazer isso
várias vezes:

```
IMG_5833|2.18|7.45|GANCHO so comigo
IMG_5833|17.50|21.06|GANCHO manda e some
```

---

## 5. Renderize cada corte e concatene

```bash
while IFS='|' read -r nome a b rot; do
  ini=$(python3 -c "print(max(0,$a-0.06))")
  dur=$(python3 -c "print(round($b-$a+0.12,3))")
  ffmpeg -nostdin -v error -ss $ini -t $dur -i "$S/$nome.MOV" \
    -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p" \
    -c:v libx264 -crf 20 -preset veryfast -c:a aac -b:a 160k -ar 48000 -ac 2 \
    cut/$(printf %02d $i).mp4 -y
  printf "file 'cut/%02d.mp4'\n" $i >> lista.txt
  i=$((i+1))
done < corte.txt

ffmpeg -nostdin -v error -f concat -safe 0 -i lista.txt -c copy corte-seco.mp4 -y
```

Todos os cortes precisam sair com **o mesmo codec, tamanho e taxa de quadros**,
senão o `concat -c copy` gera arquivo quebrado em silêncio.

---

## 6. A margem

Comece seca: **0,06 s antes e 0,06 s depois**. Depois da primeira rodada de
correções, costuma virar 0,03 e 0,07.

Quando a pessoa apontar um corte específico, lembre que existe **margem
negativa**: terminar o corte antes do fim da fala detectada, o que elimina o
respiro final e a cabeça virando.

---

## 7. Hesitação no meio da frase: costure por dentro

Quando a pessoa fala uma palavra, pausa meio segundo e recomeça a frase, não
jogue a frase fora e não deixe a pausa. **Divida em dois cortes e junte**, cada
um pegando um lado da pausa:

```
IMG_5834|72.74|73.09|FECHO voce
IMG_5834|73.44|75.48|FECHO ja usa
```

O corte cai exatamente onde não havia som, então não se percebe. Foi assim que o
"Você... já usa isso aí" virou "Você já usa isso aí".

---

## 8. Mapa da linha do tempo

Sempre que a pessoa for apontar correções, ela vai falar em minuto e segundo do
vídeo montado. Tenha o mapa à mão:

```python
acc = 0
for i, rot in enumerate(rotulos):
    d = duracao(f'cut/{i:02d}.mp4')
    print(f'{int(acc//60)}:{acc%60:05.2f}  {rot}')
    acc += d
```

É esse mapa que traduz "aos 43 segundos tem um erro" para "é o início do
corte 11, que vem do bruto em 142,68".
