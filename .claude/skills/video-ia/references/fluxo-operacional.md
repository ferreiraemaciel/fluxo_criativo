# O fluxo operacional, passo a passo

Quem faz o quê, o que passa de um para o outro, e o que precisa voltar em cada etapa.
Testado em projeto real, e serve para vídeo de qualquer tamanho.

## O ciclo

```
 1. REFERÊNCIA    você manda o link         →  Claude assiste e extrai o padrão
 2. ROTEIRO       Claude escreve o texto    →  você valida   ← nada é gerado antes disso
 3. TAKES         Claude reparte em planos  →  você valida
 4. FOTOS         você aponta a pasta       →  Claude escolhe as que prestam
 5. FICHA         Claude escreve o prompt   →  você gera no GPT  →  volta a imagem
 6. PORTÃO        Claude aprova ou corrige a ficha
 7. IMAGENS       Claude manda os prompts   →  você gera no GPT  →  salva na pasta
 8. PROMPT VÍDEO  Claude olha as imagens que saíram e escreve o prompt do Flow
 9. VÍDEOS        você gera no Flow         →  baixa os clipes
10. MONTAGEM      você corta no editor      →  exporta
11. CONFERÊNCIA   Claude confere quadro a quadro, corrige legenda e faz os textos de tela
```

## O detalhe que faz diferença no passo 8

O prompt do Flow **não se escreve antes**, junto com o prompt da imagem. Ele se escreve
**depois**, olhando a imagem que de fato saiu.

Motivo concreto, de um caso real: o prompt previa a personagem passando e virando a
cabeça para olhar os dois homens no banco. A imagem saiu com ela já tendo passado deles,
caminhando na direção da câmera. O prompt original faria ela virar a cabeça para o nada.
Olhando a imagem, virou "ela continua andando e olha por cima do ombro".

Num projeto real, um em cada cinco prompts mudou depois de ver a imagem. Em um deles a
imagem estava com o gesto invertido e teve que ser refeita, o que só apareceu porque
alguém olhou.

## O que Felipe manda de volta em cada etapa

| Etapa | O que mandar |
|---|---|
| 4 | O caminho da pasta de fotos, ou as fotos |
| 5 | A imagem da ficha que o GPT gerou |
| 7 | O caminho da pasta com as imagens, nomeadas T01, T02, T03 |
| 9 | Nada, os clipes ficam com você |
| 10 | O caminho do arquivo exportado e a transcrição da legenda |

Nomear as imagens como `T01.png`, `T02.png` é o que permite conferir todas de uma vez e
casar cada uma com o prompt certo. Sem isso o controle se perde na décima. A tabela
completa de nomenclatura está na SKILL.md e vale para imagem, vídeo, lettering e arte.

## O que o Claude faz por código, nunca por IA de imagem

- Legenda, corrigida e exportada em `.srt` com os timecodes convertidos
- Letterings animados, em ProRes com canal alfa
- Cartela final animada
- Capa, com a imagem gerada por IA e a tipografia aplicada por cima
- Folhas de contato para conferir as imagens lado a lado
- Conferência do arquivo final quadro a quadro

IA de imagem escreve texto torto, em inglês e com letra trocada. Tudo que tem palavra na
tela sai de código.

## Quanto custa de geração

Uma imagem por plano, e um vídeo de 8 segundos por plano que tenha movimento.
Planos de detalhe que viram imagem parada com push-in no editor reduzem a conta de vídeo
sem perder nada na tela.
