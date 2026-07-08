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

// Busca telefone + endereço por transação (endpoint /sales/users, diferente
// do /sales/history usado no resto do worker — esse aqui TEM esses dados).
// Uma chamada só resolve telefone e geo (mapa de vendas), em vez de duas.
async function buscarDadosCompradorHotmart(token, transactionId) {
  try {
    const res = await fetch(`https://developers.hotmart.com/payments/api/v1/sales/users?transaction=${transactionId}`,
      { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return {};
    const data = await res.json();
    const items = data?.items || [];
    for (const item of items) {
      for (const u of item.users || []) {
        if (u.role !== 'BUYER') continue;
        const buyer = u.user || {};
        const phone = buyer.cellphone || buyer.phone;
        const addr  = buyer.address || {};
        return {
          telefone:  phone ? String(phone).trim() : null,
          estado:    addr.state          || null,
          cidade:    addr.city           || null,
          cep:       addr.zip_code       || null,
          bairro:    addr.neighborhood   || null,
          endereco:  addr.address        || null,
          numero:    addr.number         || null,
        };
      }
    }
    return {};
  } catch (e) {
    console.error(`[hotmart-sync] buscarDadosCompradorHotmart(${transactionId}) erro:`, e.message);
    return {};
  }
}

// Fallback: WhatsApp que o comprador preencheu no quiz (casando por email).
async function buscarWhatsappQuiz(env, email) {
  if (!email) return null;
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/quiz_leads?email=ilike.${encodeURIComponent(email)}&whatsapp=not.is.null&select=whatsapp&limit=1`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    );
    if (!res.ok) return null;
    const rows = await res.json();
    return rows?.[0]?.whatsapp ? String(rows[0].whatsapp).trim() : null;
  } catch {
    return null;
  }
}

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

// Mesmo parser do webhook (hotmart-webhook/index.ts). A API de histórico
// quase nunca traz tracking, mas quando traz (purchase.tracking.source_sck),
// vale a pena aproveitar em vez de descartar.
const SCK_SEP = 'hQwK21wXxR';
const CLICK_ID_RE = /jLj6[a-zA-Z0-9]+/i;
function parseSck(sck) {
  if (!sck) return {};
  const parts = sck.split(SCK_SEP);
  const dec = s => s ? decodeURIComponent(s.replace(/\+/g, ' ')).trim() : null;

  const rawSource = parts[0] || '';
  const m = CLICK_ID_RE.exec(rawSource);
  const utmSource   = m ? rawSource.slice(0, m.index).toLowerCase().trim() : rawSource.toLowerCase().trim();
  const utmMedium   = parts.length > 1 && parts[1] ? dec(parts[1]) : null;
  const utmCampaign = parts.length > 2 && parts[2] ? dec(parts[2]) : null;
  let   utmContent  = parts.length > 3 && parts[3] ? dec(parts[3]) : null;
  const utmTerm     = parts.length > 4 && parts[4] ? dec(parts[4]) : null;

  let metaAdId = null;
  if (utmContent && utmContent.includes('|')) {
    const idx = utmContent.lastIndexOf('|');
    const adId = utmContent.slice(idx + 1).trim();
    if (/^\d{10,}$/.test(adId)) { metaAdId = adId; utmContent = utmContent.slice(0, idx).trim(); }
  }
  const cleanPipe = s => s && s.includes('|') ? s.split('|')[0].trim() : s;

  return {
    utm_source:   utmSource || null,
    utm_medium:   cleanPipe(utmMedium),
    utm_campaign: cleanPipe(utmCampaign),
    utm_content:  utmContent,
    utm_term:     utmTerm,
    meta_ad_id:   metaAdId,
  };
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

  // Raríssimo a API de histórico trazer isso, mas quando traz, aproveita.
  const sck = purchase?.tracking?.source_sck || purchase?.tracking?.external_code || '';
  const sckParsed = parseSck(sck);

  return {
    hotmart_transaction_id: purchase?.transaction,
    // Prefixo SYNC_ (não PURCHASE_) — deixa explícito que essa linha veio do
    // backfill (o webhook em tempo real não processou essa venda), pro
    // dashboard não confundir "sem rastreio por falha" com "venda direta".
    hotmart_event: `SYNC_${statusRaw || status}`,
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
    utm_source:   sckParsed.utm_source   || null,
    utm_medium:   sckParsed.utm_medium   || null,
    utm_campaign: sckParsed.utm_campaign || null,
    utm_content:  sckParsed.utm_content  || null,
    utm_term:     sckParsed.utm_term     || null,
    meta_ad_id:   sckParsed.meta_ad_id   || null,
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

// IDs de transação já existentes na tabela (o webhook em tempo real já
// processou). Esse worker é só um plano B pra venda que o webhook perdeu —
// nunca deve tocar numa linha que já tem dono, pra não arriscar sobrescrever
// atribuição correta com o payload mais pobre da API de histórico.
async function transacoesExistentes(env, transactionIds) {
  if (!transactionIds.length) return new Set();
  const ids = transactionIds.map(id => `"${id}"`).join(',');
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/vendas?hotmart_transaction_id=in.(${ids})&select=hotmart_transaction_id`,
    { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
  );
  if (!res.ok) {
    console.error(`[hotmart-sync] Falha ao checar transações existentes (${res.status})`);
    return new Set();
  }
  const rows = await res.json();
  return new Set(rows.map(r => r.hotmart_transaction_id));
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
  const existentes = await transacoesExistentes(env, vendas.map(v => v.hotmart_transaction_id));
  const faltantes = vendas.filter(v => !existentes.has(v.hotmart_transaction_id));

  // Resolve ads_numero a partir do meta_ad_id (igual o webhook faz) — sem
  // isso o card "Últimas Vendas" mostra a campanha/conjunto em vez do
  // criativo específico que vendeu.
  const metaAdIds = [...new Set(faltantes.map(v => v.meta_ad_id).filter(Boolean))];
  if (metaAdIds.length) {
    const ids = metaAdIds.map(id => `"${id}"`).join(',');
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/ads?meta_ad_id=in.(${ids})&select=numero,meta_ad_id`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } }
    );
    if (res.ok) {
      const numeroPorMetaId = Object.fromEntries((await res.json()).map(a => [a.meta_ad_id, a.numero]));
      for (const v of faltantes) {
        if (v.meta_ad_id && numeroPorMetaId[v.meta_ad_id] != null) v.ads_numero = numeroPorMetaId[v.meta_ad_id];
      }
    } else {
      console.error(`[hotmart-sync] Falha ao resolver ads_numero (${res.status})`);
    }
  }

  console.log(`[hotmart-sync] ${existentes.size} já processadas pelo webhook (ignoradas), ${faltantes.length} realmente faltando`);

  if (!faltantes.length) {
    return { ok: true, message: `0 vendas faltando (${items.length} retornadas, todas já cobertas pelo webhook)` };
  }

  // Telefone + geo: /sales/history (usado acima) não traz nem um nem outro.
  // Busca por transação em /sales/users (tem os dois) e, se o telefone não
  // vier, cai no WhatsApp do quiz — mesmo fallback do webhook em tempo real.
  // Sem isso a venda fica sem estado/cidade e some do mapa de vendas.
  for (const v of faltantes) {
    const dados = await buscarDadosCompradorHotmart(token, v.hotmart_transaction_id);
    let telefone = dados.telefone;
    if (!telefone) telefone = await buscarWhatsappQuiz(env, v.comprador_email);
    if (telefone) v.comprador_telefone = telefone;
    if (dados.estado)   v.comprador_estado   = dados.estado;
    if (dados.cidade)   v.comprador_cidade   = dados.cidade;
    if (dados.cep)      v.comprador_cep      = dados.cep;
    if (dados.bairro)   v.comprador_bairro   = dados.bairro;
    if (dados.endereco) v.comprador_end      = dados.endereco;
    if (dados.numero)   v.comprador_numero   = dados.numero;
  }

  const count = await upsertVendas(env, faltantes);

  const msg = `${count} vendas recuperadas via backfill (o webhook não processou a tempo) — ${items.length} retornadas no total pela API`;
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
