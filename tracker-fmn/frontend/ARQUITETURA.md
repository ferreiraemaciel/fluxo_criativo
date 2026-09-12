# Como o painel do Tracker funciona por dentro

> Escrito na auditoria de 12/09/2026. Três convenções fazem este painel
> funcionar e nenhuma delas estava escrita em lugar nenhum: quem entrasse no
> projeto (pessoa ou sessão nova de IA) só descobria quebrando.

## Não existe montagem, o navegador monta na hora

Os arquivos em `app/` são JSX compilado no próprio navegador pelo Babel, que o
`index.html` carrega antes de tudo. Não há empacotador, não há `import` entre
arquivos, não há `node_modules` em produção. Consequências práticas:

- **Tudo é global.** Um `const X` no topo de um arquivo vira uma variável
  global depois da compilação. Dois arquivos com o mesmo nome não dão erro: o
  que carrega por último vence, em silêncio. Foi assim que o filtro de período
  da tela Funis parou de filtrar (o `PERIODOS` do `site.jsx` atropelava o do
  `funis.jsx`) e que o ticket de referência ficava com o valor do outro arquivo.
- **A ordem do `index.html` é a ordem de execução.** `supabase.js`, `auth.js` e
  `financas.js` primeiro, depois `shared.jsx`, depois as telas, `main.jsx` por
  último.
- **O que é compartilhado mora em `shared.jsx`** e sai por `Object.assign(window, …)`
  no fim do arquivo. É lá que ficam `buscarTudo`, `TICKET_PADRAO`, os
  componentes comuns e os ícones.

Ao criar um arquivo novo, prefira nomes específicos (`PERIODOS_SITE`, não
`PERIODOS`) ou ponha a coisa em `shared.jsx` e use de lá.

## O carimbo de versão é automático

Cada `<script>` do `index.html` carrega com `?v=…`. Esse valor é o resumo do
conteúdo do arquivo, escrito por `scripts/carimbar-versoes.py`, que roda sozinho
dentro de `scripts/publicar-tracker.sh`. Publique sempre por ele:

```bash
bash scripts/publicar-tracker.sh
```

Antes disso o número era escrito à mão e, em 34 das 183 publicações, alguém
esqueceu: o time rodava uma mistura de versões, uma tela nova conversando com um
`shared.jsx` velho. Como tudo divide o mesmo escopo, isso não dava erro, dava
número errado.

## O banco corta em mil linhas, sempre

O Supabase devolve no máximo 1.000 linhas por consulta, e `.limit(5000)` não
aumenta esse teto, só engana. Para varrer tabela grande (vendas, leads,
contatos, insights), use `window.buscarTudo`, que pagina com `.range()` até
esgotar:

```js
const vendas = await window.buscarTudo(() => window.db
  .from('vendas').select('…').eq('status', 'aprovada'));
```

Esse corte já escondeu 574 de 1.574 leads na tela de Funis e fez o Dashboard
calcular faturamento e ROAS em cima de mil vendas quando a base tinha 1.549.

## Data de hoje é a de Brasília

`new Date().toISOString().slice(0,10)` devolve a data de Londres, e a partir das
21h isso já é o dia seguinte. Use `window.FMNFinancas.dataBRT()` para hoje e
`dataBRT(data)` para converter. Para filtrar por período no banco, use
`window.FMNFinancas.brtRangeUtc(de, ate)`, que converte a janela para UTC.

## Os dois kanbans escrevem status diferente

| Tela | Coluna inicial | Demais |
|---|---|---|
| `kanban.jsx` (Anúncios) | `fazer` | `fazendo`, `ativo`, `campeoes`, `arquivado` (minúsculas) |
| `organico.jsx` (Orgânico) | `Fazer` | `Fazendo`, `Produção`, `Publicado`, `Arquivado` (capitalizadas) |

Os workers que gravam mídia tratam as duas grafias de propósito. Ao mexer em um
dos dois, confira em qual convenção você está: eles compartilham 20 blocos de
código quase idênticos, copiados e não reaproveitados, e já divergiram por isso.

## Custo por venda tem uma régua só

O custo por venda de um anúncio usa **o maior entre o que o Meta atribuiu e o que
a Hotmart registrou**, porque cerca de uma em cada três vendas não chega ao
Pixel. A aba Tráfego e o ranking da Visão Geral seguem essa régua. Não invente
outra conta numa tela nova.
