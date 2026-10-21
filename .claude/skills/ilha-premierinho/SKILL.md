---
name: ilha-premierinho
description: A ilha de edição. Edita um vídeo falado em Reels pronto para postar, a partir dos arquivos brutos da câmera. Faz a decupagem pela transcrição (escolhe a melhor tomada de cada trecho e joga fora pausa, respiro e gaguejo), monta o corte, aplica movimento de câmera, trilha cortada na medida, efeito sonoro pontual, legenda sincronizada, headline e animações explicativas. Use quando o pedido for editar vídeo, cortar vídeo, montar Reels, "edita esse bruto", "tira as pausas", "põe legenda", "faz a capa do Reels", "manda pra ilha", "bora pra ilha", ou quando chegarem arquivos .MOV/.MP4 de uma gravação falada para virar conteúdo.
---

# Ilha Premierinho

Transforma gravação bruta de alguém falando para a câmera em Reels publicável.
Serve para qualquer tema e qualquer identidade visual: o que está fixo aqui é a
**arquitetura do processo**, não a cor da legenda nem o tipo de animação.

Nasceu da edição do ORG 344 da FMN em 21/10/2026, e cada regra abaixo veio de um
erro cometido naquele dia ou de uma correção pedida pelo dono do vídeo.

---

## Antes de tudo: a ordem é sagrada

**Três etapas, nesta ordem, com aprovação entre elas.**

| Etapa | O que entra | Por que nesta ordem |
|---|---|---|
| **1. Corte** | Decupagem e seleção de tomadas. Nada mais. | É a única etapa que só o dono do vídeo sabe julgar. É a entrega dele. |
| **2. Imagem e som** | Enquadramento, zooms, trilha, efeitos sonoros | Quem julga aqui é o ritmo, e ritmo não se avalia com texto por cima |
| **3. Texto e gráfico** | Legenda, headline, animações explicativas | A legenda precisa saber onde o rosto está depois dos zooms |

**Nunca misturar.** Animar antes de o corte estar fechado faz com que qualquer
troca de tomada jogue fora o trabalho de efeito, e aí nasce a tentação de manter
uma tomada pior só para não refazer a animação.

Se a pessoa pedir tudo de uma vez, entregue assim mesmo, mas entregue em versões
separadas (v1 corte, v2 imagem, v3 texto), para ela poder reprovar uma etapa sem
derrubar as outras.

---

## Passo 0. Contexto e ferramentas

1. **Onde estão os brutos.** Em geral numa pasta do Downloads com o nome do
   conteúdo. Toda entrega volta para a mesma pasta, nunca para dentro do projeto
   (regra global do `~/.claude/CLAUDE.md`).
2. **Se existir roteiro**, leia antes. No Tracker FMN, o roteiro do card está em
   `conteudo_organico.roteiro`. Ele serve para conferir o que a pessoa quis dizer
   quando a transcrição ficar ambígua, não para cobrar fidelidade: quem grava muda
   as palavras, e a versão falada costuma ser melhor que a escrita.
3. **Confira a ferramenta** antes de montar qualquer filtro, com
   `ffmpeg -filters | grep -wE "ass|drawtext"`. Ver `references/ferramentas.md`.

---

## Passo 1. Decupagem e corte

### 1.1 Separe a fala do silêncio ANTES de transcrever

O Whisper erra feio o tempo das palavras em áudio longo com muitas pausas: ele
espalha o texto pelo arquivo inteiro e o resultado parece certo mas não bate com
a imagem. A volta é não transcrever o arquivo inteiro de uma vez.

```bash
# 1. acha os trechos de fala pelo silêncio
ffmpeg -hide_banner -nostats -i audio.wav -af silencedetect=noise=-33dB:d=0.6 -f null -
# 2. corta um .wav por trecho
# 3. transcreve cada trecho sozinho e soma o deslocamento
```

Script pronto em `references/decupagem.md`.

### 1.2 Escolha a melhor tomada de cada trecho

Quem grava repete. Em gravação caseira é normal a mesma frase aparecer de três a
seis vezes. Para cada trecho do conteúdo, escolha **uma**, pela ordem:

1. A que vai até o fim sem tropeço
2. A mais curta entre as que estão completas
3. A com mais vida na voz

Corte sem dó o que repete o argumento já dito com outras palavras. É a diferença
entre denso e arrastado.

### 1.3 Margem de corte

Comece **seca**: 0,06 s antes do início da fala e 0,06 s depois do fim. A margem
folgada (0,12 s ou mais) deixa um respiro que soa amador em quase todo corte.

Onde a pessoa apontar que ficou longo, aperte para 0,02 s na entrada e **corte
antes** do fim detectado (margem negativa) no final.

### 1.4 Entregue e pare

Renderize já no formato final (9:16, 1080x1920, 30 quadros) sem efeito nenhum e
peça a aprovação das **tomadas**, não do ritmo nem do visual. Diga quais tomadas
você descartou e por quê: é essa lista que a pessoa vai querer contestar.

Se o vídeo ficou bem mais longo que o roteiro previa, **diga o tamanho e ofereça
o enxugamento**, com os cortes nomeados. Não corte sozinho: conteúdo denso é uma
escolha legítima.

---

## Passo 2. Imagem e som

### 2.1 Movimento de câmera

Régua que resolve 90% dos casos:

- **A escala muda no corte, nunca no meio da frase.** Zoom que começa no meio de
  uma fala é a assinatura de edição automática.
- **Cada tomada entra numa escala diferente da anterior**, entre 100% e 118%.
  Só isso já tira a cara de vídeo parado, mesmo em corte seco.
- **Zoom lento** (3 a 7% ao longo da tomada) nos trechos longos de argumento. Um
  deles pode ser ao contrário, abrindo em vez de fechando, para dar respiro.
- **Zoom seco** só em três ou quatro pontos do vídeo inteiro, nas viradas. Se
  estiver em todo lugar, nenhum significa nada.
- **A janela do corte fica um pouco acima do centro** (fator 0,38 em vez de 0,5),
  senão o topo da cabeça some.

Nunca distorça: só escala proporcional e deslocamento.

### 2.2 Trilha

Escolha pelo tema e pelo registro da fala, nunca pelo que está na moda. Conversa
de mesa pede algo sem vocal e sem melodia marcante.

Peça ao banco de trilhas a **versão na duração exata** do vídeo em vez de cortar
na mão: começo e fim ficam musicais. Com o conector da Epidemic:

```
EditRecording(id, { targetDurationMs: <duração em ms>, forceDuration: true, downloadAudioFormat: "WAV" })
PollEditRecordingJob(jobId) → DownloadRecordingEdit(jobId, editId)
```

Mixagem que funciona: voz normalizada com corte de grave, trilha a 13 ou 14% do
volume, fade de 1,2 s na entrada e 1,5 s na saída, limitador no fim.

```
[0:a]dynaudnorm=f=200:g=5,highpass=f=85[voz];
[1:a]volume=0.13,afade=t=in:st=0:d=1.2,afade=t=out:st=<fim-1.5>:d=1.5[mus];
[voz][mus]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]
```

### 2.3 Efeito sonoro

Pontual, sempre. Som bom é o que ninguém percebe que está lá.

- Ancore cada som numa **palavra**, achando o tempo dela na transcrição
- Volume entre 0,16 e 0,34, nunca acima
- **O silêncio também é efeito.** Se um som marca a presença de algo (dinheiro
  entrando), não marque a ausência dele: o contraste fica mais forte sem som

Para variar o tom de um mesmo efeito sem baixar outro arquivo:
`asetrate=48000*0.55,aresample=48000` deixa grave, bom para impacto.

---

## Passo 3. Texto e gráfico

### 3.1 Confira a transcrição ANTES de queimar

Obrigatório. O Whisper erra nome próprio, gíria e número, e erro em legenda
queimada só sai refazendo. Leia a lista inteira dos blocos e corrija nome de
produto, valor, e o que o roteiro ajudar a decifrar. Avise quais palavras você
corrigiu por dedução, para a pessoa confirmar.

Aproveite e tire o que contraria a régua de escrita do projeto (no FMN: nada de
travessão, exclamação ou pergunta no gancho).

