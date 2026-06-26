// Tracker FMN — Sincronização Meta Graph API
// Endpoint: POST /functions/v1/meta-sync
// Agendado via Supabase Cron Jobs (dashboard → Cron Jobs → a cada 6h)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_TOKEN    = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const AD_ACCOUNT_ID = Deno.env.get("FB_AD_ACCOUNT_ID")!;
const GRAPH_VERSION = "v25.0";
const GRAPH_BASE    = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Status que indicam anúncio ativo (rodando ou com histórico recente)
const STATUS_ATIVOS = [
  "fazendo-teste",
  "fazendo-recorrencia",
  "fazendo-producao",
  "feito-otimo",
  "feito-mediano",
];

function getPeriodos() {
  const hoje = new Date();
  const fmt  = (d: Date) => d.toISOString().split("T")[0];
  const diasAtras = (n: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - n);
    return fmt(d);
  };
  const hojeStr = fmt(hoje);
  return {
    maximum: { date_preset: "maximum" },
    "30d":   { since: diasAtras(29), until: hojeStr },
    "14d":   { since: diasAtras(13), until: hojeStr },
    "7d":    { since: diasAtras(6),  until: hojeStr },
    "5d":    { since: diasAtras(4),  until: hojeStr },
    "3d":    { since: diasAtras(2),  until: hojeStr },
    "hoje":  { since: hojeStr,       until: hojeStr },
  };
}

const CAMPOS_INSIGHTS = [
  "ad_id", "ad_name", "adset_id", "campaign_id", "campaign_name",
  "spend", "impressions", "clicks", "unique_inline_link_clicks",
  "cpm", "ctr", "frequency",
  "actions", "action_values",
  "video_p25_watched_actions", "video_p50_watched_actions",
  "video_thruplay_watched_actions",
  "date_start", "date_stop",
].join(",");

async function fetchInsights(adId: string, params: Record<string, string>) {
  const qs = new URLSearchParams({
    fields: CAMPOS_INSIGHTS,
    access_token: META_TOKEN,
    ...params,
  });
  const res  = await fetch(`${GRAPH_BASE}/${adId}/insights?${qs}`);
  const json = await res.json();
  return json?.data?.[0] || null;
}

function extrairAcao(data: any, tipo: string): number {
  return Number((data?.actions || []).find((a: any) => a.action_type === tipo)?.value || 0);
}

function extrairValorAcao(data: any, tipo: string): number {
  return Number((data?.action_values || []).find((a: any) => a.action_type === tipo)?.value || 0);
}

function calcularMetricas(raw: any) {
  const gasto      = Number(raw?.spend || 0);
  const impressoes = Number(raw?.impressions || 0);
  const linkClicks = Number(raw?.unique_inline_link_clicks || 0);
  const lpViews    = extrairAcao(raw, "landing_page_view");
  const compras    = extrairAcao(raw, "purchase");
  const valorComp  = extrairValorAcao(raw, "purchase");
  const addToCart  = extrairAcao(raw, "add_to_cart");
  const initCheck  = extrairAcao(raw, "initiate_checkout");
  const video3s    = Number(raw?.video_p25_watched_actions?.[0]?.value || 0);

  return {
    gasto,
    impressoes,
    cliques:             Number(raw?.clicks || 0),
    link_clicks:         linkClicks,
    landing_page_views:  lpViews,
    compras,
    valor_compras:       valorComp,
    add_to_cart:         addToCart,
    initiate_checkout:   initCheck,
    cpa:                 compras > 0 ? gasto / compras : null,
    roas:                gasto > 0 ? valorComp / gasto : null,
    ctr_unico:           impressoes > 0 ? linkClicks / impressoes : null,
    cpm:                 impressoes > 0 ? (gasto / impressoes) * 1000 : null,
    frequencia:          Number(raw?.frequency || 0) || null,
    connect_rate:        linkClicks > 0 ? lpViews / linkClicks : null,
    conv_pagina:         lpViews > 0 ? compras / lpViews : null,
    checkout_rate:       initCheck > 0 ? compras / initCheck : null,
    hook_rate:           impressoes > 0 ? video3s / impressoes : null,
  };
}

