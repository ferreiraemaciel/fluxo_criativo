# Materiais de referência da Black Friday

> Onde estão: bucket **`fmn-referencias`** no Cloudflare R2, sob o prefixo `black-friday/`.
> Bucket **privado**, sem domínio público, porque é material do retiro pago da mentoria do Ladeira.
> Cópia local em `tracker-fmn/referencias-bf/` fica fora do git (`.gitignore`).

## Como abrir um arquivo

```bash
cd ~/Documents/fem-site/scripts
npx wrangler r2 object get "fmn-referencias/black-friday/CAMINHO" --remote --file ~/Downloads/nome.pdf
```

Trocar `CAMINHO` por uma das chaves da tabela abaixo. Ou é só me pedir que eu busco.

## Debriefing

| Arquivo | Chave no R2 |
|---|---|
| Debriefing das 3 maiores Blacks da Hotmart, 46 páginas, Leandro Ladeira | `debriefing/debriefing-blackfridays-ret.pdf` |

Anotado na Parte 13 do caderno. É onde está o Segredo da Oferta (desconto x ancoragem) e os resultados de 2025.

## BF 2023, Black Vitalícia

| Arquivo | Tipo | Chave no R2 |
|---|---|---|
| Página de captação | PDF | `bf23/pagina-de-captacao-black-vitalicia.pdf` |
| Página de vendas | PDF | `bf23/pagina-de-vendas-black-vitalicia.pdf` |
| Não renove meus cursos | card | `bf23/nao-renove-meus-cursos-card.png` |
| Paga apenas uma vez | card | `bf23/paga-apenas-uma-vez-card.png` |
| Você vai pagar uma única vez | anúncio de vendas | `bf23/voce-vai-pagar-uma-unica-vez.jpg` |
| Lote especial liberado | anúncio de vendas | `bf23/lote-especial-liberado.jpg` |
| Últimas horas, lote especial | anúncio de vendas | `bf23/ultimas-horas-lote-especial.jpg` |

A página de vendas está dissecada na Parte 12 do caderno.

## BF 2024, Big Black Friday Infinita

| Arquivo | Tipo | Chave no R2 |
|---|---|---|
| Página de captação | PDF | `bf24/pagina-de-captacao-big-black-friday.pdf` |
| Página de vendas | imagem | `bf24/pagina-de-vendas-big-black-friday.jpg` |
| Carrossel Fórmula do Sucesso | PDF | `bf24/carrossel-formula-do-sucesso.pdf` |
| Black Infinita | card | `bf24/black-infinita-card.jpg` |
| Sua única chance | card | `bf24/sua-unica-chance-old-fd.jpg` |
| Motivo pra continuar | card | `bf24/motivo-pra-continuar-fd.jpg` |

## BF 2025, Ultra Black Friday Infinita

| Arquivo | Tipo | Chave no R2 |
|---|---|---|
| Página de captura | PDF | `bf25/pagina-captura-ultra-black-friday-infinita.pdf` |
| Página de vendas | PDF | `bf25/pagina-vendas-ultra-black-friday-infinita.pdf` |
| Carrossel A oferta mais insana | PDF | `bf25/carrossel-a-oferta-mais-insana.pdf` |
| Inscrições abertas | card | `bf25/inscricoes-abertas-card.png` |
| Vai ser lendária | card | `bf25/vai-ser-lendaria-card.jpg` |
| Nada dura pra sempre | card | `bf25/nada-dura-pra-sempre-card.jpg` |

## Vídeos

Os 19 vídeos não foram salvos em lugar nenhum, só os links de origem, que continuam no ar. Índice completo por ano e por fase em `black-friday/VIDEOS-LINKS.md` no R2, e a mesma lista está reproduzida abaixo por conveniência.

Base dos links: `https://materiais.readytogo.com.br/104-FLUXO/materiais-de-apoio/retiro-black-friday-2026/referencias/`

