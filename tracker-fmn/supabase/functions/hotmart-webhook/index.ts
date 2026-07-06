// Tracker FMN — Webhook Hotmart v4
// Cobre todos os 16 eventos configurados: compras, assinaturas, clube, logística, outros

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const HOTMART_TOKEN = Deno.env.get("HOTMART_WEBHOOK_TOKEN");

// Mapeamento de evento → status na tabela vendas
const STATUS_MAP: Record<string, string> = {
  // Compras
  PURCHASE_APPROVED:             "aprovada",
  PURCHASE_COMPLETE:             "aprovada",
  PURCHASE_REFUNDED:             "reembolsada",
  PURCHASE_CANCELED:             "cancelada",
  PURCHASE_EXPIRED:              "cancelada",
  PURCHASE_CHARGEBACK:           "chargeback",
  PURCHASE_PROTEST:              "protesto",
  PURCHASE_DELAYED:              "pendente",
  PURCHASE_ABANDONED:            "recuperacao",
  PURCHASE_OUT_OF_SHOPPING_CART: "recuperacao",
  // Assinaturas
  SUBSCRIPTION_CANCELLATION:     "cancelada",
  SUBSCRIPTION_REACTIVATED:      "aprovada",
  SUBSCRIPTION_ACTIVE:           "aprovada",
  // Clube
  CLUB_FIRST_ACCESS:             "aprovada",
  // Logística
  SHIPPING_COMPLETE:             "aprovada",
};

// Eventos que geram ou atualizam um registro em vendas
const EVENTOS_RELEVANTES = new Set(Object.keys(STATUS_MAP));

// Parser do source_sck da Hotmart (mesmo formato que sync_hotmart.py usa)
const SCK_SEP = "hQwK21wXxR";
const CLICK_ID_RE = /jLj6[a-zA-Z0-9]+/i;

