# Prompt no Flow quando a imagem já existe

## A regra que muda tudo

O prompt **não descreve a cena**. A cena já está decidida na imagem. Se você redescreve
cenário, roupa e luz, o modelo entende que precisa desenhar aquilo de novo, e desenha: o
rosto muda, a parede muda, a camisa muda de tom. Você perde a consistência que custou
vinte imagens.

O prompt diz **o que se move**, e nada além disso.

## A estrutura

```
1. O que o sujeito faz, uma ação só, pequena
2. O que a câmera faz, ou que ela não faz
3. O som do ambiente
4. As travas
```

## O modelo

```
[ação pequena do sujeito].
[movimento de câmera, ou "Camera is static."]
Ambient sound only: [dois ou três sons].
No music. No dialogue, no speech, no lip sync. No text or subtitles on screen.
Single continuous shot, no cuts. Keep the face, wardrobe, lighting and set exactly
as in the image.
```

## As travas, uma por uma

- **No music.** O Veo inventa uma trilha por take. Vinte trilhas diferentes não casam no
  corte. A música entra uma vez só na montagem.
- **No dialogue, no speech, no lip sync.** Ele tem áudio nativo e inventa fala quando a
  cena sugere conversa. Boca mexendo por baixo da narração nunca sincroniza.
- **No text or subtitles.** Ele gosta de escrever legenda queimada, quase sempre em inglês
  e errada.
- **Single continuous shot, no cuts.** Sem isso ele corta sozinho dentro dos oito segundos.
- **Keep the face, wardrobe, lighting and set exactly as in the image.** O lembrete que
  segura o desenho no lugar.

## Os dois regimes de movimento

Existem dois jeitos de pedir movimento, e usar o errado é o erro que mais custa geração.

### Regime A, cena narrativa

Personagem atuando numa história. Uma ação pequena por take: baixar a cabeça, piscar,
apoiar a mão, virar o olhar. Nunca duas. Movimento demais distorce rosto e mão na virada.

Câmera parada, ou push-in lento. Cena com duas pessoas completamente imóveis por oito
segundos o Veo costuma preencher inventando coisa, então dê um movimento mínimo a um dos
dois.

Aqui vale a trava de consistência: **keep the face, wardrobe, lighting and set exactly as
in the image.**

### Regime B, ação ampla

Dança, luta, esporte, comemoração. Tudo que precisa de corpo solto e amplitude grande.
Aqui a régua se inverte, e **as travas do regime A matam o movimento**.

Três coisas que travam o personagem e precisam sair do prompt:

| Frase | O que o modelo entende |
|---|---|
| `keep the character exactly as in the image` | Não mexa no personagem |
| `in place`, `never leaves the spot` | Fique parado |
| Parágrafo longo descrevendo cenário e luz | Dilui a instrução de movimento |

No lugar delas:

- **`feet planted, upper body moving freely`.** Separa as duas coisas: pé parado, corpo solto.
  É o que evita o personagem sair do quadro sem engessar o tronco.
- **Um gesto nomeado por clipe**, nunca "dance". Pedir dança devolve tremelique. Pedir
  "throws both front paws wide open to the sides, fully extended at shoulder height, then
  snaps them back" devolve movimento.
- **Amplitude e velocidade ditas**: `fully extended`, `as high as possible`, `sharp`,
  `snappy`, `big, loose`.
- **Prompt curto**, quatro ou cinco linhas. O resto é ruído.

### Como a dança nasce de verdade

Não é um clipe de oito segundos coreografado. É um **banco de gestos**: seis prompts, seis
movimentos distintos, todos partindo da **mesma imagem inicial**, no mesmo projeto. Partindo
do mesmo quadro, personagem, roupa e fundo ficam idênticos, e os clipes encaixam como se
fossem uma tomada só.

A coreografia nasce no corte, no compasso da música. Inclua sempre **um clipe de pausa**,
o personagem parado encarando a lente: dança boa tem respiro, e é a pausa que faz rir.

Caso real que calibrou isso: quatro gerações perdidas com o gato quase imóvel, todas por
causa da trava de consistência copiada de um projeto narrativo. Trocado o regime, o
primeiro clipe já saiu com as patas abrindo no limite.

## Os dois modos

- **Image to Video**: a imagem é o primeiro quadro. É o padrão, serve para quase tudo.
- **Frames to Video**: primeiro e último quadro, e o modelo interpola. Use só quando a
  ação transforma a cena de verdade, por exemplo uma folha em branco virando uma folha
  escrita. Os dois quadros precisam ter a mesma mão, a mesma luz e o mesmo enquadramento,
  senão a interpolação dá um salto.

## Defeito por causa

| Problema | Causa quase sempre | Conserto |
|---|---|---|
| O rosto virou outro | O prompt redescreveu a pessoa | Tirar toda descrição física do prompt |
| Apareceu legenda na tela | Faltou a trava de texto | Repetir a trava e gerar de novo |
| Ele começou a falar | Faltou a trava de diálogo | Repetir a trava e gerar de novo |
| Veio com trilha sonora | Faltou "No music" | Repetir a trava e gerar de novo |
| A mão derreteu | Movimento demais pedido | Uma ação só, mais lenta |
| Cortou no meio | Faltou "single continuous shot" | Repetir a trava |
| O movimento não bate com a imagem | A ação pedida pressupõe outra pose | Reescrever a ação olhando a imagem que saiu |
| O personagem mal se mexe numa cena de dança | Trava de consistência do regime A, ou `in place` | Tirar as duas, usar `feet planted, upper body moving freely` |
| A dança saiu como tremelique | O prompt pediu "dance" em vez de um gesto | Nomear um gesto só, com amplitude e velocidade |

## Antes de animar

Olhe as imagens lado a lado, numa folha de contato. Rosto que mudou, luz que fugiu ou
cenário diferente se conserta aqui, que custa uma imagem. Depois de virar vídeo, custa
uma geração de vídeo.
