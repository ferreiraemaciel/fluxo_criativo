# Ferramentas da ilha

O que precisa estar instalado, o que cada coisa resolve, e as armadilhas que
custaram tempo de verdade.

---

## ffmpeg: tem dois, e o certo é o `ffmpeg-full`

Desde que o Homebrew separou as fórmulas, o `ffmpeg` comum vem **sem libass e
sem libfreetype**, ou seja, sem `ass`, sem `subtitles` e sem `drawtext`. Quem tem
tudo é o `ffmpeg-full`.

```bash
brew install ffmpeg-full
```

Ele é keg-only, então o binário completo fica em
`/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg` e o `ffmpeg` do PATH continua sendo o
enxuto. Nos scripts da ilha, use:

```bash
FF=/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg
```

**Confira antes de montar qualquer filtro de texto**, porque o erro só aparece na
hora de renderizar:

```bash
$FF -filters | grep -wE "ass|subtitles|drawtext"
```

O full traz também `libharfbuzz` (ligadura e acento desenhados direito),
`libzimg` (escala de qualidade melhor) e `libplacebo`.

---

## whisper.cpp, para a transcrição

```bash
brew install whisper-cpp
# modelo grande e rápido, cerca de 1,5 GB
# fica em ~/.local/share/whisper-models/ggml-large-v3-turbo.bin
```

Uso:

```bash
whisper-cli -m "$MODELO" -f trecho.wav -l pt -nt            # só o texto
whisper-cli -m "$MODELO" -f trecho.wav -l pt -ml 1 -oj -of saida   # palavra a palavra em JSON
```

### Armadilha: o tempo das palavras só é confiável em trecho curto

Em arquivo longo com pausas grandes, o whisper **espalha o texto pela duração
inteira**. O JSON sai com aparência correta e o conteúdo bate, mas os tempos não
batem com a imagem. Isso quebra legenda, som pontual e tudo mais que dependa de
sincronia.

**A volta:** separar os trechos de fala pelo silêncio antes e transcrever um por
um, somando o deslocamento. Ver `decupagem.md`.

### Armadilha: o whisper limpa a fala

Ele conserta gaguejo e repetição, então a transcrição fica mais limpa que o
áudio. Para achar onde a pessoa errou e recomeçou, **o silêncio é melhor pista
que o texto**: duas ilhas de som separadas por uma pausa curta, dizendo quase a
mesma coisa, é repetição.

Quando precisar enxergar a repetição no texto, transcreva um pedaço bem curto
(3 a 5 segundos) com `-ml 1`: aí ela aparece.

---

## Python, para desenhar e para a lógica

Só a Pillow é obrigatória (já vem no ambiente). É ela que desenha legenda,
headline e animação quando o caminho do libass não serve, e é ela que monta as
tiras de conferência.

```python
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
```

Fonte: baixe o arquivo estático, não a variável. A variável (`Montserrat[wght].ttf`)
é renderizada no peso Regular pelo libass e pela Pillow.

```bash
curl -sL -o Montserrat-ExtraBold.ttf \
  https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-ExtraBold.ttf
```

O caminho `google/fonts/.../static/` **não existe mais** e devolve uma página HTML
com extensão .ttf. Confira sempre com `file arquivo.ttf`.

---

## Playwright, para desenhar cena em HTML

```bash
npm init -y && npm install playwright && npx playwright install chromium
```

É o caminho preferido para animação explicativa. Detalhes e código em
`texto-e-animacao.md`, seção "O caminho do HTML".

## rembg, para recortar a pessoa do fundo

Já instalado, com o modelo `isnet-general-use`. Permite pôr a pessoa na frente
de um fundo gráfico sem croma. Pesado por quadro, use em trecho curto.

## O que ainda não temos

| Falta | Quando doeria | Caminho |
|---|---|---|
| Imagem fotorrealista nova | render de produto, retrato, ilustração técnica | skill `gerar-imagem`, que usa o ChatGPT no navegador |
| 3D de verdade com profundidade | texto em planos inclinados, câmera orbitando | Blender em linha de comando, se virar rotina |
| Tracking de movimento | grudar gráfico na mão de quem fala | nenhum instalado |

## Armadilhas de shell que já quebraram o trabalho

**O ffmpeg come o stdin e mata o laço de leitura.** Num `while read ... done <
lista`, o ffmpeg consome o resto do arquivo e as iterações seguintes recebem
lixo (nomes cortados tipo `G_5826.MOV`). Sempre:

```bash
ffmpeg -nostdin ...
```

**`silencedetect` escreve no nível info.** Com `-v error` a saída vem vazia e
parece que não há silêncio nenhum. Use `-hide_banner -nostats` e leia o stderr.

**`timeout` não existe no mac** sem o coreutils. Para esperar algo, faça um laço
com `sleep`.

**O `loudnorm` devolve 192 kHz quando ninguém manda o contrário.** O arquivo
abre normal e nada acusa, mas ao juntar com outro de 48 kHz a parte tratada toca
quatro vezes mais lenta e mais grave. Sempre feche a cadeia com `aresample=48000`
e passe `-ar 48000` na saída.

**`curl -F "file=@caminho"` falha com acento no caminho** (erro 26, "failed to
open"). Todas as pastas deste projeto têm acento, então copie para `/tmp` com
nome simples antes de subir arquivo por formulário.

**Glob de arquivo que não existe derruba o zsh.** `rm -f *.jpg` numa pasta sem
jpg aborta o comando inteiro com `no matches found`. Use `rm -f` com nome certo
ou proteja o glob.

---

## Conector de trilha e efeito sonoro

Quando houver um banco de música conectado (Epidemic Sound), ele faz três coisas
que valem muito:

- **Busca por clima, BPM, instrumento e duração mínima**, com filtro de "sem vocal"
- **Corte inteligente na duração exata** (`EditRecording` com `forceDuration`),
  que entrega começo e fim musicais em vez de fade na marra
- **Stems separados** (bateria, baixo, melodia), para a trilha entrar por camadas

Sem conector, dá para trabalhar com arquivo local, mas aí o corte na medida sai
na mão: achar uma batida perto do fim e cruzar com um fade de 1,5 s.
