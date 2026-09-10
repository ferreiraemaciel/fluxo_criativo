---
name: cronograma-black
description: Gera a planilha de conteúdo completa de uma campanha de Black Friday, dia a dia, a partir da data de abertura do carrinho (D0), no formato da planilha da Mikaele, com as 3 fases (antecipação, captação e carrinho aberto). Use sempre que o usuário pedir cronograma da Black, calendário de conteúdo, planilha da campanha, plano de stories e feed dia a dia, ou informar a data do carrinho e pedir o plano dos dias, mesmo que ele não use essas palavras exatas.
---

> **Precedência no projeto FMN.** Skill trazida do Playbook Black Friday (Ultra Retiro, Gabriel Vilas Boas), preservada como veio.
> Neste projeto ela obedece às regras globais: tom de voz do Felipe (`.claude/rules/tom-de-voz-felipe.md`), Light Copy e acentuação.
> Onde a regra de estilo daqui divergir (ex: "pra" em legenda, que o Felipe usa), vale a regra do projeto.
> Antes de gerar, ler o caderno `tracker-fmn/BLACK-FRIDAY-2026.md` e a ficha da campanha no Tracker (aba Picos de Venda), que já trazem D0, oferta, mote e decisões.

# Cronograma de Conteúdo da Black

Responda sempre em português do Brasil.

## O que esta skill faz

Recebe a data de abertura do carrinho (D0) e gera a planilha de conteúdo da campanha inteira, dia a dia, no formato da planilha da Mikaele: Data, Tema do dia, Ações de stories, Ações de feed, Objetivo estratégico do dia, Status.

## Regras de estilo obrigatórias

Valem para todo texto gerado, sem exceção:

1. Nunca usar o caractere "e comercial". Escrever "e".
2. Nunca usar travessão ou hífen como pontuação. Usar vírgula, dois pontos ou ponto.
3. Escrever "para", nunca "pra" ou "pro".
4. Falar "picos de vendas", nunca "lançamento".
5. Nunca prometer resultado financeiro nem garantia de aprovação em plataforma.
6. Frases curtas, voz ativa, segunda pessoa.
7. Todo texto gerado é rascunho para a pessoa revisar: avise isso sempre no final da resposta.

## Antes de gerar, pergunte

Se as respostas já estiverem na conversa, extraia e confirme. Pergunte só o que faltar:

1. Data de abertura do carrinho (D0). Sugestão padrão: entre 10 e 15 de novembro.
2. Produto e público.
3. O "combinado" da campanha (a frase âncora que se repete; na Mika era "não compre nada ainda, combinado?").
4. Quais dias da semana são de descanso (na Mika, domingo).
5. Se a pessoa tem manifesto pronto (se sim, ele entra como peça de feed na fase 1).

## A estrutura das 3 fases

Este é o esqueleto que a skill preenche:

1. FASE 1, ANTECIPAÇÃO: 21 dias, de D-28 até D-8. Objetivo: gerar desejo e antecipação, pegar os seguidores mais impulsivos e levar todos para a primeira live. Termina na live que abre a captação (D-8).
2. FASE 2, CAPTAÇÃO: 8 dias, de D-8 até D0. Começa na live que anuncia a Black e revela a data. A pressão sobe todo dia, tudo aponta para o grupo. Todas as ações usam as palavras promoção, desconto, super oportunidade.
3. FASE 3, CARRINHO ABERTO: 8 dias, de D0 até D+7. Um dia, uma objeção.

Nota de montagem: a live que encerra a fase 1 é a mesma que abre a fase 2. Na tabela, o D-8 entra uma única vez, como o dia da live, usando a entrada do arco da fase 2. O dia 21 da fase 1, a véspera ("é amanhã, às 20h"), cai no dia anterior à live.

## O arco da fase 1, dia a dia (modelo Mika 2025, transpor para as datas da pessoa)

1. Dia 1: a inquietação (enquete "você está onde imaginava?", que ranqueia o perfil antes do trailer).
2. Dia 2: o sonho da liberdade (rotina simples).
3. Dia 3: o primeiro conselho (o combinado nasce: "não compre nada ainda", e o TRAILER sai no feed).
4. Dia 4: reforço e conexão (responder caixinhas).
5. Dia 5: o custo do tempo.
6. Dia 6: a prova da vida real (carrossel de família com um slide da data no meio).
7. Dia 7: descanso.
8. Dia 8: a dor da realidade (reels com respostas da caixinha, CTA comente e cadastre).
9. Dia 9: o ponto de virada.
10. Dia 10: o manifesto (feed).
11. Dia 11: repercussão do manifesto.
12. Dia 12: honrando as raízes (caixinha sobre os pais, vira carrossel).
13. Dia 13: descanso.
14. Dia 14: descanso intencional (comunicado como merecimento).
15. Dia 15: contagem regressiva (sticker de 7 dias, reels).
16. Dia 16: o caminho x a vontade (teaser do método).
17. Dia 17: a narrativa do medo (reels do arrependimento).
18. Dia 18: a quebra do "será?".
19. Dia 19: hype para a live (faltam 3 dias, caixinha).
20. Dia 20: última chamada (despertador).
21. Dia 21: véspera da virada ("é amanhã, às 20h você vai ter uma escolha").

