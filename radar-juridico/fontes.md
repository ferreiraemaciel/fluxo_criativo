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

### Respondem a requisição simples

| UF | Endereço |
|---|---|
| AC | https://www.tjac.jus.br/noticias/ |
| AP | https://www.tjap.jus.br/portal/publicacoes/noticias.html |
| AM | https://www.tjam.jus.br/index.php/noticias |
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
| RO | https://www.tjro.jus.br/ |
| RR | https://www.tjrr.jus.br/index.php/noticias |
| SC | https://www.tjsc.jus.br/web/imprensa |
| SP | https://www.tjsp.jus.br/Noticias |
| SE | https://www.tjse.jus.br/portal/ |

18 de 27. Em PE, PI, RO e SE o endereço que responde é a home do portal, que lista as notícias recentes, e não uma página dedicada. Funciona, mas rende menos itens por consulta.

### Recusam requisição simples, provável que respondam ao navegador

| UF | Endereço candidato | O que aconteceu |
|---|---|---|
| GO | https://www.tjgo.jus.br/index.php/institucional/centro-de-comunicacao-social | HTTP 403 |
| PB | https://www.tjpb.jus.br/noticias | HTTP 403 |
| RN | https://www.tjrn.jus.br/index.php/comunicacao/noticias | HTTP 403 |

O 403 aqui é filtro de robô, não ausência de página. O STJ fazia o mesmo e cedeu ao navegador do app, então o caminho provável é o mesmo. Confirmar na primeira execução.

### Endereço ainda não localizado, levantar manualmente

| UF | O que foi tentado |
|---|---|
| AL | `/noticias`, `/index.php?tmp=noticias` e `/noticiaListar.php` devolvem uma página de 1,7 KB, sem conteúdo. Provável aplicação que monta a lista por script |
| BA | O portal responde, mas os caminhos testados caem em seções erradas (teletrabalho, memória). Falta o endereço da listagem geral |
| ES | `/noticias/` redireciona para a área do PJe, que é notícia de sistema, não de julgamento |
| PA | `/PortalExterno/imprensa/noticias` devolve 404 |
| RS | `/novo/noticia/` redireciona para uma matéria específica em vez da listagem. A listagem existe, falta o endereço certo |
| TO | A home responde, mas nenhum caminho de notícia testado respondeu |

6 pendentes. Felipe levanta manualmente e registra aqui.

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