### 3.2 Legenda

**O agrupamento quebra primeiro na pontuação e só depois por tamanho.** Cortar de
três em três palavras sem olhar o ponto final produz bloco que começa com a sobra
da frase anterior ("NO WHATSAPP. E"), e isso faz o texto parar de ler como frase.

- Blocos de até 3 palavras ou 22 caracteres, dentro da mesma frase
- Palavra órfã volta para o bloco anterior em vez de aparecer sozinha
- Cada bloco dura até o próximo começar, para não piscar
- Tamanho inicial 62 px em 1080 de largura. Maior que isso rouba o quadro
- Contorno preto grosso (6 a 7 px), porque o fundo muda a cada tomada
- Entrada com um pop curto de dois quadros (94% → 100%)
- **Destaque de cor só nos números e nas palavras que carregam o argumento.**
  Se tudo é destaque, nada é

### 3.3 Headline

- Fica nos primeiros 3 a 5 segundos. **Enquanto ela está na tela, legenda não entra**
- **Longe do rosto.** No meio do quadro ela cai em cima da cara de quem fala.
  A faixa de baixo costuma ser o lugar certo
- Uma subheadline pequena acima dela serve para filtrar o público ("fotógrafo e
  videomaker"), o que faz quem não é do ramo rolar e quem é, parar

O que escolher como headline: a que faz a pessoa **se reconhecer**, não a que
resume o conteúdo. Headline que resume entrega o assunto e a pessoa decide que já
sabe. Ofereça três ou quatro opções com o mecanismo de cada uma explicado
(paralelismo, número específico, acusação direta) e recomende uma.

### 3.4 Animações explicativas

Isto é o que separa vídeo de celular de peça produzida, e é também o que mais
estraga se for feito do jeito óbvio.

**O problema:** o topo da tela é onde está a cabeça de quem fala. Gráfico ali
compete com a pessoa.

**A solução:** nos momentos escolhidos, a **imagem inteira desce** (cerca de 470
px em 1920), em 0,35 s, e a faixa que sobra em cima é onde o gráfico vive. Uma
linha fina da cor da marca fecha a faixa embaixo. Quando acaba, a imagem sobe.
Nenhum pixel é esticado, só deslocado.

```
# uma expressão só, com as janelas somadas (elas não se sobrepõem)
overlay=0:'470*(between(t,a1,b1)*min(1,(t-a1)/0.35)*min(1,(b1-t)/0.35) + ...)'
```

**Escolha de 3 a 5 momentos**, nunca mais. Cada um precisa ser uma ideia que a
imagem explica melhor que a fala: uma lista que empilha, uma barra que corre, dois
números lado a lado, um carimbo que bate.

**Toda animação tem som próprio**, casado com o movimento, não com a fala.

Estilo que envelhece bem: vetor simples, cores da marca, movimento com peso
(`expo_out` para entrada, `back_out` para o salto), nada de brilho, partícula ou
sombra colorida.

### 3.5 Capa

Capa de orgânico é **quadro do próprio vídeo** com uma frase curta, sem moldura,
sem logo, sem caixa de fundo. Pegue a tomada com a melhor **reação** (riso,
espanto, mão na testa), não a que resume o conteúdo.

Escureça só a parte de baixo, o suficiente para a letra segurar, e mantenha o
texto dentro do recorte que o perfil mostra (1080x1350 central de um 1080x1920),
senão corta na grade.

---

## O que entregar, sempre

1. **O arquivo na pasta de origem**, com nome que diz a versão e o que mudou
2. **A lista de decisões**, tomada por tomada, do que entrou e do que saiu
3. **Os problemas que você viu**, mesmo não perguntados (duração acima do
   previsto, frase repetida, palavra que a transcrição deduziu)
4. **O caminho completo do arquivo**, em texto copiável

---

## Referências

- `references/ferramentas.md` — o que precisa estar instalado e as armadilhas de cada ferramenta
- `references/decupagem.md` — scripts de silêncio, transcrição por trecho e montagem do corte
- `references/texto-e-animacao.md` — legenda em ASS, desenho em Python, animações e capa
