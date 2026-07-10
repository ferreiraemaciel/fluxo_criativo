// Tracker FMN — Sincronização Meta Graph API
// Endpoint: POST /functions/v1/meta-sync?scope=curtas|maximo
// Agendado via pg_cron: "curtas" a cada 6h, "maximo" 1x/dia de madrugada (ver migração 044).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extrairCompras, extrairValorCompras } from "../_shared/metricas.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_TOKEN    = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const AD_ACCOUNT_ID = Deno.env.get("FB_AD_ACCOUNT_ID")!;
const GRAPH_VERSION = "v25.0";
const GRAPH_BASE    = `https://graph.facebook.com/${GRAPH_VERSION}`;

// BRT = UTC-3 (Brasil não observa horário de verão desde 2019)
function hojeBrt(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split("T")[0];
}

function getPeriodosCurtos() {
  const hojeStr = hojeBrt();
  const diasAtras = (n: number) => {
    const d = new Date(hojeStr + "T00:00:00Z");
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
  };
  return {
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
  // O Meta ignora "since"/"until" soltos neste endpoint (sempre devolve a
  // mesma janela default). Precisa ir embrulhado em time_range (igual o
  // sync_insights.py já fazia). date_preset continua indo solto (esse funciona).
  const { since, until, ...rest } = params;
  const finalParams: Record<string, string> = { ...rest };
  if (since && until) {
    finalParams.time_range = JSON.stringify({ since, until });
  }
  const qs = new URLSearchParams({
    fields: CAMPOS_INSIGHTS,
    access_token: META_TOKEN,
    ...finalParams,
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
  const compras    = extrairCompras(raw);
  const valorComp  = extrairValorCompras(raw);
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

// Busca no Meta (fonte da verdade, não no status interno do Kanban) os anúncios
// ativos ou em revisão. Evita a divergência de vocabulário entre o Kanban (que já
// mudou de "fazendo-teste"/"feito-otimo" para "ativo"/"campeoes"/"fazendo"/"fazer")
// e o status usado aqui — sem isso, o filtro por status do Kanban silenciosamente
// não encontra nenhum anúncio.
async function fetchAdsAtivosNoMeta(): Promise<{ id: string; name: string }[]> {
  const ativos: { id: string; name: string }[] = [];
  let url = `${GRAPH_BASE}/act_${AD_ACCOUNT_ID}/ads?` + new URLSearchParams({
    fields: "id,name,effective_status",
    effective_status: JSON.stringify(["ACTIVE", "IN_PROCESS", "PENDING_REVIEW"]),
    limit: "500",
    access_token: META_TOKEN,
  });
  while (url) {
    const res  = await fetch(url);
    const json = await res.json();
    for (const d of json?.data || []) {
      ativos.push({ id: d.id, name: d.name });
    }
    url = json?.paging?.next || "";
  }
  return ativos;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Método não permitido", { status: 405 });
  }

  const url   = new URL(req.url);
  const scope = url.searchParams.get("scope") === "maximo" ? "maximo" : "curtas";

  const adsAtivos = await fetchAdsAtivosNoMeta();

  // Mapeia meta_ad_id → numero (para atualizar a tabela ads); ignora se o
  // anúncio ainda não está cadastrado localmente (não é responsabilidade
  // desta função criar ADs novos, isso é feito pelo sync local do Kanban).
  const { data: adsCadastrados } = await supabase
    .from("ads")
    .select("numero, meta_ad_id")
    .not("meta_ad_id", "is", null);
  const numeroPorMetaId = Object.fromEntries(
    (adsCadastrados || []).map((a) => [a.meta_ad_id, a.numero])
  );

  const resultados: any[] = [];
  const erros:      any[] = [];

  if (scope === "curtas") {
    const periodos = getPeriodosCurtos();

    for (const ad of adsAtivos) {
      const numero = numeroPorMetaId[ad.id] ?? null;

      for (const [nomePeriodo, params] of Object.entries(periodos)) {
        try {
          const raw = await fetchInsights(ad.id, params as any);
          if (!raw) continue;

          const metricas = calcularMetricas(raw);

          await supabase
            .from("insights_cache")
            .upsert({
              meta_ad_id:         ad.id,
              meta_ad_name:       raw.ad_name,
              meta_adset_id:      raw.adset_id,
              meta_campaign_id:   raw.campaign_id,
              meta_campaign_name: raw.campaign_name,
              periodo:            nomePeriodo,
              data_inicio:        raw.date_start || null,
              data_fim:           raw.date_stop  || null,
              status_meta:        "ativo",
              ...metricas,
              atualizado_em: new Date().toISOString(),
            }, { onConflict: "meta_ad_id,periodo" });

          resultados.push({ ads_numero: numero, periodo: nomePeriodo, cpa: metricas.cpa });
        } catch (err) {
          erros.push({ ads_numero: numero, periodo: nomePeriodo, erro: String(err) });
        }
      }
    }

    await sincronizarGastoDiarioHoje();
    await verificarRegraG5();
  } else {
    // scope=maximo: só o período de vida inteira, 1x/dia. Atualiza também
    // gasto_total/cpa_historico na tabela ads (usado no Ranking de ADS).
    for (const ad of adsAtivos) {
      const numero = numeroPorMetaId[ad.id] ?? null;
      try {
        const raw = await fetchInsights(ad.id, { date_preset: "maximum" });
        if (!raw) continue;

        const metricas = calcularMetricas(raw);

        await supabase
          .from("insights_cache")
          .upsert({
            meta_ad_id:         ad.id,
            meta_ad_name:       raw.ad_name,
            meta_adset_id:      raw.adset_id,
            meta_campaign_id:   raw.campaign_id,
            meta_campaign_name: raw.campaign_name,
            periodo:            "maximum",
            data_inicio:        raw.date_start || null,
            data_fim:           raw.date_stop  || null,
            status_meta:        "ativo",
            ...metricas,
            atualizado_em: new Date().toISOString(),
          }, { onConflict: "meta_ad_id,periodo" });

        resultados.push({ ads_numero: numero, periodo: "maximum", cpa: metricas.cpa });

        if (numero !== null) {
          const { data: adsRow } = await supabase
            .from("ads")
            .select("vendas_total")
            .eq("numero", numero)
            .single();

          const vendas = adsRow?.vendas_total || 0;
          const cpaHistorico = vendas > 0 ? metricas.gasto / vendas : null;

          await supabase
            .from("ads")
            .update({ gasto_total: metricas.gasto, cpa_historico: cpaHistorico })
            .eq("numero", numero);
        }
      } catch (err) {
        erros.push({ ads_numero: numero, periodo: "maximum", erro: String(err) });
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok:            true,
      scope,
      ads_encontrados: adsAtivos.length,
      sincronizados: resultados.length,
      erros:         erros.length,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

async function sincronizarGastoDiarioHoje() {
  const hoje = hojeBrt();
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