| Ano | Peças |
|---|---|
| BF23 | `bf23/voce-vai-morrer.mp4`, `bf23/voce-ja-prometeu-que-nao-iria-comprar-mais-curso-online.mp4`, `bf23/iphone.mp4`, `bf23/perdi-a-casa-lote-especial.mp4` |
| BF24 | `bf24/antecipacao-tease-big-black-friday.mp4`, `bf24/nao-acredito-que-voce-nao-entrou.mp4`, `bf24/por-que-voce-ta-tao-relaxado.mp4`, `bf24/leandro-sonhando-old.mp4`, `bf24/a-primeira-blackfriday-infinita-old.mp4`, `bf24/bonus.mp4`, `bf24/voce-ja-prometeu-que-nao-iria-comprar-mais-curso-online-old.mp4` |
| BF25 | `bf25/antecipacao-trailer-ultra-black-infinita-01.mp4`, `bf25/antecipacao-trailer-ultra-black-infinita-02.mp4`, `bf25/desconto-pra-alunos.mp4`, `bf25/90-por-cento-de-desconto.mp4`, `bf25/inscricoes-abertas-geral.mp4`, `bf25/juntos-no-sofa.mp4`, `bf25/as-melhores-mentes.mp4`, `bf25/manychat-e-canva.mp4` |

**Os dois trailers de 2025 são os mais importantes.** São a peça central da narrativa, e o playbook manda estudar o trailer antes de escrever o nosso.

---

## Playbook Black Friday: todos os links, por seção

Varredura completa de https://playbook-black-friday.vercel.app em 10/09/2026. São 90 links únicos.
Cada um aparece dentro da tarefa certa no Tracker (aba Picos de Venda, ícone de livro na tarefa).
As 4 skills do playbook foram baixadas e instaladas em `.claude/skills/`.

