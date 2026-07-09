// Tracker FMN — Hotmart Backfill (plano B do webhook em tempo real)
//
// Substitui o worker Cloudflare hotmart-sync, que ficava recebendo 400 da
// Hotmart (suspeita: WAF/anti-bot reagindo ao Workers). Mesma lógica, rodando
// como Supabase Edge Function — a mesma tecnologia que o hotmart-webhook já
// usa com sucesso pra falar com a API da Hotmart.
//
// O que faz, nessa ordem:
//   1. Busca vendas dos últimos 2 dias na Hotmart (sales/history).
//   2. Insere só as que o webhook em tempo real ainda não processou
//      (nunca sobrescreve uma venda que já tem dono).
//   3. Pra cada venda inserida, ou pra qualquer venda aprovada sem telefone/
//      estado (rede de segurança pros ~200 dias mais recentes), busca os
//      dados do comprador (sales/users?transaction=) e completa.
//
// Agendado via pg_cron a cada 15 min, mas só roda das 06h às 23:59 Brasília
// (madrugada não tem venda pra recuperar, não vale gastar chamada à API).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const HOTMART_CLIENT_ID     = Deno.env.get("HOTMART_CLIENT_ID")!;
const HOTMART_CLIENT_SECRET = Deno.env.get("HOTMART_CLIENT_SECRET")!;

const STATUS_MAP: Record<string, string> = {
  APPROVED: "aprovada", CANCELLED: "cancelada", REFUNDED: "reembolso",
  CHARGEBACK: "chargeback", PENDING: "pendente", OVERDUE: "atrasada",
  BLOCKED: "bloqueada", PRE_ORDER: "pre_aprovada", REFUSED: "recusada",
  EXPIRED: "expirada", COMPLETE: "aprovada", PRINTED_BILLET: "pendente",
  WAITING_PAYMENT: "pendente",
};

// BRT = UTC-3 fixo (Brasil não observa horário de verão desde 2019).
function horaBrasilia(): number {
  return (new Date().getUTCHours() - 3 + 24) % 24;
}

async function hotmartToken(): Promise<string> {
  const creds = btoa(`${HOTMART_CLIENT_ID}:${HOTMART_CLIENT_SECRET}`);
  const res = await fetch("https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials", {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
  });
  if (!res.ok) throw new Error(`Hotmart auth falhou: ${res.status}`);
  const { access_token } = await res.json();
  return access_token;
}