function parseSck(sck: string) {
  if (!sck) return {};
  const parts = sck.split(SCK_SEP);
  const dec = (s: string) => s ? decodeURIComponent(s.replace(/\+/g, " ")).trim() : null;

  const rawSource = parts[0] || "";
  const m = CLICK_ID_RE.exec(rawSource);
  const utmSource   = m ? rawSource.slice(0, m.index).toLowerCase().trim() : rawSource.toLowerCase().trim();
  const utmMedium   = parts.length > 1 && parts[1] ? dec(parts[1]) : null;
  const utmCampaign = parts.length > 2 && parts[2] ? dec(parts[2]) : null;
  let   utmContent  = parts.length > 3 && parts[3] ? dec(parts[3]) : null;
  const utmTerm     = parts.length > 4 && parts[4] ? dec(parts[4]) : null;

  // Meta Ads: "ad_name|ad_id" em utm_content
  let metaAdId: string | null = null;
  if (utmContent && utmContent.includes("|")) {
    const idx = utmContent.lastIndexOf("|");
    const adId = utmContent.slice(idx + 1).trim();
    if (/^\d{10,}$/.test(adId)) {
      metaAdId  = adId;
      utmContent = utmContent.slice(0, idx).trim();
    }
  }
  // Limpar sufixo "|id" de medium e campaign também
  const cleanPipe = (s: string | null) => s && s.includes("|") ? s.split("|")[0].trim() : s;

  return {
    utm_source:   utmSource || null,
    utm_medium:   cleanPipe(utmMedium),
    utm_campaign: cleanPipe(utmCampaign),
    utm_content:  utmContent,
    utm_term:     utmTerm,
    meta_ad_id:   metaAdId,
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }

  // Validação de token (opcional — só ativa se HOTMART_WEBHOOK_TOKEN estiver configurado)
  const tokenRecebido = req.headers.get("X-Hotmart-Webhook-Token")
    || req.headers.get("x-hotmart-hottok");
  if (HOTMART_TOKEN && tokenRecebido !== HOTMART_TOKEN) {
    return new Response("Não autorizado", { status: 401 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response("Payload inválido", { status: 400 });
  }

  // Normaliza payload: Hotmart pode enviar formato wrapped ({event, data:{...}})
  // ou formato flat (buyer/product/purchase direto na raiz, sem campo event).
  // No formato flat, derivamos o evento a partir de purchase.status.
  const isWrapped = !!payload?.data;
  const root = isWrapped ? payload.data : payload;

  const STATUS_TO_EVENT: Record<string, string> = {
    APPROVED:   "PURCHASE_APPROVED",
    COMPLETE:   "PURCHASE_COMPLETE",
    CANCELED:   "PURCHASE_CANCELED",
    EXPIRED:    "PURCHASE_EXPIRED",
    REFUNDED:   "PURCHASE_REFUNDED",
    CHARGEBACK: "PURCHASE_CHARGEBACK",
    PROTEST:    "PURCHASE_PROTEST",
    DELAYED:    "PURCHASE_DELAYED",
    ABANDONED:  "PURCHASE_ABANDONED",
  };

  const evento: string = payload?.event
    || STATUS_TO_EVENT[(root?.purchase?.status || "").toUpperCase()]
    || "";

  console.log("Evento recebido:", evento, isWrapped ? "(wrapped)" : "(flat)");

  // Abandono de carrinho — salva em tabela própria
  if (evento === "PURCHASE_CART_ABANDONMENT") {
    const comprador = root?.buyer;
    const produto   = root?.product;
    const compra    = root?.purchase;
    const phoneCode = comprador?.checkout_phone_code || "";
    const phone     = comprador?.checkout_phone || comprador?.phone || "";
    const telefone  = phone ? (phoneCode ? `+55${phoneCode}${phone}` : phone) : null;
    const sckRaw    = compra?.origin?.sck || compra?.tracking?.source_sck || "";
    const sckP      = parseSck(sckRaw);
    await supabase.from("abandono_carrinho").insert({
      produto_nome:  produto?.name || null,
      produto_id:    produto?.id   ? String(produto.id) : null,
      oferta_codigo: compra?.offer?.code || null,
      nome:          comprador?.name  || null,
      email:         comprador?.email || null,
      telefone,
      documento:     comprador?.document || null,
      pais:          comprador?.address?.country_iso || "BR",
      sck:           sckRaw || null,
      utm_source:    sckP.utm_source   || null,
      utm_campaign:  sckP.utm_campaign || null,
      meta_ad_id:    sckP.meta_ad_id   || null,
      created_at:    compra?.order_date ? new Date(compra.order_date).toISOString() : new Date().toISOString(),
    });
    return new Response(JSON.stringify({ ok: true, evento }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ignorar eventos que não impactam vendas (logar para debug)
  if (!evento || !EVENTOS_RELEVANTES.has(evento)) {
    console.log("Evento ignorado:", evento);
    return new Response(JSON.stringify({ ignorado: true, evento }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // CLUB_FIRST_ACCESS: sem transação, sem buyer — apenas acesso ao clube já pago.
  // Não gera registro em vendas (a compra já foi salva via PURCHASE_APPROVED).
  if (evento === "CLUB_FIRST_ACCESS") {
    const user = root?.user;
    console.log("CLUB_FIRST_ACCESS ignorado (sem transação):", user?.email);
    return new Response(JSON.stringify({ ignorado: true, evento, email: user?.email }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const compra     = root?.purchase;
  const produto    = root?.product;
  const comprador  = root?.buyer;
  const assinatura = root?.subscription;
  const comissoes: any[] = root?.commissions || [];
  const afiliados: any[] = root?.affiliates  || [];

  // Transaction ID: vem em purchase.transaction ou subscription.subscriber.code
  const transactionId = compra?.transaction
    || assinatura?.subscriber?.code
    || root?.transaction;

  if (!transactionId) {
    console.error("Transaction ID ausente no payload:", JSON.stringify(payload));
    return new Response("Transaction ID ausente", { status: 400 });
  }

  // UTMs — Hotmart v2 envia o SCK em purchase.origin.sck (não em purchase.tracking)
  const tracking  = compra?.tracking_parameters || {};
  const sck = compra?.origin?.sck || compra?.tracking?.source_sck || compra?.tracking?.src || "";
  const sckParsed = parseSck(sck);

  const utmSource   = sckParsed.utm_source   || tracking.utm_source   || compra?.src || null;
  const utmCampaign = sckParsed.utm_campaign  || tracking.utm_campaign  || null;
  const utmMedium   = sckParsed.utm_medium    || tracking.utm_medium    || null;
  const utmContent  = sckParsed.utm_content   || tracking.utm_content   || null;
  const utmTerm     = sckParsed.utm_term      || tracking.utm_term      || null;

  // Atribuição Meta: utm_content traz "nome_ad|ad_id" quando configurado com {{ad.id}}
  let metaAdId = sckParsed.meta_ad_id || null;
  if (!metaAdId && utmContent && utmContent.includes("|")) {
    const parts = utmContent.split("|");
    const adId = parts[parts.length - 1].trim();
    if (/^\d{10,}$/.test(adId)) metaAdId = adId;
  }

  // Resolver ADS interno a partir do meta_ad_id
  let adsNumero: number | null = null;
  if (metaAdId) {
    const { data: adsRow } = await supabase
      .from("ads")
      .select("numero")
      .eq("meta_ad_id", metaAdId)
      .single();
    if (adsRow) adsNumero = adsRow.numero;
  }

  const status = STATUS_MAP[evento] || "pendente";

  // Valor bruto: purchase.price ou subscription
  const valorBruto = Number(compra?.price?.value || assinatura?.plan?.recurrency_period?.amount || 0);

  // Valor líquido: comissão do PRODUCER em data.commissions[]
  // (compra.commission.as_owner não existe no payload real da Hotmart v2)
  const comissaoProdutor = comissoes.find((c: any) => c.source === "PRODUCER");
  const valorLiquido = Number(comissaoProdutor?.value || compra?.price?.value || valorBruto);

  // preco_oferta: original_offer_price (sem juros de parcelamento) ou valor_bruto
  const precoOferta = Number(compra?.original_offer_price?.value || compra?.hotmart_fee?.base || valorBruto);

  // Valor do desconto de cupom: full_price (preço cheio antes do desconto) menos
  // price (o que foi de fato cobrado). 0 quando não houve desconto.
  const fullPriceVal = compra?.full_price?.value;
  const descontoCupom = (fullPriceVal != null && compra?.price?.value != null)
    ? Number(fullPriceVal) - Number(compra.price.value)
    : null;

  // Data real da compra (order_date em ms → ISO) para created_at correto
  const orderDateMs   = compra?.order_date    || compra?.approved_date;
  const approvedDateMs = compra?.approved_date || null;
  const hotmartOrderDate    = orderDateMs    ? new Date(Number(orderDateMs)).toISOString()    : null;
  const hotmartApprovedDate = approvedDateMs ? new Date(Number(approvedDateMs)).toISOString() : null;
  // created_at = data real da compra (não a data de chegada do webhook)
  const createdAt = hotmartOrderDate || new Date().toISOString();

  const { error } = await supabase.from("vendas").upsert(
    {
      hotmart_transaction_id: transactionId,
      hotmart_event:          evento,
      produto_id:             String(produto?.id || assinatura?.plan?.id || ""),
      produto_nome:           produto?.name || assinatura?.plan?.name || null,
      valor_bruto:            valorBruto,
      valor_liquido:          valorLiquido,
      status,
      metodo_pagamento:       compra?.payment?.type?.toLowerCase() || null,
      parcelas:               compra?.payment?.installments_number  || null,
      oferta_codigo:          compra?.offer?.code  || null,
      oferta_nome:            compra?.offer?.name  || null,
      is_order_bump:          compra?.order_bump?.is_order_bump ?? false,
      order_bump_parent_transaction: compra?.order_bump?.parent_purchase_transaction || null,
      desconto_cupom:         descontoCupom,
      utm_source:             utmSource,
      utm_campaign:           utmCampaign,
      utm_medium:             utmMedium,
      utm_content:            utmContent,
      utm_term:               utmTerm,
      meta_ad_id:             metaAdId,
      ads_numero:             adsNumero,
      comprador_pais:         comprador?.address?.country_iso || comprador?.locale?.country || "BR",
      comprador_estado:       comprador?.address?.state     || null,
      comprador_cidade:       comprador?.address?.city      || null,
      comprador_cep:          comprador?.address?.zipcode   || null,
      comprador_bairro:       comprador?.address?.neighborhood || null,
      comprador_end:          comprador?.address?.address   || null,
      comprador_numero:       comprador?.address?.number    || null,
      comprador_nome:         comprador?.name               || null,
      comprador_email:        comprador?.email              || null,
      comprador_telefone:     comprador?.checkout_phone || comprador?.phone || comprador?.mobile_phone || null,
      comprador_cpf:          comprador?.document || null,
      hotmart_fee:            compra?.hotmart_fee?.total ? Number(compra.hotmart_fee.total) : null,
      preco_oferta:           precoOferta,
      cupom_codigo:           compra?.coupon?.code || null,
      motivo_recusa:          compra?.card_decline_reason || compra?.payment?.card_decline_reason || null,
      produto_garantia:       produto?.warranty_date ? new Date(produto.warranty_date).toISOString() : null,
      afiliado_nome:          afiliados[0]?.name || null,
      afiliado_codigo:        afiliados[0]?.affiliate_code || null,
      is_assinatura:          !!assinatura,
      is_funil:               compra?.is_funnel ?? false,
      hotmart_order_date:     hotmartOrderDate,
      hotmart_approved_date:  hotmartApprovedDate,
      created_at:             createdAt,
      hotmart_raw:            payload,
    },
    { onConflict: "hotmart_transaction_id" }
  );

  if (error) {
    console.error("Erro ao salvar venda:", error.message, JSON.stringify(error));
    return new Response(JSON.stringify({ erro: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (adsNumero && status === "aprovada") {
    await verificarRegrasATP(adsNumero, metaAdId);
  }

  console.log("Venda salva:", transactionId, status, "ADS:", adsNumero);
  return new Response(
    JSON.stringify({ ok: true, transaction: transactionId, status, adsNumero }),
    { headers: { "Content-Type": "application/json" } }
  );
});

async function verificarRegrasATP(adsNumero: number, metaAdId: string | null) {
  const { data: regra } = await supabase
    .from("regras_atp")
    .select("parametros")
    .eq("codigo", "G5")
    .eq("ativo", true)
    .single();

  if (!regra || !metaAdId) return;

  const cpaLimite = regra.parametros?.cpa_limite || 207.90;

  const [{ data: i3d }, { data: i5d }] = await Promise.all([
    supabase.from("insights_cache").select("cpa").eq("meta_ad_id", metaAdId).eq("periodo", "3d").single(),
    supabase.from("insights_cache").select("cpa").eq("meta_ad_id", metaAdId).eq("periodo", "5d").single(),
  ]);

  const cpa3d = i3d?.cpa || null;
  const cpa5d = i5d?.cpa || null;

  if (cpa3d && cpa5d && cpa3d >= cpaLimite && cpa5d >= cpaLimite) {
    await supabase.from("alertas").insert({
      ads_numero:     adsNumero,
      meta_ad_id:     metaAdId,
      regra_codigo:   "G5",
      mensagem:       `G5 disparado. CPA 3d R$${cpa3d.toFixed(2)} e CPA 5d R$${cpa5d.toFixed(2)} ambos acima do limite R$${cpaLimite.toFixed(2)}.`,
      acao_tomada:    "alertado",
      dados_snapshot: { cpa3d, cpa5d, cpa_limite: cpaLimite },
    });
  }
}
