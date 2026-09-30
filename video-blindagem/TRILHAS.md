# Trilhas dos vídeos do Blindagem

Duas faixas do Epidemic Sound (artista Kadant) analisadas para cortar os criativos na batida.
Os arquivos ficam em `video-blindagem/trilhas/` e **não vão para o git** (licença da conta).
Confira no Epidemic se a licença da conta cobre o uso de cada peça (anúncio pago, orgânico, site)
antes de publicar.

Como ler o mapa: a música tem um "primeiro tempo forte" no arquivo. Um compasso são 4 batidas.
Para começar o vídeo no compasso `k`, corte o áudio em `primeiro tempo forte + (k - 1) x duração do compasso`.
Os tempos abaixo são do arquivo original, em segundos.

---

## 1. In It (Instrumental Version)

| | |
|---|---|
| Arquivo | `trilhas/in-it-kadant-98bpm.mp3` |
| Duração | 3:09,5 |
| Andamento | 98 BPM (confirmado na etiqueta e na medição) |
| Compasso | 2,449 s |
| Primeiro tempo forte | **0,56 s** (confiança alta) |
| Tom provável | Dó menor |
| Clima (Epidemic) | inquieta, épica, energia média |
| ISRC | SE5Q51805737 |

**Seções (compasso: tempo no arquivo)**
- 1 a 5 (0,6 s): introdução calma.
- 6 (12,8 s): a energia sobe um degrau.
- **10 (22,6 s): primeiro drop**, até o compasso 17.
- 18 e 19 (42,2 s): respiro.
- **20 (47,1 s): segundo drop**, até o compasso 27.
- 28 (66,7 s): respiro.
- 32 (76,5 s): sobe outra vez, até o 47.
- 48 (115,7 s): respiro.
- 50 (120,6 s): sobe, até o 57.
- 58 (140,2 s): respiro.
- 66 (159,7 s): sobe, até o 73.
- 74 (179,3 s): final.

**Cortes já testados**
- Vídeo de 66 s (`blindagem-contratos*.mp4`): começa no compasso 1, com os drops nos compassos 10 e 20.
- 15 s (6 compassos): comece no compasso 6 (12,8 s), com o drop aos 9,8 s do vídeo.
- 20 s (8 compassos): comece no compasso 5 (10,4 s), com o drop aos 12,2 s do vídeo.
- 30 s (12 compassos): comece no compasso 2 (3,0 s), com o drop aos 19,6 s do vídeo.

**Tom dos efeitos sonoros:** as notas C, D e G, sem terça, combinam com Dó menor e não brigam com a faixa.

---

## 2. Don't Lock Your Love Down (Instrumental Version)

| | |
|---|---|
| Arquivo | `trilhas/dont-lock-your-love-down-kadant-96bpm.mp3` |
| Duração | 3:10,6 |
| Andamento | 96 BPM na etiqueta (medido 95,8) |
| Compasso | 2,5 s |
| Primeiro tempo forte | **0,78 s** (confiança **média**: as quatro batidas do compasso pontuaram parecido, então confirme de ouvido antes de fechar um corte) |
| Tom provável | Dó menor (confiança baixa, harmonia mais cromática) |
| Clima (Epidemic) | esperançosa, misteriosa, synth-pop, energia média |
| ISRC | SE5Q51806679 |

**Seções (tempo no arquivo)**
- 0:00 a 0:10: introdução baixa.
- **0:10,8: sobe** (energia média-alta constante até 0:43).
- **0:43,3: sobe forte**, até 1:03.
- 1:03: cai para o nível médio. Breve respiro em 1:10,8, e volta às 1:13.
- **1:35,8: sobe forte**, até 1:55.
- 1:55,8 a 2:18: **respiro longo** (energia baixa, bom para revelação ou fala).
- **2:18,3: sobe forte** e segura até cerca de 2:55.
- 2:58 em diante: final que vai baixando.

**Sugestão de uso (a validar de ouvido)**
- Clima mais suave que a In It, então serve melhor para vídeos que pedem confiança e calma: auditoria, boas-vindas do upsell, remarketing, histórias.
- Para um vídeo de 30 s que termine na virada forte: comece em 0:18,3 e a subida forte cai aos 25 s.
- Para 15 s: comece em 0:03,3 e a subida cai aos 7,5 s.

Como os drops desta faixa não caem em múltiplos de 4 compassos, marque os eventos pelos tempos em segundos da lista acima e não só pela contagem de compassos.

---

## Ferramentas (pasta `ferramentas/`)

- `mapa.py <faixa.mp3> <bpm>`: gera o mapa de uma faixa nova (andamento, primeiro tempo forte, tom e energia por compasso).
- `frames.mjs` e `render.mjs`: tiram quadros de teste e renderizam o vídeo (1080p, 30 quadros por segundo) a partir de uma animação HTML com `window.__seek(t)`.
- `dumpsfx.mjs` e `sfx.py`: extraem a lista de eventos sonoros da animação e sintetizam os efeitos, misturando com a trilha (variáveis `MUSIC` e `MUSIC_SS` escolhem a faixa e o corte).
- Requisitos: Node com `puppeteer-core` (`npm i puppeteer-core`), Google Chrome, `ffmpeg` e Python 3 com `numpy`.