async function fetchAllSales(token: string, fromMs: number, toMs: number) {
  const all: any[] = [];
  let pageToken: string | null = null;
  do {
    let url = `https://developers.hotmart.com/payments/api/v1/sales/history?start_date=${fromMs}&end_date=${toMs}&max_results=500`;
    if (pageToken) url += `&page_token=${pageToken}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`sales/history falhou: ${res.status} — ${body.slice(0, 300)}`);
    }
    const body = await res.json();
    all.push(...(body.items || []));
    pageToken = body.page_info?.next_page_token || null;
  } while (pageToken);
  return all;
}

// Telefone + endereço por transação. sales/history não traz isso — só
// sales/users?transaction= tem (o endpoint sales/users/details, mais antigo,
// devolve 200 vazio, não usar).
async function buscarDadosComprador(token: string, transactionId: string) {
  try {
    const res = await fetch(
      `https://developers.hotmart.com/payments/api/v1/sales/users?transaction=${transactionId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    for (const item of data?.items || []) {
      for (const u of item.users || []) {
        if (u.role !== "BUYER") continue;
        const buyer = u.user || {};
        const addr = buyer.address || {};
        return {
          telefone: buyer.cellphone || buyer.phone || null,
          estado:   addr.state || null,
          cidade:   addr.city || null,
          pais:     addr.country || null,
          cep:      addr.zip_code || null,
          bairro:   addr.neighborhood || null,
          endereco: addr.address || null,
          numero:   addr.number || null,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

function mapToVenda(item: any) {
  const { buyer, purchase, product } = item;
  const statusRaw = purchase?.status || "";
  const status = STATUS_MAP[statusRaw] || statusRaw.toLowerCase();
  const toISO = (ms?: number) => (ms ? new Date(ms).toISOString() : null);
  const mp = purchase?.payment?.method || null;
  const methodClean = mp
    ? mp.replace("CREDIT_CARD_", "Cartão ").replace("DEBIT_CARD", "Débito").replace("BILLET", "Boleto").replace("PIX", "Pix").replace("_", " ")
    : null;

  return {
    hotmart_transaction_id: purchase?.transaction,
    hotmart_event: `SYNC_CLOUD_${statusRaw || status}`,
    produto_id: String(product?.id || ""),
    produto_nome: product?.name || null,
    status,
    valor_bruto: purchase?.price?.value ?? null,
    valor_liquido:
      purchase?.price?.value != null && purchase?.hotmart_fee?.total != null
        ? Math.round((purchase.price.value - purchase.hotmart_fee.total) * 100) / 100
        : null,
    hotmart_fee: purchase?.hotmart_fee?.total ?? null,
    preco_oferta: purchase?.hotmart_fee?.base ?? null,
    metodo_pagamento: methodClean,
    parcelas: purchase?.payment?.installments_number ?? null,
    oferta_codigo: purchase?.offer?.code ?? null,
    is_assinatura: purchase?.is_subscription ?? false,
    is_funil: false,
    is_order_bump: false,
    comprador_nome: buyer?.name || null,
    comprador_email: buyer?.email || null,
    hotmart_order_date: toISO(purchase?.order_date),
    hotmart_approved_date: toISO(purchase?.approved_date),
    hotmart_raw: item,
  };
}

async function transacoesExistentes(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const { data, error } = await supabase
    .from("vendas")
    .select("hotmart_transaction_id")
    .in("hotmart_transaction_id", ids);
  if (error) {
    console.error("transacoesExistentes erro:", error.message);
    return new Set();
  }
  return new Set((data || []).map((r) => r.hotmart_transaction_id));
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  if (!force) {
    const hora = horaBrasilia();
    if (hora < 6) {
      return new Response(JSON.stringify({ ok: true, skip: `Fora da janela (${hora}h Brasília, madrugada).` }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  try {
    const token = await hotmartToken();
    const now = Date.now();
    const from = now - 2 * 24 * 60 * 60 * 1000; // 48h

    const items = await fetchAllSales(token, from, now);
    const vendas = items.map(mapToVenda).filter((v) => v.hotmart_transaction_id);
    const existentes = await transacoesExistentes(vendas.map((v) => v.hotmart_transaction_id));
    const faltantes = vendas.filter((v) => !existentes.has(v.hotmart_transaction_id));

    // Enriquece telefone/estado das que estão sendo inseridas agora.
    for (const v of faltantes) {
      const dados = await buscarDadosComprador(token, v.hotmart_transaction_id);
      if (dados) {
        if (dados.telefone) (v as any).comprador_telefone = dados.telefone;
        if (dados.estado)   (v as any).comprador_estado   = dados.estado;
        if (dados.cidade)   (v as any).comprador_cidade   = dados.cidade;
        if (dados.pais)     (v as any).comprador_pais     = dados.pais;
        if (dados.cep)      (v as any).comprador_cep      = dados.cep;
        if (dados.bairro)   (v as any).comprador_bairro   = dados.bairro;
        if (dados.endereco) (v as any).comprador_end      = dados.endereco;
        if (dados.numero)   (v as any).comprador_numero   = dados.numero;
      }
    }

    let inseridas = 0;
    if (faltantes.length) {
      const { error } = await supabase
        .from("vendas")
        .upsert(faltantes, { onConflict: "hotmart_transaction_id" });
      if (error) console.error("upsert faltantes erro:", error.message);
      else inseridas = faltantes.length;
    }

    // Rede de segurança: vendas aprovadas recentes (qualquer origem, inclusive
    // webhook em tempo real) que ainda ficaram sem telefone/estado.
    const { data: pendentes } = await supabase
      .from("vendas")
      .select("hotmart_transaction_id")
      .eq("status", "aprovada")
      .or("comprador_telefone.is.null,comprador_estado.is.null")
      .order("created_at", { ascending: false })
      .limit(30);

    let enriquecidas = 0;
    for (const p of pendentes || []) {
      const dados = await buscarDadosComprador(token, p.hotmart_transaction_id);
      if (!dados) continue;
      const patch: Record<string, any> = {};
      if (dados.telefone) patch.comprador_telefone = dados.telefone;
      if (dados.estado)   patch.comprador_estado   = dados.estado;
      if (dados.cidade)   patch.comprador_cidade   = dados.cidade;
      if (dados.pais)     patch.comprador_pais     = dados.pais;
      if (dados.cep)      patch.comprador_cep      = dados.cep;
      if (dados.bairro)   patch.comprador_bairro   = dados.bairro;
      if (dados.endereco) patch.comprador_end      = dados.endereco;
      if (dados.numero)   patch.comprador_numero   = dados.numero;
      if (!Object.keys(patch).length) continue;
      const { error } = await supabase.from("vendas").update(patch).eq("hotmart_transaction_id", p.hotmart_transaction_id);
      if (!error) enriquecidas++;
    }

    return new Response(
      JSON.stringify({ ok: true, retornadas: items.length, inseridas, enriquecidas }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[hotmart-backfill] erro:", e.message);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
