/**
 * Cloudflare Worker — Hotmart Sync
 * Roda todo dia às 09:00 horário de Brasília (12:00 UTC)
 * Busca vendas das últimas 48h na Hotmart e faz upsert no Supabase.
 */

const STATUS_MAP = {
  APPROVED:      'aprovada',
  CANCELLED:     'cancelada',
  REFUNDED:      'reembolso',
  CHARGEBACK:    'chargeback',
  PENDING:       'pendente',
  OVERDUE:       'atrasada',
  BLOCKED:       'bloqueada',
  PRE_ORDER:     'pre_aprovada',
  REFUSED:       'recusada',
  EXPIRED:       'expirada',
  COMPLETE:      'aprovada',
  PRINTED_BILLET: 'pendente',
  WAITING_PAYMENT: 'pendente',
};

async function getHotmartToken(env) {
  const res = await fetch(
    'https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials',
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(`${env.HOTMART_CLIENT_ID}:${env.HOTMART_CLIENT_SECRET}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
  if (!res.ok) throw new Error(`Hotmart auth falhou: ${res.status}`);
  const { access_token } = await res.json();
  return access_token;
}

async function fetchAllSales(token, fromMs, toMs) {
  const all = [];
  let pageToken = null;

  do {
    let url = `https://developers.hotmart.com/payments/api/v1/sales/history?start_date=${fromMs}&end_date=${toMs}&max_results=500`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Hotmart sales/history falhou: ${res.status} — ${body.slice(0,300)} — URL: ${url}`);
    }

    const body = await res.json();
    const items = body.items || [];
    all.push(...items);

    pageToken = body.page_info?.next_page_token || null;
  } while (pageToken);

  return all;
}

function mapToVenda(item) {
  const { buyer, purchase, product } = item;

  const statusRaw = purchase?.status || '';
  const status = STATUS_MAP[statusRaw] || statusRaw.toLowerCase();

  const orderDateMs  = purchase?.order_date;
  const approvedMs   = purchase?.approved_date;
  const toISO = ms => ms ? new Date(ms).toISOString() : null;

  const mp = purchase?.payment?.method || null;
  const methodClean = mp
    ? mp.replace('CREDIT_CARD_', 'Cartão ').replace('DEBIT_CARD', 'Débito').replace('BILLET', 'Boleto').replace('PIX', 'Pix').replace('_', ' ')
    : null;

  const tracking = purchase?.tracking || {};

  return {
    hotmart_transaction_id: purchase?.transaction,
    hotmart_event: status === 'aprovada' ? 'PURCHASE_APPROVED' : `PURCHASE_${statusRaw}`,
    produto_id:    String(product?.id || ''),
    produto_nome:  product?.name || null,
    status,
    valor_bruto:   purchase?.price?.value ?? null,
    valor_liquido: purchase?.price?.value != null && purchase?.hotmart_fee?.total != null
                    ? Math.round((purchase.price.value - purchase.hotmart_fee.total) * 100) / 100
                    : null,
    hotmart_fee:   purchase?.hotmart_fee?.total ?? null,
    preco_oferta:  purchase?.hotmart_fee?.base ?? null,
    metodo_pagamento: methodClean,
    parcelas:      purchase?.payment?.installments_number ?? null,
    oferta_codigo: purchase?.offer?.code ?? null,
    is_assinatura: purchase?.is_subscription ?? false,
    is_funil:      false,
    is_order_bump: false,
    comprador_nome:  buyer?.name || null,
    comprador_email: buyer?.email || null,
    hotmart_order_date:    toISO(orderDateMs),
    hotmart_approved_date: toISO(approvedMs),
    hotmart_raw: JSON.stringify(item),
  };
}

async function upsertVendas(env, vendas) {
  if (!vendas.length) return { inserted: 0, updated: 0 };

  const LOTE = 100;
  let count = 0;

  for (let i = 0; i < vendas.length; i += LOTE) {
    const lote = vendas.slice(i, i + LOTE);

    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/vendas`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        // merge-duplicates: atualiza status/valores se a transação já existir
        Prefer: 'return=minimal,resolution=merge-duplicates',
      },
      body: JSON.stringify(lote),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Lote ${i / LOTE + 1} falhou (${res.status}): ${err.slice(0, 300)}`);
    } else {
      count += lote.length;
    }
  }

  return count;
}

async function run(env) {
  const now = Date.now();
  const from = now - 48 * 60 * 60 * 1000; // 48h atrás

  console.log(`[hotmart-sync] Rodando. Janela: ${new Date(from).toISOString()} → ${new Date(now).toISOString()}`);

  const token = await getHotmartToken(env);
  const items = await fetchAllSales(token, from, now);

  console.log(`[hotmart-sync] ${items.length} vendas retornadas pela API`);

  if (!items.length) {
    return { ok: true, message: 'Nenhuma venda no período.' };
  }

  const vendas = items.map(mapToVenda).filter(v => v.hotmart_transaction_id);
  const count  = await upsertVendas(env, vendas);

  const msg = `${count} vendas sincronizadas (${items.length} retornadas pela API)`;
  console.log(`[hotmart-sync] ✅ ${msg}`);
  return { ok: true, message: msg };
}

export default {
  // Cron trigger: roda às 12:00 UTC = 09:00 Brasília
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env));
  },

  // HTTP trigger: permite chamar manualmente via GET /sync
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/sync') {
      try {
        const result = await run(env);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err) {
        console.error('[hotmart-sync] Erro:', err.message, err.stack);
        return new Response(JSON.stringify({ ok: false, error: err.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response(JSON.stringify({ ok: true, status: 'hotmart-sync worker online', secrets_loaded: { hotmart: !!env.HOTMART_CLIENT_ID, supabase: !!env.SUPABASE_URL } }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};
