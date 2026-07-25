# UTM Template — Tracker FMN

> **Atualizado em 2026-07-13.** Antes dessa data, o template único abaixo era colado em TODO anúncio, inclusive nos que iam direto pro checkout da Hotmart. Isso causava vendas rastreadas aparecendo como "Direto" no Tracker, porque a Hotmart não lê `utm_*` soltos no link de pagamento, só o parâmetro próprio dela (`sck`). Ver o achado completo na sessão de 2026-07-13 (auditoria "Últimas Vendas" mostrando Andressa Bastos e Maryellen Bonini com UTM completo no quiz_leads mas "Direto" na venda).
>
> **Atualizado de novo em 2026-07-25.** Achado sério: o separador real que o `hotmart-webhook` (e os scripts `sync_hotmart.py`/`backfill_utms.py`) usam pra dividir o `sck` **não é `"|"`**, é uma string de 10 caracteres (`hQwK21wXxR`). Isso significa que o formato `sck=fonte|meio` documentado abaixo até 2026-07-25 **nunca conseguia separar campos de verdade** — a Hotmart devolvia o `sck` inteiro como uma string só, que caía inteira em `utm_source` (com o `|` literal dentro). Só funcionava por acaso quando o `sck` tinha um único campo, sem `|` nenhum (tipo `sck=meta-ads`). O formato novo abaixo resolve isso mandando só o ID do anúncio, sem separador nenhum — descoberto ao investigar a venda da Lucélia Aparecida e do Bruno Varreira em 24/07, que chegaram com `utm_source: "fb|mcv215120249165"` (o sck inteiro, sem split, jogado em `utm_source`) e `meta_ad_id: null`.

## Qual template usar depende do destino do anúncio

### Caso A — Destino é direto pro checkout da Hotmart (`pay.hotmart.com/...`)

A Hotmart **nunca lê `utm_source`/`utm_campaign`/etc. soltos** num link de checkout. Ela só lê o parâmetro `sck`, e ele tem **limite de 30 caracteres no total** (fonte oficial: [Central de Ajuda Hotmart](https://help.hotmart.com/pt-br/article/216441797/como-identificar-a-origem-das-minhas-vendas-na-hotmart-)).

**Cole isso no campo "Parâmetros de URL" do Meta:**

```
sck=meta-ads
```

**Não dá pra separar fonte/meio/campanha/anúncio com `|` nesse campo** — o separador que o Tracker usa de verdade pra dividir o `sck` (`hQwK21wXxR`) tem 10 caracteres, então só um campo cabe de verdade nos 30 caracteres totais. Qualquer `sck=fonte|meio` vira uma string única (com o `|` dentro), tudo cai em `utm_source`, `utm_medium`/`campaign`/`content` ficam vazios.

**Não dá pra rastrear `ad.id` individual num link direto pro checkout** (o ID sozinho já tem 15-18 dígitos, estoura os 30 caracteres junto com qualquer outro campo). Pra granularidade de anúncio específico indo direto pro checkout, só via integração nativa da Hotmart com o Pixel do Meta (rastreio automático que já funciona sozinho quando o anúncio aponta direto pro checkout e o pixel da Hotmart detecta o clique — foi assim que a venda do "Elízio" em 10/07 ficou corretamente atribuída a `meta_ad_id`, sem UTM manual nenhum).

### Caso B — Destino é uma página própria (quiz, landing page, site do produto)

Aí sim usa o UTM padrão completo, porque a página lê `utm_*` normalmente (GA4, Meta Pixel):

```
utm_source=FB&utm_campaign={{campaign.name}}&utm_content={{ad.name}}|{{ad.id}}&utm_medium={{adset.name}}|{{adset.id}}&utm_term={{placement}}
```

| Parâmetro | Valor | Para que serve |
|---|---|---|
| `utm_source` | `FB` | Identifica que veio do Facebook/Meta |
| `utm_campaign` | `{{campaign.name}}` | Nome da campanha |
| `utm_content` | `{{ad.name}}\|{{ad.id}}` | Nome + ID do anúncio |
| `utm_medium` | `{{adset.name}}\|{{adset.id}}` | Nome + ID do conjunto |
| `utm_term` | `{{placement}}` | Posicionamento |

**O quiz oficial (`quiz-fotografo-protegido/index.html` e `quiz-blindagem/index.html`, função `buildCheckoutUrl()`) já converte esse UTM recebido na URL em `sck` compacto sozinho** na hora de montar o link de checkout que ele manda pro lead. Ou seja: se o anúncio aponta pro quiz, você não precisa se preocupar com o limite de 30 caracteres, o quiz resolve isso internamente antes de mandar pro Hotmart. Só um anúncio que aponta DIRETO pro checkout (sem passar pelo quiz) precisa do formato compacto do Caso A.

**Como o quiz monta o `sck` compacto (desde 2026-07-25):** prioriza o `ad.id` (vem em `utm_content`, formato `{{ad.name}}|{{ad.id}}`) sobre fonte/meio, porque só ele já é o dado mais valioso pra atribuição por criativo no Tracker, e cabe sozinho nos 30 caracteres. Manda o `sck` como o ID puro, sem separador nenhum (ex: `sck=120249167572420167`). O `hotmart-webhook` (e os scripts de sync/backfill) reconhecem um `sck` 100% numérico com 10+ dígitos como `meta_ad_id` direto. Só cai no fallback antigo (`fonte|meio`, que só preserva a fonte de verdade) quando não tem `ad.id` disponível.

### Onde configurar no Meta Ads

1. Gerenciador de Anúncios > editar anúncio
2. Campo "Parâmetros de URL" (fica na seção de destino, abaixo da URL)
3. Colar o template do Caso A ou B, conforme pra onde o anúncio aponta
4. O Meta valida automaticamente as variáveis dinâmicas ao salvar

### Resumo rápido pra decidir

- Anúncio aponta pro **checkout da Hotmart direto** → `sck=meta-ads` (Caso A)
- Anúncio aponta pro **quiz ou landing page própria** → UTM completo (Caso B), o resto é automático