const LOTE = 20; // ADs por execução para não estourar limite de CPU

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Método não permitido", { status: 405 });
  }

  // Suporte a paginação via ?offset=N
  const url    = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  // Busca apenas ADS ativos com meta_ad_id cadastrado
  const { data: adsList, error: adsError } = await supabase
    .from("ads")
    .select("numero, meta_ad_id, status")
    .not("meta_ad_id", "is", null)
    .in("status", STATUS_ATIVOS)
    .range(offset, offset + LOTE - 1);

  if (adsError) {
    return new Response(JSON.stringify({ erro: adsError.message }), { status: 500 });
  }

  const periodos   = getPeriodos();
  const resultados: any[] = [];
  const erros:     any[] = [];

  for (const ads of adsList || []) {
    let gastoMaximum: number | null = null;

    for (const [nomePeriodo, params] of Object.entries(periodos)) {
      try {
        const raw = await fetchInsights(ads.meta_ad_id!, params as any);
        if (!raw) continue;

        const metricas = calcularMetricas(raw);

        // Guarda gasto do período maximum para atualizar ads.gasto_total
        if (nomePeriodo === "maximum") {
          gastoMaximum = metricas.gasto;
        }

        await supabase
          .from("insights_cache")
          .upsert({
            meta_ad_id:         ads.meta_ad_id,
            meta_ad_name:       raw.ad_name,
            meta_adset_id:      raw.adset_id,
            meta_campaign_id:   raw.campaign_id,
            meta_campaign_name: raw.campaign_name,
            periodo:            nomePeriodo,
            data_inicio:        raw.date_start || null,
            data_fim:           raw.date_stop  || null,
            status_meta:        ads.status,
            ...metricas,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: "meta_ad_id,periodo" });

        resultados.push({ ads_numero: ads.numero, periodo: nomePeriodo, cpa: metricas.cpa });
      } catch (err) {
        erros.push({ ads_numero: ads.numero, periodo: nomePeriodo, erro: String(err) });
      }
    }

    // Atualiza gasto_total na tabela ads com o período maximum
    // CPA histórico = gasto_total / vendas_total (calculado aqui e também pelo trigger de vendas)
    if (gastoMaximum !== null) {
      const { data: adsRow } = await supabase
        .from("ads")
        .select("vendas_total")
        .eq("numero", ads.numero)
        .single();

      const vendas = adsRow?.vendas_total || 0;
      const cpaHistorico = vendas > 0 ? gastoMaximum / vendas : null;

      await supabase
        .from("ads")
        .update({
          gasto_total:   gastoMaximum,
          cpa_historico: cpaHistorico,
        })
        .eq("numero", ads.numero);
    }
  }

  // Atualiza gasto_diario para hoje (nível de conta)
  await sincronizarGastoDiarioHoje();

  // Verifica regras ATP nos ADS sincronizados
  await verificarRegraG5();

  const temMais = (adsList?.length || 0) === LOTE;

  return new Response(
    JSON.stringify({
      ok:            true,
      sincronizados: resultados.length,
      erros:         erros.length,
      ads_lote:      adsList?.length || 0,
      offset_atual:  offset,
      proximo_offset: temMais ? offset + LOTE : null,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

async function sincronizarGastoDiarioHoje() {
  const hoje = new Date().toISOString().split("T")[0];
  const campos = "spend,impressions,clicks,actions";
  const qs = new URLSearchParams({
    fields: campos,
    time_range: JSON.stringify({ since: hoje, until: hoje }),
    access_token: META_TOKEN,
  });
  try {
    const res  = await fetch(`${GRAPH_BASE}/act_${AD_ACCOUNT_ID}/insights?${qs}`);
    const json = await res.json();
    const raw  = json?.data?.[0];
    if (!raw) return;

    const gasto       = Number(raw.spend || 0);
    const cliques     = Number(raw.clicks || 0);
    const compras     = Number((raw.actions || []).find((a: any) => a.action_type === "purchase")?.value || 0);
    const lpViews     = Number((raw.actions || []).find((a: any) => a.action_type === "landing_page_view")?.value || 0);
    const initCheck   = Number((raw.actions || []).find((a: any) => a.action_type === "initiate_checkout")?.value || 0);

    await supabase.from("gasto_diario").upsert({
      data: hoje,
      gasto,
      compras,
      cliques,
      lp_views: lpViews,
      initiate_checkout: initCheck,
    }, { onConflict: "data" });
  } catch (err) {
    console.error("Erro ao sincronizar gasto_diario:", String(err));
  }
}

async function verificarRegraG5() {
  const { data: regra } = await supabase
    .from("regras_atp")
    .select("parametros")
    .eq("codigo", "G5")
    .eq("ativo", true)
    .single();

  if (!regra) return;
  const cpaLimite = regra.parametros?.cpa_limite || 207.90;

  const { data: insights3d } = await supabase
    .from("insights_cache")
    .select("meta_ad_id, cpa")
    .eq("periodo", "3d")
    .not("cpa", "is", null);

  const { data: insights5d } = await supabase
    .from("insights_cache")
    .select("meta_ad_id, cpa")
    .eq("periodo", "5d")
    .not("cpa", "is", null);

  const map5d = Object.fromEntries((insights5d || []).map((r) => [r.meta_ad_id, r.cpa]));

  for (const i3d of insights3d || []) {
    const cpa3d = i3d.cpa;
    const cpa5d = map5d[i3d.meta_ad_id];
    if (!cpa5d || cpa3d < cpaLimite || cpa5d < cpaLimite) continue;

    const { data: alertaExistente } = await supabase
      .from("alertas")
      .select("id")
      .eq("meta_ad_id", i3d.meta_ad_id)
      .eq("regra_codigo", "G5")
      .eq("resolvido", false)
      .single();

    if (!alertaExistente) {
      const { data: adsRow } = await supabase
        .from("ads")
        .select("numero")
        .eq("meta_ad_id", i3d.meta_ad_id)
        .single();

      await supabase.from("alertas").insert({
        ads_numero:     adsRow?.numero || null,
        meta_ad_id:     i3d.meta_ad_id,
        regra_codigo:   "G5",
        mensagem:       `G5: CPA 3d R$${Number(cpa3d).toFixed(2)} e CPA 5d R$${Number(cpa5d).toFixed(2)} acima do limite R$${cpaLimite.toFixed(2)}.`,
        acao_tomada:    "alertado",
        dados_snapshot: { cpa3d, cpa5d, cpa_limite: cpaLimite },
      });
    }
  }
}
