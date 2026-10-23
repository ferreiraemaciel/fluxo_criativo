# Desafio Mandala Mão na Massa · Fluxo

> Página oficial: https://mandala-mao-na-massa.vercel.app/
> Lido em 20/10/2026. Felipe está participando.

## O combinado

**30 conteúdos em 30 dias**, de **21/10 a 21/11/2026**, fim de semana incluso. Vale Reels, carrossel,
vídeo de YouTube ou anúncio, sempre saindo da Mandala. Cada conteúdo publicado vale **10 pontos**.

## Formulário semanal, prazo de 48 horas

Abre depois que a semana fecha e some 48 horas depois. Perder uma semana não tira do grupo, mas tira
do prêmio. Sempre com o mesmo e-mail da inscrição.

| Semana | Conteúdos de | Formulário abre | Fecha |
|---|---|---|---|
| 1 | 21/10 a 28/10 | 29/10 | 30/10 |
| 2 | 29/10 a 05/11 | 06/11 | 07/11 |
| 3 | 06/11 a 13/11 | 14/11 | 15/11 |
| 4 | 14/11 a 21/11 | 22/11 | 23/11 |

O formulário pede **o link de cada conteúdo publicado na semana** e **prints de resultado**.

## Como pontua

1. **Resultado**: custo por venda menor, mais vendas, mais seguidores, mais engajamento.
2. **Qualidade do criativo**, pela régua do Fluxo.
3. **Volume**: 10 pontos por conteúdo publicado.
4. **Contribuição no grupo** do WhatsApp. Oi, bom dia e ok não contam.

Pódio: 1º leva 3 meses de Fluxo mais jantar com o Leandro, 2º leva 2 meses mais pack de 30 conteúdos,
3º leva 1 mês. Quem completa o desafio ganha uma Mandala 360º com o time.

## Por que isso importa aqui

O desafio termina em **21/11**, seis dias antes da **Black Friday de 27/11**, que já tem caderno
próprio em `BLACK-FRIDAY-2026.md`. O que performar aqui vira munição de campanha lá.

## A aba Desafio MMM no Tracker

Desde 20/10/2026 o painel tem a aba **Desafio MMM** (`frontend/app/desafio.jsx`), entre Anúncios e
Tráfego. Ela mostra o progresso (X de 30), os pontos de volume, os dias restantes, o ritmo necessário
por dia, e o alcance, as interações e os seguidores somados de tudo que já foi ao ar.

**O vínculo é na mão** (combinado com Felipe em 20/10/2026). O Orgânico publica muita coisa que não
entra no desafio, então só conta o que for escolhido no botão **Vincular criativo**, um por dia. O
modal pede o card (ORG ou ADS), o dia do desafio e o tipo da Mandala. A lista mora em
`app_config.chave='desafio_mmm'`, mesmo padrão do alarme da Visão Geral, então não precisou de coluna
nem de migration.

As peças aparecem em grade, no mesmo visual da aba Picos de Venda: capa 4:5, rótulo, situação, dia,
etiqueta da Mandala, link do post e as métricas embaixo (alcance e interações vindos de
`organico_metricas`, coletados uma vez por dia). Passando o mouse na peça aparecem o lápis, para
trocar dia ou tipo da Mandala, e o X, para tirar do desafio.

Uma seção recolhível lista o que foi publicado dentro da janela e ainda está fora do desafio, com um
clique para vincular.

Cada uma das quatro semanas tem o próprio cartão, com a contagem, a situação do formulário e o botão
**Copiar links**, que põe na área de transferência a lista pronta pro formulário daquela semana.

## O que eu faço por aqui

Manter esta tabela atualizada a cada conteúdo publicado, para o preenchimento do formulário semanal
ser só copiar e colar. O link do post entra quando o Felipe publicar.

### Registro dos 30

| # | Data | ORG/ADS | Formato | Tipo da Mandala | Tema | Link do post |
|---|---|---|---|---|---|---|
| 1 | 21/10 | ORG 344 | Reels | Contraste | A lente nova e o contrato que não existe | https://www.instagram.com/reel/DexYL71DE_Q/ |
| 2 | 22/10 | ORG 345 | Reels | Certo vs Errado | Antes do preço, o valor | |
| 3 | 23/10 | ORG 346 | Reels | Dilema | O prato da equipe | |
| 4 | | ORG 347 | Reels | Reflexão | O elogio que não paga e o que paga | |
| 5 | | ORG 348 | Reels | Explicação | Prazo folgado é estratégia | |