## O arco da fase 2, dia a dia

1. D-8: live "A Promessa do Recomeço" (anuncia a Black, revela a data, CTA massivo para o grupo).
2. D-7: a prova do movimento (faltam 7 dias, sticker).
3. D-6: o legado e a família (caixinha dos pais).
4. D-5: a dor da estagnação (custo da indecisão, post estático do arrependimento).
5. D-4: o caminho simplificado (spoiler dos diferenciais).
6. D-3: prova social massiva (enxurrada de depoimentos, reels compilado).
7. D-2: a véspera da decisão (post estático: é amanhã, 20h, a abertura).
8. D0: o dia da abertura (contagem o dia todo, live às 20h com carrinho aberto ao vivo).

## O arco da fase 3, dia a dia (um dia, uma objeção)

1. D+1: boas vindas e efeito manada (tour da área de membros, prints da comunidade).
2. D+2: o caminho simplificado (quebra o "é complicado demais").
3. D+3: não tenho dinheiro (custo da inação, ROI, parcelamento, carrossel de 3 perspectivas).
4. D+4: não tenho tempo (casos de rotina corrida, 30 a 60 minutos por dia).
5. D+5: a força da comunidade (ninguém fica sozinha).
6. D+6: início da urgência (faltam 3 dias, bônus que somem).
7. D+7: a véspera (reels olhando para a câmera: em 24 horas fecha).
8. D+8: a última chamada (live às 20h, pitch final, últimas horas, vídeo de carrinho fechado).

## Os 5 padrões que precisam estar embutidos na planilha

1. O combinado: uma frase âncora que se repete a cada 3 ou 4 dias até virar memória.
2. Feed raro, stories diários: na fase 1 são só 5 a 7 peças de feed em 3 semanas. O trabalho diário é dos stories.
3. Caixinha vira conteúdo: a pergunta de hoje é o reels de amanhã. Custo zero e prova social embutida.
4. Enquete no dia 1: ranqueia o perfil antes do trailer sair.
5. Descanso programado e comunicado como parte da narrativa de merecimento. Se o dia de descanso da pessoa for outro dia da semana, mova as entradas de descanso para esses dias mantendo a ordem do arco.

## Ritmo e volume

Com o Severino, a meta mínima é 1 post por dia e o ideal é 2. Na Black, volume de presença sustenta captação e carrinho aberto.

## Referências

1. Planilha original da Mika (3 abas, o formato a imitar): https://docs.google.com/spreadsheets/d/1UIEBp4DpaTA5x2VTbUiWHJtj8yVhYr3YaGLr2lPHmJE/edit?usp=sharing
2. Sequências de stories e insights de audiência (10 séries): https://docs.google.com/document/d/1b51_6T5pO_JPViLz2M_GOzEJN8zg9KIo9OK8me99iig/edit?usp=sharing
3. As 10 séries de stories por função: 1 Pensamentos que eu tive antes de começar (vulnerabilidade e identificação, 7 stories). 2 Coisas que ninguém te conta (desconstrução de crenças, 8). 3 Conversas que eu tenho comigo mesma (vulnerabilidade, 6). 4 Se você soubesse o que eu sei (despertar de consciência). 5 Por que eu decidi mudar (história pessoal, 5). 6 Desculpas que eu usava (espelhamento, 8). 7 Sinais que você precisa ver (urgência emocional, 10). 8 Frases que eu ouvi e você também vai ouvir (resistência de compra, 6). 9 O que mudou quando eu comecei a ganhar (possibilidade, 7). 10 Perguntas que eu faço para mim mesma.
4. Antes de escrever qualquer série de stories, o método manda ler as mensagens da própria audiência e agrupar por dor, desejo e crença. O padrão das séries: começam na dor com nome, passam pela prova de que a pessoa não está sozinha e terminam em caixinha ou comentário. O CTA quase nunca é comprar, é responder.

## Formato da saída

Uma planilha (ou tabela pronta para colar no Sheets) com as colunas: Data, Dia (D-28 a D+8), Fase, Tema do dia, Ações de STORIES, Ações de FEED, Objetivo estratégico do dia, Status.

1. Datas reais calculadas a partir do D0 informado. Confira o calendário com atenção, porque um erro de data desloca a campanha inteira.
2. Dias de descanso marcados conforme a resposta da pessoa.
3. Aviso final: adapte os temas à sua história antes de produzir.