### Visão geral

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Quadro resumo da Black Nobre](https://www.figma.com/board/M7pEyJzv6JJZFks0tSnHw8/RESUMO---BLACK-NOBRE?node-id=0-1) (Figma, pede login) | quadro | Definir produto principal, preço fora do pico e preço do pico; Responder as 9 perguntas |

### Engenharia reversa da data

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Skill de cronograma geral da Black](https://playbook-black-friday.vercel.app/skills/cronogramageralblack.skill) (já instalada: cronograma-geral-black) | skill | Definir produto principal, preço fora do pico e preço do pico; Definir a data de entrega dos anúncios e das páginas |

### Oferta e combo

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Slides da live e oferta do Nobre 2025, 57 páginas](https://canva.link/ce67l0s2cisxs2p) (camisa, caneca, caixa secreta e empilhamento. Canva, pede login) | doc | Montar o combo item por item; Escolher item físico e sorteio; Montar a ancoragem em 6 camadas; Live de abertura |
| [Slides da oferta da Black MMM (Mikaele)](https://canva.link/1v469jc7lznpl73) (bônus por velocidade e ancoragem. Canva, pede login) | doc | Montar o combo item por item; Definir os bônus por velocidade; Live de abertura |
| [Página de vendas do Método Mulher Milionária, print completo](https://playbook-black-friday.vercel.app/lp/mmm.png) (oferta, bônus por velocidade e ancoragem na ordem da rolagem) | imagem | Montar o combo item por item; Definir os bônus por velocidade; Montar a ancoragem em 6 camadas; Página de oferta especial publicada e testada |
| [Página de vendas MMM ao vivo](https://mikaellegomes.com.br/metodomulhermilionariav2/) (pode ter mudado desde o print) | pagina | Página de oferta especial publicada e testada |

### Narrativa e trailer

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Manifesto e trailer da Black COE, 639 palavras](https://docs.google.com/document/d/10r2ixni0o0cQlupgXolZhcvAKkthdVPeRan2J8a4WfE/edit?usp=sharing) (ler junto com os 6 blocos) | doc | Escrever a narrativa e o manifesto; Escrever o roteiro do trailer |
| [Trailer da Black da Mikaele](https://drive.google.com/file/d/1kGM0NtyXeVWgYZMy6onLEPpSftu2pQaW/view?usp=sharing) (referência de tom. Drive, pede login) | video | Escrever o roteiro do trailer; Gravar os dois trailers; Soltar o trailer; Trailer renderizado para abrir a live |
| [Maratona Black COE, anúncio, 11/11/2024](https://youtu.be/XAgN8rhAtrA) (narrativa de aviso do zero) | video | Escrever a narrativa e o manifesto; Gravar os dois trailers |
| [Fuja do longo prazo com opções, 15/11/2024](https://youtu.be/iQB1vl_sqkY) (ângulo contrário ao consenso na abertura) | video | Escrever a narrativa e o manifesto; Gravar os dois trailers; Publicar conteúdo de comparação |
| [Black do COE, oferta completa, 22/11/2024](https://youtu.be/1Fe9pvFl3PM) (ordem dos elementos, do combo ao preço) | video | Montar a ancoragem em 6 camadas; Primeira live de vendas; Segunda live de vendas |
| [Diferenciais de um operador de elite, 14/10/2025](https://youtu.be/_mjJO-jJEx4) (captação com curso gratuito junto) | video | Escrever o roteiro do trailer |
| [Skill de manifesto e trailer](https://playbook-black-friday.vercel.app/skills/manifestotrailerblack.skill) (já instalada: manifesto-trailer-black) | skill | Escrever a narrativa e o manifesto; Escrever o roteiro do trailer |

### Aquecimento

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Presentes e vantagens, Black CEO, 08/11/2025](https://youtu.be/jmuKde0GK-c) (empilhamento de bônus 3 dias antes, sem preço) | video | Produzir 3 a 6 vídeos de aquecimento; Começar a revelar os bônus, um por vez; Revelar presentes e vantagens |
| [Short: a Maratona Black CEO está chegando](https://youtube.com/shorts/zNYiauf_4ro) (primeiro sinal público do aquecimento, 26/10/2025) | video | Subir campanhas de relacionamento; Produzir 3 a 6 vídeos de aquecimento |
| [A grande oportunidade está chegando, 08/11/2025](https://youtu.be/sIW518hKgQU) (antecipação da condição, desconto como promessa) | video | Produzir 3 a 6 vídeos de aquecimento; Revelar presentes e vantagens |
| [Criativos de aquecimento da Maratona Black CEO, escritos](https://docs.google.com/document/d/1xWY1tQs97HO2zBM3IEkXmWTO3hPOJlGygyEITFzk3Ow/edit?usp=sharing) (três ângulos do mesmo convite) | doc | Subir campanhas de relacionamento; Produzir 3 a 6 vídeos de aquecimento |
| [Contagem no YouTube: Faltam 15 dias](https://www.youtube.com/post/UgkxbUhBh-FKfN_GPCViDFiIxvmyTqdwcbfp) (aba Posts do YouTube, Black CEO 2025) | post | Ligar a contagem regressiva |
| [Contagem no YouTube: Faltam 10 dias](https://www.youtube.com/post/Ugkx5EplQ9E7zTK0u0dMVncNdB2th570w_me) (aba Posts do YouTube, Black CEO 2025) | post | Ligar a contagem regressiva |
| [Contagem no YouTube: Faltam 7 dias](https://www.youtube.com/post/Ugkx4FhmC_zDIFZqqvK9SgPyBYOjQqmHNttx) (aba Posts do YouTube, Black CEO 2025) | post | Ligar a contagem regressiva |
| [Contagem no YouTube: Faltam 5 dias](https://www.youtube.com/post/UgkxummCViCHLFRKk-Qb80YRJM72r9NiwM90) (aba Posts do YouTube, Black CEO 2025) | post | Ligar a contagem regressiva |
| [Contagem no YouTube: Faltam 3 dias](https://www.youtube.com/post/UgkxEv7y_veUGWMQhPSJuBasfocSXQ2TkjhL) (aba Posts do YouTube, Black CEO 2025) | post | Ligar a contagem regressiva |
| [Contagem no YouTube: É amanhã, faça seu cadastro](https://www.youtube.com/post/Ugkx3ddZzH0NhItdvtovjCDkUU8F5r259ABB) (aba Posts do YouTube, Black CEO 2025) | post | Ligar a contagem regressiva; Post de véspera, "é amanhã" |

### Calendário stories e feed

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Planejamento de conteúdo da Black MMM, 37 dias](https://docs.google.com/spreadsheets/d/1UIEBp4DpaTA5x2VTbUiWHJtj8yVhYr3YaGLr2lPHmJE/edit?usp=sharing) (copiar a estrutura de fases e refazer as datas) | planilha | Ligar o ritmo diário de publicação; Enquete de dor no stories; Começa a antecipação diária; A frase "não compre nada ainda" entra no ar |
| [Post de antecipação da Black](https://www.instagram.com/reel/DQy95yNkY3E/) (reels) | post | Começar a mostrar a preparação; Começa a antecipação diária |
| [Post pré Black com a data no meio](https://www.instagram.com/p/DQwtW7sEaI6/?img_index=6) (carrossel, ver o slide 6) | post | Soltar o trailer |
| [Pré Black de aquecimento, Nobre](https://www.instagram.com/p/DQnWOWwDn3-/) | post | Soltar o trailer |
| [Consciência de produto mais captação](https://www.instagram.com/reel/DQhd1dfjrKK/) (reels) | post | Publicar conteúdo de comparação |
| [Post de aquecimento](https://www.instagram.com/reel/DQ4-pMHCT0r/) (reels) | post | Produzir 3 a 6 vídeos de aquecimento |
| [Carrossel de vagas abertas](https://www.instagram.com/p/DQ5ZrwRkTkM/) (grande abertura) | post | Reels do grande dia |
| [Post de ao vivo](https://www.instagram.com/p/DQ5N6TiiXc1/) (carrinho aberto) | post | Conteúdo explicando o produto |
| [Sequências de stories, 10 séries e 71 peças](https://docs.google.com/document/d/1b51_6T5pO_JPViLz2M_GOzEJN8zg9KIo9OK8me99iig/edit?usp=sharing) (filtrar por fase antes de abrir) | doc | Ligar o ritmo diário de publicação; Ler caixinhas e comentários do perfil; Enquete de dor no stories |
| [Skill de cronograma de conteúdo](https://playbook-black-friday.vercel.app/skills/cronogramablack.skill) (já instalada: cronograma-black) | skill | Ligar o ritmo diário de publicação |

### Captação

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Captação orgânica do Jr Borja, peça 1](https://www.instagram.com/reel/DCFhfCgRGQm/) (gancho dos primeiros segundos e onde entra a chamada) | post | Uma chamada por dia, sem exceção |
| [Captação orgânica do Jr Borja, peça 2](https://www.instagram.com/reel/DCaSUwSpejQ/) (mesmo destino, entrada diferente) | post | Uma chamada por dia, sem exceção |
| [Pasta Comente Black, 10 criativos em vídeo](https://drive.google.com/drive/folders/1Rc8d0Z8tpj9tdbpY55x1GTjCDo_jxnqD?usp=sharing) (comenta BLACK, a automação entrega o link do grupo) | pasta | Ligar a série "comente a palavra" |
| [Página de captura da Maratona Black, Nobre, print](https://playbook-black-friday.vercel.app/lp/nobre.png) (promessa, evento gratuito, formulário, CTA para o grupo) | imagem | Definir as três páginas do funil; Preparar a página de inscrição |
| [Página Black Friday do Segundeiro Raiz, print](https://playbook-black-friday.vercel.app/lp/segundeiro.png) | imagem | Definir as três páginas do funil |
| [Página Super Black 2025 da Priscila, print](https://playbook-black-friday.vercel.app/lp/priscila.png) | imagem | Definir as três páginas do funil |
| [Landing da Maratona Black, Nobre, ao vivo](https://gruponobreinvestidor.com.br/maratonablack/) (estudar proposta, CTA e formulário) | pagina | Preparar a página de inscrição |
| [Landing Black Friday do Segundeiro Raiz, ao vivo](https://lp.segundeiroraiz.com.br/black-friday/) (explica o vitalício com clareza) | pagina | Preparar a página de inscrição; Página de oferta especial publicada e testada |
| [Landing Super Black 2025, Priscila, ao vivo](https://priscilaaraujogmn.com.br/superblack-2025-exemplo/) | pagina | Definir o nome e o mote da campanha; Preparar a página de inscrição |
| [Anúncio de captação da Priscila, peça 1](https://www.instagram.com/p/DQHZZR7gF5R/) (mote: a Pri só pode estar ficando louca. Nenhuma revela o desconto) | post | Definir o nome e o mote da campanha; Ter os criativos de captação prontos |
| [Anúncio de captação da Priscila, peça 2](https://www.instagram.com/p/DQXXGXQgH1W/) (Instagram Ads) | post | Ter os criativos de captação prontos |
| [Anúncio de captação da Priscila, peça 3](https://www.instagram.com/p/DQetGZQgAfJ/) (Instagram Ads) | post | Ter os criativos de captação prontos |
| [Anúncio de captação da Priscila, peça 4](https://www.instagram.com/p/DQHZgPQgGOk/) (Instagram Ads) | post | Ter os criativos de captação prontos |
| [Anúncio de captação da Priscila, peça 5](https://www.instagram.com/p/DQT1YImAIEO/) (Instagram Ads) | post | Ter os criativos de captação prontos |
| [Copy de criativo estático de captação](https://docs.google.com/document/d/1115t_P1VKMnSf7n1I5G0LwDaU-0cBH91/edit?usp=sharing) (conversa vazada de WhatsApp, caixinha respondida) | doc | Ter os criativos de captação prontos |
| [Copy de criativo de vídeo de captação](https://docs.google.com/document/d/19Y4shlTtPhBmvFmjycAeea1dK3Uxw8DR/edit?usp=sharing) (hook, direção de cena e edição) | doc | Ter os criativos de captação prontos |
| [Criativos de captação escritos, cinco ângulos](https://docs.google.com/document/d/1XZe73thsBRpkuLvjfMl4Nem0p6GsMG8rETXZCbyZFUo/edit?usp=sharing) (todos vendem a inscrição, nenhum vende o curso) | doc | Definir o nome e o mote da campanha; A frase "não compre nada ainda" entra no ar; Ter os criativos de captação prontos |
| [Skill de copy e criativo de captação](https://playbook-black-friday.vercel.app/skills/captacaoblack.skill) (já instalada: captacao-black) | skill | Ter os criativos de captação prontos |

### Roteiro da live

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Reels de O GRANDE DIA](https://www.instagram.com/reel/DQ4GlcYEdkh/) (vende o sonho e deixa a oferta para a live) | post | Reels do grande dia |
| [Black CEO ao vivo, a abertura de 11/11/2025](https://youtube.com/live/xASDxSSXbOU) (live completa do grande dia, com o roteiro de 14 blocos do lado) | video | Live de abertura |
| [Aula 3: Super desconto de Black, abertura de 2024](https://youtube.com/live/v9r_xHvsjMI) (os disparos e e-mails do playbook rodaram neste dia) | video | Aula de aquecimento 3; Live de abertura |
| [Live completa da Black MMM, 2h41](https://youtu.be/I0W2ux2b_lk) (o roteiro de 14 blocos executado) | video | Live de abertura |
| [Lembretes da live, a remessa completa](https://drive.google.com/drive/folders/17Cd5hgyUKUU12_r4Fv4c3H27YjsqrL-k?usp=sharing) (as 6 peças que rodam no dia) | pasta | Programar as 6 campanhas de lembrete; Disparos do dia da abertura |

### Conteúdo por fase

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Última oportunidade 4, 17/11/2025](https://youtu.be/udPfYsYDYng) (rajada: 4 peças no mesmo dia) | video | Conteúdo avisando o último dia; Rajada final de disparos |
| [Última oportunidade 3, 17/11/2025](https://youtu.be/1OHTQexqsQw) (rajada: 4 peças no mesmo dia) | video | Conteúdo avisando o último dia; Rajada final de disparos |
| [Última oportunidade 2, 17/11/2025](https://youtu.be/GvMdKX7v5Wo) (rajada: 4 peças no mesmo dia) | video | Conteúdo avisando o último dia; Rajada final de disparos |
| [Última oportunidade 1, 17/11/2025](https://youtu.be/doHoCiJGIfs) (rajada: 4 peças no mesmo dia) | video | Live de replay e pitch de último dia; Conteúdo avisando o último dia; Rajada final de disparos |
| [Anúncio de captação 1, 06/11/2025](https://youtu.be/u-CNsOoH9ew) (4 peças em lote no mesmo dia) | video | Subir a campanha de captação |
| [Anúncio de captação 2, 06/11/2025](https://youtu.be/S54gdpodjQw) (4 peças em lote no mesmo dia) | video | Subir a campanha de captação |
| [Anúncio de captação 3, 06/11/2025](https://youtu.be/grV2XLZxjL0) (4 peças em lote no mesmo dia) | video | Subir a campanha de captação |
| [Anúncio de captação 4, 06/11/2025](https://youtu.be/mPt6rMAl3qI) (4 peças em lote no mesmo dia) | video | Subir a campanha de captação |
| [Convite do Nobre para a maratona, 26/10/2024](https://youtu.be/oxoYtE9OdUs) (antecipação) | video | Aula ou live para os alunos, avisando do pico; Subir campanha de antecipação |
| [Desconto exclusivo, 01/11/2024](https://youtu.be/OxK91Kt-y4A) (captação) | video | Subir a campanha de captação |
| [Defender posições, 01/11/2024](https://youtu.be/h7oefDJdFl0) (captação por conteúdo) | video | Uma chamada por dia, sem exceção |
| [Opere como tesouraria, 01/11/2024](https://youtu.be/5rlZB1FfdqI) (captação por conteúdo) | video | Uma chamada por dia, sem exceção |
| [Maratona Black COE, reprise de janeiro, 17/01/2025](https://youtu.be/dCIrPs1367w) (o pico reaproveitado fora de novembro) | video | Evento de implementação |
| [Aula 1: Hedges e manejos, 20/11/2024](https://youtube.com/live/roC34OmeS2I) (entrega conteúdo e planta a oferta sem abrir o carrinho) | video | Aula de aquecimento 1 |
| [Aula 2: Estruturas de potencialização, 22/11/2024](https://youtube.com/live/l7AhEav8SGA) (ponte entre conteúdo e convite para a abertura) | video | Aula de aquecimento 2 |
| [Criativo de chamada para a aula 1, 2025](https://youtube.com/live/6gGgxbk1F0g) (comparar com o de 2024) | video | Subir campanha de antecipação; Subir a campanha de captação |
| [Criativo de chamada para a aula 2, 2025](https://youtube.com/live/ympfp5rgi6c) (encurtamento e promessa única) | video | Subir a campanha de captação |
| [Criativo de chamada para a aula 3, 2025](https://youtube.com/live/fam60v-cg5E) (já prepara a oferta da abertura) | video | Subir a campanha de captação |

### Disparos

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Disparos em grupo, exemplo real](https://drive.google.com/file/d/1zGz1BMSYKrRE_xxrz89QMgSHQRHhEcPl/view?usp=sharing) (ritmo entre mensagens, mídia e texto. Drive, pede login) | video | Disparo convidando para a aula 1; Disparo "amanhã é o grande dia"; Disparos do dia da abertura; 1 a 2 disparos por dia |
| [Disparo em API, exemplo real](https://drive.google.com/file/d/1qEYrdN1PuGk9tSkJmv3qjKdEVeXoubm8/view?usp=sharing) (tamanho da mensagem na tela do celular. Drive, pede login) | video | Definir a cadência de follow; Disparo para alunos e base antiga; Disparo convidando para a aula 1; Disparos do dia da abertura; 1 a 2 disparos por dia |
| [Nove e-mails do dia da abertura, Black COE](https://docs.google.com/document/d/1zLyBicEbHvLcj58_hNIShMUV1Nra0T-ZRCDaZwUjlG0/edit?usp=sharing) (cadência de um dia inteiro) | doc | Disparo para alunos e base antiga; Disparos do dia da abertura; Rajada final de disparos |

### Caso Priscila 2025

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Priscila, post de antecipação 01](https://www.instagram.com/p/DP_teIdDgz2/) (caso Priscila 2025) | post | Começar a mostrar a preparação; Começa a antecipação diária |
| [Priscila, post de antecipação 02](https://www.instagram.com/p/DQCN3WojnE_/) (caso Priscila 2025) | post | Começar a mostrar a preparação; Começa a antecipação diária |
| [Priscila, post de antecipação 03](https://www.instagram.com/p/DQT81xYjvNA/) (caso Priscila 2025) | post | Começa a antecipação diária |
| [Priscila, post de antecipação 04](https://www.instagram.com/p/DQUWqhTDhgL/) (caso Priscila 2025) | post | Começa a antecipação diária |
| [Priscila, post de antecipação 05](https://www.instagram.com/p/DQpJvQEDkEt/) (caso Priscila 2025) | post | Começa a antecipação diária |
| [Priscila, post de carrinho aberto 01](https://www.instagram.com/p/DQuLetojtBv/) (caso Priscila 2025) | post | Conteúdo explicando o produto |
| [Priscila, post de carrinho aberto 02](https://www.instagram.com/p/DQvD73nkcmi/) (caso Priscila 2025) | post | Conteúdo explicando o produto |
| [Priscila, post de carrinho aberto 03](https://www.instagram.com/p/DQzMyTwERlm/) (caso Priscila 2025) | post | Conteúdo explicando o produto |
| [Priscila, post de carrinho aberto 04](https://www.instagram.com/p/DQzFZWFEeLQ/) (caso Priscila 2025) | post | Provas novas todo dia |
| [Priscila, post de carrinho aberto 05](https://www.instagram.com/p/DQ7i8uOEr0S/) (caso Priscila 2025) | post | Provas novas todo dia |
| [Priscila, post de carrinho aberto 06](https://www.instagram.com/p/DRDaTilkvw4/) (caso Priscila 2025) | post | Provas novas todo dia |
| [Priscila, post de carrinho aberto 07](https://www.instagram.com/p/DRQiNl3jopX/) (caso Priscila 2025) | post | Fechar sem prorrogar |

### Recursos e aulas

| Referência | Tipo | Onde entra no Tracker |
|---|---|---|
| [Slides de aquecimento do último pico de vendas](https://canva.link/oh18y85o69bpa5v) (adaptar para as aulas de aquecimento. Canva) | doc | Aula de aquecimento 1; Aula de aquecimento 2; Aula de aquecimento 3 |