> O ORG 344 foi gravado e editado em 21/10 (corte, movimento, trilha, legenda e quatro animações
> explicativas), e é o primeiro conteúdo do desafio. Os outros quatro seguem aguardando gravação.
> A data entra quando forem ao ar.
> Já existem outros 17 cards montados (ORG 326 a 342) que também servem ao desafio.

## O que a agenda já resolve, e o que não resolve (levantado em 21/10)

**Cuidado com o formato.** Dos 24 posts agendados dentro da janela, **21 são imagem
estática**, que o desafio não aceita. Só pontuam Reels, carrossel, vídeo de YouTube
e anúncio.

| Situação | Quantidade |
|---|---|
| Já contam (344 publicado, 345 e 346 prontos) | 3 |
| Agendado na janela e que pontua (carrossel ORG 303, dia 09/11) | 1 |
| Agendado na janela e que **não** pontua (imagem) | 21 |
| **Falta para fechar os 30** | **26** |

**A munição parada:** 91 Reels e 33 carrosséis em produção, sem agendamento. Os mais
prontos são o 347 e o 348 (roteiro escrito), os 326 a 334 (vindos das reuniões com
leads) e os carrosséis 339 a 342.

**Dias da janela sem nada agendado:** 25, 27 e 28/10, e 1, 4, 8, 11, 14, 15, 17, 18
e 21/11.

**Decisão do Felipe em 21/10:** as imagens agendadas ficam como estão, sem virar
carrossel só para pontuar. O desafio se fecha com Reels e carrossel novos, gravados
em bloco.

### Tipos da Mandala já usados

Contraste, Certo vs Errado, Dilema, Reflexão, Explicação.

**Ainda não usados**, para variar nos próximos: Comparação, Apelo Emocional, Curiosidade, Demonstração,
Oportunidade, Visual, Clickbait, Prova, História, Ultra Segmentado, Problema-Solução, Sensação, Mito,
Pesquisa Científica, Atualidades, Atualidades Trend.

---

## A data do item é a data do card (22/10/2026)

O campo `dia` de cada item do desafio é espelho da data do card no Tracker:
`scheduled_at` quando está agendado, `published_at` quando já foi ao ar. Vale para
ORG e para ADS.

Nunca escolher a data por calendário vago nem encaixar no buraco da sequência. Dois
itens no mesmo dia tudo bem, se os dois cards estão marcados para aquele dia. Buraco
na sequência também tudo bem.

Card ainda sem data não entra no desafio. Primeiro agenda, depois lança aqui.

## Conferir os buracos a cada atualização (23/10/2026)

Toda vez que o desafio for atualizado, listar junto **os dias da janela que estão
sem material agendado ou publicado**. O desafio é 30 conteúdos em 30 dias, então
dia vazio é meta perdida, e o Felipe precisa ver isso na hora, não no fim.

Dia só com `data_prevista` **não conta como preenchido**. Data prevista é plano,
agendamento é compromisso. Só `scheduled_at` ou `published_at` fecham o dia.

## Painel de dias sem card (23/10/2026)

A aba Desafio MMM tem a seção **Dias sem card**, com os 32 dias da janela em
grade. Cada dia mostra se tem conteúdo e em que estado:

| Cor | O que quer dizer |
|---|---|
| Amarelo cheio | tem card publicado ou agendado e já está vinculado ao desafio |
| Amarelo fraco | tem card no dia, falta vincular no desafio |
| Vermelho | o dia já passou e ficou sem card |
| Cinza | ainda sem card, mas o dia não chegou |

Embaixo da grade sai a lista corrida dos dias vazios, e o KPI **Dias sem card**
repete o total no topo, com quantos deles já passaram.

A conta usa só `published_at` e `scheduled_at`. `data_prevista` não cobre o dia,
porque prevista é plano e agendada é compromisso.
