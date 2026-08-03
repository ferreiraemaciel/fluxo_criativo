# Fontes do Radar Jurídico da Fotografia

> Lista curada das fontes que o radar consulta. Levantada e testada em 03/08/2026.
> Este arquivo é a lista de trabalho do agente. Quando uma fonte mudar de endereço ou parar de responder, corrigir aqui, não no código.

---

## Camada 1. Lei

| Fonte | Endereço | Como consultar | Testado |
|---|---|---|---|
| Câmara dos Deputados | `dadosabertos.camara.leg.br/api/v2/proposicoes` | Aceita filtro por palavra no próprio servidor (`keywords`) e por data de apresentação | Funciona |
| Senado Federal | `legis.senado.leg.br/dadosabertos/processo?ano=AAAA` | O endpoint antigo de busca foi desativado em 01/02/2026. O substituto responde, mas ignora palavra-chave, então o filtro é feito aqui. Cerca de 2 MB e 2.400 itens por ano | Funciona |
| Planalto | `planalto.gov.br` | Texto de lei já publicada, consulta direta | Funciona |

Termos de filtro para as duas casas: direito autoral, direitos autorais, direito de imagem, fotografia, uso de imagem, inteligência artificial, proteção de dados.

---

## Camada 2. Superior Tribunal de Justiça

| Fonte | Endereço | Como consultar | Testado |
|---|---|---|---|
| Buscador de jurisprudência (SCON) | `scon.stj.jus.br/SCON/` | Recusa requisição simples. **Responde ao navegador do app**, sem desafio de verificação. Preencher o campo "Digite o(s) critério(s) de pesquisa" e clicar em Pesquisar | Funciona |
| Informativo de Jurisprudência | `processo.stj.jus.br/jurisprudencia/externo/informativo/` | Requisição simples. Traz seleção curada, serve de rede de segurança, não substitui o buscador | Funciona |
| Notícias | `stj.jus.br/sites/portalp/Comunicacao/Ultimas-noticias` | Requisição simples | Funciona |

Buscas mínimas no SCON: `fotografia e "direito autoral"`, `fotógrafo e "direito autoral"`, `"obra fotográfica"`, `fotografia e "direito de imagem"`.
Operadores aceitos: `e`, `ou`, `adj`, `não`, `prox`, `mesmo`, `com`, `$`. Aspas para expressão exata.

**STF fora da varredura semanal**, por decisão do Felipe em 03/08/2026. Desde 2013 o Supremo rejeitou a repercussão geral do tema e devolve esses recursos sem julgar. Vira conferência trimestral.

---

## Camada 3. Tribunais de Justiça estaduais

Portais de imprensa. Publicam o caso já mastigado para jornalista, que é exatamente o formato que o radar aproveita.

Os 27 estão localizados e testados. O que muda de um para outro é **como** se lê, não se dá para ler.

### Entregam a notícia por requisição simples (12)

Servem o conteúdo já montado no HTML. Consulta barata.

| UF | Endereço |
|---|---|
| AP | https://www.tjap.jus.br/portal/publicacoes/noticias.html |
| CE | https://www.tjce.jus.br/noticias/ |
| DF | https://www.tjdft.jus.br/institucional/imprensa/noticias |
| MA | https://www.tjma.jus.br/midia/tj/noticias |
| MT | https://www.tjmt.jus.br/noticias |
| MS | https://www.tjms.jus.br/noticias |
| MG | https://www.tjmg.jus.br/portal-tjmg/noticias/ |
| PE | https://portal.tjpe.jus.br/ |
| PI | https://www.tjpi.jus.br/portaltjpi/ |
| PR | https://www.tjpr.jus.br/noticias |
| RJ | https://www.tjrj.jus.br/noticias |
| SP | https://www.tjsp.jus.br/Noticias |

Em PE e PI o endereço que funciona é a home do portal, que lista as recentes, e não uma página dedicada.

### Precisam do navegador (15)

Aqui a requisição simples devolve só o menu do site, ou é barrada por filtro de robô. A lista de notícias é montada por script no lado do leitor. Todos os 15 foram abertos e confirmados no navegador embutido do app.

| UF | Endereço | Por que precisa |
|---|---|---|
| AC | https://www.tjac.jus.br/noticias/ | Montada por script |
| AL | https://www.tjal.jus.br/noticias | Montada por script |
| AM | https://www.tjam.jus.br/index.php/noticias | Montada por script |
| BA | https://www.tjba.jus.br/portal/agencia-de-noticias/ | Montada por script |
| ES | https://www.tjes.jus.br/category/s1-front-page/ultimasnoticias/ | Montada por script |
| GO | https://www.tjgo.jus.br/index.php/institucional/centro-de-comunicacao-social | Filtro de robô, HTTP 403 |
| PA | https://www.tjpa.jus.br/PortalExterno/index-noticias.xhtml | Montada por script |
| PB | https://www.tjpb.jus.br/noticias | Filtro de robô, HTTP 403 |
| RN | https://www.tjrn.jus.br/noticias/ | Filtro de robô, HTTP 403 |
| RO | https://www.tjro.jus.br/ | Montada por script |
| RR | https://www.tjrr.jus.br/index.php/noticias | Montada por script |
| RS | https://www.tjrs.jus.br/novo/comunicacao/noticias-do-tjrs/noticias/ | Montada por script |
| SC | https://www.tjsc.jus.br/web/imprensa | Montada por script |
| SE | https://www.tjse.jus.br/portal/ | Montada por script |
| TO | https://www.tjto.jus.br/comunicacao/noticias | Montada por script |

**Consequência de arquitetura:** 15 dos 27 tribunais só se leem com navegador. Somado ao buscador do STJ, que também só cede ao navegador, o navegador deixa de ser recurso extra e passa a ser requisito da rotina. Sem ele, a camada dos estados perde mais da metade do país.

### Portais que ajudam mais que os outros

Três têm filtro próprio e valem consulta dirigida em vez de leitura da lista inteira:

- **RS.** Filtra por palavra-chave e por intervalo de datas, e classifica cada item entre Decisão e Institucional.
- **RN.** Separa uma categoria só de Decisões Judiciais.
- **BA.** Tem busca de notícias dentro da própria agência.

### Complemento que cobre o que os portais perderem

Busca restrita ao domínio dos tribunais (`jus.br`), com os termos do radar. Foi assim que o acórdão do TJMG apareceu na rodada de 03/08/2026, e naquele dia apareceu por acaso. Passa a ser consulta deliberada.

---

## Camada 4. Imprensa jurídica especializada

| Fonte | Endereço | Observação |
|---|---|---|
| Migalhas | https://www.migalhas.com.br/quentes | Costuma linkar o PDF da decisão em `arq.migalhas.com.br` |
| ConJur | https://www.conjur.com.br | Também linka a decisão. **Conferir sempre se o PDF é do processo citado.** Em 03/08/2026 o link rotulado "acórdão" entregou decisão de outro processo |

JusBrasil é proibido como fonte primária. Bloqueia robô e replica conteúdo de origem que já se alcança direto.

---

## Camada 5. Justiça do Trabalho

| Fonte | Endereço | Quando usar |
|---|---|---|
| TST | https://www.tst.jus.br/web/guest/noticias | Só quando o tema for vínculo, cachê, rescisão ou assistente de fotógrafo. Testado, responde |

---

## Manutenção

Conferir esta lista quando uma camada vier vazia duas rodadas seguidas. Portal de tribunal troca de endereço com frequência, e uma fonte silenciosa é indistinguível de uma semana sem notícia, que foi exatamente o risco que a rodada de 03/08/2026 expôs.
