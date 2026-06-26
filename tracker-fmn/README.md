# Tracker FMN

App de rastreamento de anúncios e gestão financeira da Fotografia é o Meu Negócio.
Substitui a UTMify com integração nativa Meta + Hotmart + regras ATP automáticas.

## Arquitetura

```
Meta Graph API → meta-sync (Edge Function) → insights_cache (Supabase)
Hotmart webhook → hotmart-webhook (Edge Function) → vendas (Supabase)
                                                    ↓
                                        Dashboard (Lovable/React)
```

## Stack

- **Frontend**: React + Tailwind (gerado no Lovable)
- **Backend**: Supabase (banco PostgreSQL + Edge Functions Deno)
- **Meta Ads**: Graph API v25.0 via token permanente do Sistema de Usuário
- **Hotmart**: webhook postback com UTMs

## Estrutura de pastas

```
tracker-fmn/
├── supabase/
│   ├── schema.sql                          ← rodar no SQL Editor do Supabase
│   └── functions/
│       ├── hotmart-webhook/index.ts        ← recebe vendas da Hotmart
│       └── meta-sync/index.ts             ← sincroniza métricas do Meta
└── README.md
```

## Setup inicial

### 1. Criar projeto no Supabase
- Acesse supabase.com e crie um novo projeto
- Copie a URL e a Service Role Key

### 2. Rodar o schema
- No Supabase: SQL Editor → colar o conteúdo de `supabase/schema.sql` → Run

### 3. Configurar variáveis de ambiente nas Edge Functions
No Supabase > Edge Functions > Secrets, adicionar:
```
FB_ACCESS_TOKEN_PERMANENTE = (token do .env)
FB_AD_ACCOUNT_ID           = 551241914600634
HOTMART_WEBHOOK_TOKEN      = (gerar um token aleatório forte)
```

### 4. Deploy das Edge Functions
```bash
supabase functions deploy hotmart-webhook
supabase functions deploy meta-sync
```

### 5. Configurar webhook na Hotmart
- Hotmart > Ferramentas > Webhooks
- URL: https://{seu-projeto}.supabase.co/functions/v1/hotmart-webhook
- Token: o mesmo valor de HOTMART_WEBHOOK_TOKEN
- Eventos: PURCHASE_APPROVED, PURCHASE_REFUNDED, PURCHASE_CANCELED

### 6. Configurar UTM nos anúncios do Meta
No Gerenciador de Anúncios, campo "Parâmetros de URL":
```
utm_source=FB&utm_campaign={{campaign.name}}&utm_content={{ad.id}}&utm_medium=paid
```
O `{{ad.id}}` é o que vincula a venda ao ADS no banco.

### 7. Sincronização automática do Meta
Para rodar `meta-sync` todo dia às 8h, ativar pg_cron no Supabase:
```sql
select cron.schedule(
  'meta-sync-diario',
  '0 8 * * *',
  $$select net.http_post(
    url:='https://{projeto}.supabase.co/functions/v1/meta-sync',
    headers:='{"Authorization": "Bearer {SERVICE_ROLE_KEY}"}'::jsonb
  )$$
);
```

## Tabelas principais

| Tabela | Função |
|---|---|
| `ads` | Criativos do Kanban com copy completa |
| `vendas` | Compras recebidas via webhook Hotmart |
| `insights_cache` | Métricas Meta por período (3d, 5d, máximo) |
| `campanhas` | Visão consolidada por campanha |
| `despesas` | Controle de gastos operacionais |
| `impostos` | Taxas Meta (12,15%) e Hotmart |
| `produtos` | Catálogo com ticket e custo |
| `regras_atp` | Configuração das regras G1-G7 + E1 |
| `alertas` | Log de regras disparadas |
| `configuracoes` | Token Meta, CPA limite, integrações |

## Regras ATP configuradas

| Código | Regra | Ação |
|---|---|---|
| G1 | Gasto ≥ 1× ticket sem venda | Pausa |
| G2 | CPA histórico crítico por 3 dias | Pausa |
| G3 | Acumulação antes de atualizar Notion | Acumular |
| G4 | Frequência > 3.5 com CPA piorando | Alerta |
| G5 | CPA 3d E CPA 5d acima de R$207,90 | Pausa |
| G6 | Connect rate < 60% por 3 dias | Alerta técnico |
| G7 | Após ação, atualizar status | Sincronizar |
| E1 | ADS RMKT isento de G6 | Isenção |
