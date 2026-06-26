# UTM Template — Tracker FMN

## Parâmetros de URL padrão (colar em todo anúncio Meta)

```
utm_source=FB&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_medium=paid
```

### O que cada parâmetro faz

| Parâmetro | Valor | Para que serve |
|---|---|---|
| `utm_source` | `FB` | Identifica que veio do Facebook/Meta |
| `utm_campaign` | `{{campaign.name}}` | Nome da campanha (preenchido automaticamente pelo Meta) |
| `utm_content` | `{{ad.id}}` | ID único do anúncio — é isso que vincula a venda ao ADS no banco |
| `utm_medium` | `paid` | Identifica tráfego pago |

### Regra importante

O `{{ad.id}}` é o campo crítico. Sem ele o webhook da Hotmart não consegue
saber qual ADS gerou a venda. Sempre confirmar que está presente antes de
publicar qualquer anúncio.

### Onde configurar no Meta Ads

1. Gerenciador de Anúncios > editar anúncio
2. Campo "Parâmetros de URL" (fica na seção de destino, abaixo da URL)
3. Colar o template acima
4. O Meta valida automaticamente as variáveis dinâmicas ao salvar
