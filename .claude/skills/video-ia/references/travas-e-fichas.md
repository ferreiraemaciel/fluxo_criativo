# Trava de estilo, ficha de personagem e dicionário de locações

## A trava de estilo

Um bloco que descreve a aparência do filme e vai colado, idêntico, no começo de todo
prompt de imagem. Sete linhas, uma por decisão:

```
[tipo de filme e época]
[suporte, película, grão, halação]
[formato e proporção]
[luz: natureza, direção, o que estoura]
[paleta: três ou quatro cores nomeadas]
[lente, profundidade, altura de câmera, movimento]
[proibições: no text, no captions, no logos, no watermark]
```

Exemplo real, do manifesto da Black 2026:

```
Cinematic still from a Brazilian drama film, mid-2010s. Shot on 35mm film,
Kodak Vision3 500T, soft halation, fine visible grain. Vertical 9:16 framing.
Natural available light, warm tungsten interiors, blown-out windows.
Muted desaturated palette: warm amber, kraft paper beige, deep washed black,
faded stamp red. Shallow depth of field, 50mm lens, eye level, static camera.
Documentary realism, no stylization. No text, no captions, no logos, no watermark.
```

Escreva em inglês. Os modelos respondem melhor, e os termos de cinema têm tradução
instável em português.

**O que importa não é a trava ser boa, é ser idêntica.** Parafrasear uma linha muda a
imagem. Se precisar ajustar, ajuste e regere tudo que já saiu, nunca misture duas versões.

## O aviso de nome, que vai junto com o primeiro prompt

Cole isto uma vez, no começo da conversa com o gerador. É o que impede a imagem de sair
com nome de máquina e se perder na pasta de downloads:

```
Every image you generate: tell me, in the reply, the exact filename I should save it as.
I will give you the name with each prompt, in the form T01, T02, T16a. Never invent a
different name and never generate without a name.
```

E a ficha, que é a primeira de todas, salva como `ficha.png`.

## A ficha de personagem

Uma imagem só, antes de todas as outras:

```
Using the reference photos of this person, generate a single character sheet image.

Full body, standing, facing camera, neutral pose, arms relaxed at the sides.
Plain light grey seamless background, soft even studio light, no shadows on the wall.
Vertical 9:16 framing, full figure in frame with headroom.

The person: [idade, altura, porte, cabelo, barba, sobrancelha, olhos, nariz, expressão].
Keep the exact face from the photos.

Wardrobe: [figurino principal, peça por peça].

Photorealistic, 50mm lens, no stylization, no text, no logos, no watermark.
```

**Fotos de referência que funcionam:** rosto de frente com luz controlada, três quartos,
perfil, e uma de corpo inteiro ou da cintura para cima. Retrato de estúdio vale mais que
selfie, porque a IA copia a luz junto com o rosto. Descarte foto com sombra dura, fundo
bagunçado ou braço esticado.

**Quantas anexar:** quatro na ficha. Nas cenas, só a ficha aprovada mais a melhor foto de
rosto. Reanexar todas a cada cena contamina a luz e o filme perde unidade.

## O dicionário de personagens e locações

Escreva uma vez, reuse sempre, nunca parafraseie.

```
PERSONAGEM "NOME"
[descrição física fixa]. Same exact face in every image.
Wardrobe A ([quando]): [peças]
Wardrobe B ([quando]): [peças]

LOCAÇÕES, always described with these exact words
CODIGO1: [uma frase com os elementos fixos do lugar]
CODIGO2: [idem]
```

Limite o escopo. Dois figurinos e seis locações cobrem um filme de vinte planos. Cada
figurino e cada locação a mais multiplica o risco de inconsistência.

No prompt da cena, chame pelo código: `FELIPE at his desk. ESCRITORIO. Wardrobe A.`

## Personagem que não é pessoa real

Mesma lógica: gere a ficha primeiro, aprove, e use como referência. A diferença é que a
descrição física precisa ser mais detalhada, porque não há foto para ancorar. Idade,
formato de rosto, cabelo, cor de olho, marca particular.
