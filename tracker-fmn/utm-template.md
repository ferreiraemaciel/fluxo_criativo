# UTM Template — Tracker FMN

> **Atualizado em 2026-07-13.** Antes dessa data, o template único abaixo era colado em TODO anúncio, inclusive nos que iam direto pro checkout da Hotmart. Isso causava vendas rastreadas aparecendo como "Direto" no Tracker, porque a Hotmart não lê `utm_*` soltos no link de pagamento, só o parâmetro próprio dela (`sck`). Ver o achado completo na sessão de 2026-07-13 (auditoria "Últimas Vendas" mostrando Andressa Bastos e Maryellen Bonini com UTM completo no quiz_leads mas "Direto" na venda).

## Qual template usar depende do destino do anúncio

### Caso A — Destino é direto pro checkout da Hotmart (`pay.hotmart.com/...`)

A Hotmart **nunca lê `utm_source`/`utm_campaign`/etc. soltos** num link de checkout. Ela só lê o parâmetro `sck`, e ele tem **limite de 30 caracteres no total**, campos separados por `|` (fonte oficial: [Central de Ajuda Hotmart](https://help.hotmart.com/pt-br/article/216441797/como-identificar-a-origem-das-minhas-vendas-na-hotmart-)).

**Cole isso no campo "Parâmetros de URL" do Meta:**

```
sck=meta-ads
```

Se quiser separar por conjunto de anúncios ou campanha (cabe pouco, calcule os 30 caracteres):

```
sck={{fonte-curta}}|{{meio-curto}}
```

Exemplo real: `sck=meta|paid` (12 caracteres, sobra espaço).

**Não dá pra rastrear `ad.id` individual assim** (o ID sozinho já tem 15-18 dígitos, estoura os 30 caracteres). Pra granularidade de anúncio específico, só via integração nativa da Hotmart com o Pixel do Meta (rastreio automático que já funciona sozinho quando o anúncio aponta direto pro checkout e o pixel da Hotmart detecta o clique — foi assim que a venda do "Elízio" em 10/07 ficou corretamente atribuída a `meta_ad_id`, sem UTM manual nenhum).

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

**O quiz oficial (`quiz-fotografo-protegido/index.html`, função `buildCheckoutUrl()`) já converte esse UTM recebido na URL em `sck` compacto sozinho** na hora de montar o link de checkout que ele manda pro lead. Ou seja: se o anúncio aponta pro quiz, você não precisa se preocupar com o limite de 30 caracteres, o quiz resolve isso internamente antes de mandar pro Hotmart. Só um anúncio que aponta DIRETO pro checkout (sem passar pelo quiz) precisa do formato compacto do Caso A.

### Onde configurar no Meta Ads

1. Gerenciador de Anúncios > editar anúncio
2. Campo "Parâmetros de URL" (fica na seção de destino, abaixo da URL)
3. Colar o template do Caso A ou B, conforme pra onde o anúncio aponta
4. O Meta valida automaticamente as variáveis dinâmicas ao salvar

### Resumo rápido pra decidir

- Anúncio aponta pro **checkout da Hotmart direto** → `sck=meta-ads` (Caso A)
- Anúncio aponta pro **quiz ou landing page própria** → UTM completo (Caso B), o resto é automático
