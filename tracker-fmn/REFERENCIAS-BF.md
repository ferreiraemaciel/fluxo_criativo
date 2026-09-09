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
