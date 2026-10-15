---
name: video-ia
description: Produz vídeo narrativo inteiro com IA, do roteiro ao arquivo pronto para montar, usando ChatGPT para as imagens e Google Flow (Veo) para os vídeos, com consistência de personagem, cenário e estética entre todos os planos. Use quando o pedido for vídeo gerado por IA, filme, minissérie, manifesto, trailer, história em vídeo, anúncio em vídeo sem filmagem, ou quando a pessoa disser que quer fazer um vídeo sem câmera.
---

# Vídeo com IA

Responda sempre em português do Brasil.

## O que esta skill resolve

O problema de vídeo com IA nunca é gerar um plano bonito. É gerar **vinte planos que
parecem o mesmo filme**: o mesmo rosto, a mesma roupa, a mesma parede, a mesma luz.
Quem gera plano a plano, improvisando o prompt, termina com vinte curtas diferentes
grudados com fita.

Esta skill é o método que garante unidade. Vale para qualquer estilo, drama, documental, comédia, institucional ou animação, e para
qualquer tamanho: um vídeo de 20 segundos com 4 planos usa o mesmo método de um de 4
minutos com 40.

## Duas regras que vêm antes de tudo

**1. O roteiro vem primeiro, sempre, e em texto corrido.** Nenhuma imagem, nenhum prompt
de vídeo e nenhuma arte antes de o roteiro estar escrito e aprovado pela pessoa. E o
roteiro nasce como texto, não como tabela de planos: primeiro a história em voz alta,
depois a repartição em takes.

Quem gera primeiro e escreve depois termina com imagens bonitas que não contam história,
e joga fora metade. Quem já escreve repartido fragmenta antes de saber o que quer dizer.

**2. Tudo se chama T.** O take manda no nome de todo arquivo do projeto, do começo ao fim.
Ver a seção de nomenclatura abaixo.

## As quatro ferramentas e o que cada uma faz

| Ferramenta | Papel |
|---|---|
| **Claude** (aqui) | Assiste a referência, escreve roteiro e todos os prompts, gera por código tudo que tem texto na tela |
| **ChatGPT** | Gera as imagens, uma por plano |
| **Google Flow (Veo)** | Transforma cada imagem em vídeo de 8 segundos, com áudio ambiente |
| **Premiere** (ou outro editor) | Corta, põe narração, legenda e um ajuste de cor único |

**Regra de divisão de trabalho:** tudo que tem **palavra escrita na tela** é feito em
código, nunca gerado por IA. Título, lettering, cartela, legenda. IA de imagem escreve
texto torto, em inglês e com letra errada, e você só descobre depois de gerar vinte vezes.

## O fluxo, em oito etapas

### 1. Ver a referência antes de escrever qualquer coisa

Se a pessoa mandou um link ou um vídeo de referência, **assista de verdade** antes de
opinar. Baixe, extraia frames, monte uma folha de contato e leia o padrão: duração média
do plano, movimento de câmera, paleta, onde a legenda senta, como abre, como fecha.

Nunca deduza a estética a partir da descrição verbal de um vídeo.

### 2. Escrever o roteiro, que é texto corrido

Primeiro o texto inteiro, do começo ao fim, como se fosse ser lido em voz alta para uma
pessoa. Sem take, sem plano, sem coluna. Só a história, ou o argumento, ou a fala.

Essa ordem importa. Quem já escreve repartido em planos fragmenta antes de saber o que
quer dizer, e termina com vinte cenas bonitas que não contam nada. O roteiro tem que
funcionar lido em voz alta antes de virar imagem.

**Esta etapa termina com aprovação explícita da pessoa.** Nada avança sem isso.

### 3. Repartir em takes

Só agora o texto vira tabela: take, o que a cena mostra, a locução daquele pedaço, a
duração.

**O número de takes sai do roteiro, nunca de uma regra.** Um vídeo de 20 segundos pode
ter 4 planos, um de 3 minutos pode ter 40. Quem manda é o texto e o ritmo que você quer.

Duas contas que ajudam:

- **Duração da narração:** fala em ritmo de filme corre a cerca de 120 palavras por
  minuto. Divida o número de palavras por 2 para ter os segundos.
- **Quantos planos:** no estilo observacional, um plano a cada 4 a 6 segundos de
  narração. Ritmo rápido de rede social pede 2 a 3 segundos. Peça institucional
  contemplativa aguenta 8 a 10.

Corte o take onde a narração respira, não onde a frase acaba.

### 4. A trava de estilo

Um bloco de texto que descreve a aparência do filme e que vai colado, **sem mudar uma
palavra**, no começo de todo prompt de imagem. Ele define, em uma frase cada: tipo de
filme, suporte e grão, formato, luz, paleta, lente e altura de câmera, e as proibições
(sem texto, sem logo, sem marca d'água).

O que faz a trava funcionar é ser literalmente idêntica. Parafrasear é o que faz a
parede mudar de cor entre um plano e outro.

Ver `references/travas-e-fichas.md` para o modelo e um exemplo completo.

### 5. A ficha de personagem, que é o portão

Antes das imagens das cenas, gere **uma imagem só**: a pessoa de corpo inteiro, pose
neutra, fundo liso, luz de estúdio, no figurino da história.

Quando o personagem é uma pessoa real, peça três ou quatro fotos: rosto de frente, três
quartos, perfil e uma de corpo. Prefira retrato com luz controlada a selfie, porque a IA
copia a luz junto com o rosto.

**Esta é a etapa que decide o projeto.** Se o rosto não sair certo aqui, não adianta
gerar as outras vinte imagens. Conferir na ficha custa uma imagem, conferir no fim custa
o projeto inteiro. Não avance sem aprovação explícita da ficha.

Dali em diante, anexe a **ficha aprovada**, não as fotos originais.

### 6. As imagens, uma por plano

Cada prompt tem quatro partes, nesta ordem: trava de estilo, personagem, locação (sempre
com as mesmas palavras), ação do plano.

Limite o número de figurinos e de locações, e escreva cada um uma vez só, num dicionário
que você reusa. Dois figurinos e seis locações cobrem um filme inteiro.

Quando dois personagens aparecem juntos pela primeira vez, anexe as imagens dos dois.
É o momento em que a IA mais erra.

### 7. Os vídeos no Flow

**A regra que muda o resultado:** quando a imagem já existe, o prompt **não descreve a
cena**. Ela já foi decidida. Descrever de novo faz o modelo redesenhar, e o rosto
escorrega, a camisa muda de tom, a parede troca de cor.

O prompt diz só: o que o sujeito faz, o que a câmera faz, o som, e as travas.

Ver `references/prompt-flow.md` para o modelo, as travas obrigatórias e a tabela de
defeito por causa.

### 8. A montagem

- Corte na respiração da narração, nunca no fim do movimento da imagem
- Oito segundos gerados viram 4 a 6 na timeline. Oito inteiros arrastam
- De vários takes dá para tirar dois pedaços e usar em momentos diferentes
- Grave a narração **de uma vez só**, de cima a baixo. Em pedaços, cada pedaço nasce com
  uma energia e o corte denuncia
- Um ajuste de cor único na timeline inteira, nunca take a take

## A nomenclatura, que é obrigatória

O take é a chave do projeto inteiro. Numerado com **dois dígitos**, começando em T01, na
ordem da linha do tempo, nunca na ordem de produção.

| Coisa | Nome |
|---|---|
| Take no roteiro | `T01`, `T02`, `T03` |
| Imagem gerada | `T01.png` |
| Take com dois quadros | `T16a.png` e `T16b.png` |
| Duas tentativas da mesma imagem | `T12A.png` e `T12B.png`, e a perdedora se apaga |
| Vídeo gerado | `T01.mp4` |
| Arquivo para a edição | `T01-nome-curto.mp4`, sem acento e sem espaço |
| Lettering e arte | `L1-nome.mov`, `T24-cartela-final.mp4` |

Por que isso não é frescura: num filme com mais de dez planos, a partir do décimo
ninguém lembra qual imagem é qual. Com a numeração, dá para montar uma folha de contato,
conferir tudo de uma vez e casar cada imagem com o prompt certo. Sem ela, o controle se
perde e você gera duas vezes a mesma coisa.

**Cuidado com a diferença entre sufixo de quadro e sufixo de versão.** `T16a` e `T16b` são
o primeiro e o último quadro do mesmo vídeo, e vão juntos para o Flow em Frames to Video.
`T12A` e `T12B` são duas tentativas da mesma imagem, e só uma sobrevive. Confundir os dois
faz o Flow animar de uma versão para a outra e a mão trocar de dono no meio do plano.

## Onde a imagem é salva, e com que nome

**Toda imagem nasce com nome e endereço, nunca no Downloads com nome de máquina.**

Gerador de imagem devolve arquivo com nome aleatório, do tipo `exec-a772dcbb-c618.png`,
e ele cai na pasta de downloads junto com todo o resto. Num projeto de vinte planos, isso
vira caça ao tesouro na terceira imagem, e alguém acaba animando o take errado.

**A pasta do projeto, criada antes da primeira imagem:**

```
<projeto>/cenas/          T01.png, T02.png, T16a.png, T16b.png
<projeto>/referencia/     as fotos que travam o personagem
<projeto>/clipes/         T01.mp4, T02.mp4, saídos do Flow
<projeto>/pecas/          letterings, cartela, capa
```

**O que dizer ao gerador, junto com a mensagem de abertura:**

```
Every image you generate: tell me, in the reply, the exact filename I should save it as.
I will give you the name with each prompt, in the form T01, T02, T16a.
Never invent a different name and never generate without a name.
```

**Regra para quem salva:** renomeie **na hora de salvar**, não depois. Imagem que fica cinco
minutos no Downloads com nome de máquina é imagem que ninguém sabe mais qual é.

**Conferência barata:** antes de animar qualquer coisa, monte uma folha de contato com todas
as imagens numeradas lado a lado. Se faltar um número na sequência, você descobre ali, e não
depois de gerar quinze vídeos.

## Decisões que valem em qualquer projeto

**Ninguém fala em cena.** Boca mexendo por baixo de narração nunca sincroniza, e o olho
pega na hora. Fala de personagem vira frase na narração ou lettering.

**Áudio ambiente sim, música não.** O ambiente nasce junto com a cena e soa parte dela.
Música gerada por take dá uma trilha diferente a cada plano, e no corte vira salada. A
trilha entra uma vez só, por cima de tudo.

**Plano de detalhe pode ser imagem parada.** Papel, carimbo, objeto na mesa: imagem com
um push-in de três por cento no editor tem a mesma leitura e custa uma geração a menos.
Economize vídeo para o que tem gente se mexendo.

**Uma ação por take.** Baixar a cabeça, piscar, apoiar a mão. Duas ações juntas derretem
mão e rosto na virada.

## Antes de entregar

- [ ] O roteiro foi escrito em texto corrido e aprovado antes de qualquer geração
- [ ] A repartição em takes veio depois do roteiro aprovado
- [ ] Todo arquivo está nomeado por take, com dois dígitos, e salvo na pasta do projeto
- [ ] O gerador foi avisado de que toda imagem tem nome definido antes de gerar
- [ ] A referência foi assistida de verdade, não deduzida
- [ ] A ficha de personagem foi aprovada antes das outras imagens
- [ ] A trava de estilo é idêntica em todos os prompts
- [ ] Cada locação aparece sempre com as mesmas palavras
- [ ] Todo prompt do Flow tem as travas de fala, texto, música e corte
- [ ] Tudo que tem palavra na tela foi feito em código
- [ ] As imagens foram vistas lado a lado antes de virar vídeo

## Referências

- `references/travas-e-fichas.md`: modelo da trava de estilo, da ficha de personagem e do dicionário de locações
- `references/prompt-flow.md`: modelo de prompt do Flow, travas e defeitos conhecidos
- `references/fluxo-operacional.md`: a ordem prática, quem faz o quê e o que mandar de volta em cada etapa
