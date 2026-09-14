// Tracker FMN — métricas dos anúncios desativados, direto do Meta.
// Endpoint: POST /functions/v1/trafego-desativados  { campanhas: ["id", ...] }
//
// Por que existe (14/09/2026): o insights_cache só guarda anúncio ATIVO. Quando
// um anúncio para, o meta-sync apaga as janelas curtas dele (reconciliarAnunciosParados),
// então o botão "Mostrar desativados" da aba Tráfego mostrava a linha só com traço.
// O Felipe precisa ver quanto o desativado gastou e como ele ia, pra entender por
// que parou. Esta função lê o Meta na hora, só quando o botão é ligado, e devolve
// as linhas no mesmo formato do insights_cache, com as mesmas janelas e o mesmo
// cálculo do meta-sync. Não grava nada.
//
// Uma chamada por campanha e por janela (level=ad), não uma por anúncio.

import { extrairCompras, extrairValorCompras } from "../_shared/metricas.ts";
import { portao } from "../_shared/portao.ts";

const META_TOKEN = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const GRAPH_BASE = "https://graph.facebook.com/v25.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Mesmas janelas do meta-sync (getPeriodosCurtos), em horário de Brasília.
function janelas(): Record<string, Record<string, string>> {
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  const atras = (n: number) => { const d = new Date(hoje + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const tr = (since: string) => ({ time_range: JSON.stringify({ since, until: hoje }) });
  return { hoje: tr(hoje), "3d": tr(atras(2)), "5d": tr(atras(4)), "7d": tr(atras(6)), maximum: { date_preset: "maximum" } };
}

const CAMPOS = [
  "ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name",
  "spend", "impressions", "clicks", "unique_inline_link_clicks", "frequency",
  "actions", "action_values", "video_p25_watched_actions", "date_start", "date_stop",
].join(",");

const acao = (raw: any, tipo: string) => Number((raw?.actions || []).find((a: any) => a.action_type === tipo)?.value || 0);

// Mesmo cálculo do calcularMetricas do meta-sync, nos campos que a aba Tráfego lê.
function linha(raw: any, periodo: string) {
  const gasto = Number(raw.spend || 0);
  const impressoes = Number(raw.impressions || 0);
  const linkClicks = Number(raw.unique_inline_link_clicks || 0);
  const lp = acao(raw, "landing_page_view");
  const compras = extrairCompras(raw);
  const valor = extrairValorCompras(raw);
  const video3s = Number(raw?.video_p25_watched_actions?.[0]?.value || 0);
  return {
    meta_ad_id: raw.ad_id, meta_ad_name: raw.ad_name,
    meta_campaign_id: raw.campaign_id, meta_campaign_name: raw.campaign_name,
    meta_adset_id: raw.adset_id, meta_adset_name: raw.adset_name,
    periodo, data_inicio: raw.date_start || null, data_fim: raw.date_stop || null,
    gasto, impressoes, compras,
    link_clicks: linkClicks, landing_page_views: lp,
    initiate_checkout: acao(raw, "initiate_checkout"),
    cpa: compras > 0 ? gasto / compras : null,
    roas: gasto > 0 ? valor / gasto : null,
    ctr_unico: impressoes > 0 ? linkClicks / impressoes : null,
    cpm: impressoes > 0 ? (gasto / impressoes) * 1000 : null,
    frequencia: Number(raw.frequency || 0) || null,
    connect_rate: linkClicks > 0 ? lp / linkClicks : null,
    hook_rate: impressoes > 0 ? video3s / impressoes : null,
  };
}

async function insightsDaCampanha(campanha: string, periodo: string, params: Record<string, string>) {
  const saida: any[] = [];
  let url = `${GRAPH_BASE}/${campanha}/insights?` + new URLSearchParams({
    level: "ad", fields: CAMPOS, limit: "200", access_token: META_TOKEN, ...params,
  });
  while (url) {
    const j = await (await fetch(url)).json();
    if (j.error) throw new Error(`Meta (${periodo}): ${j.error.message}`);
    for (const raw of j.data || []) if (Number(raw.spend || 0) > 0) saida.push(linha(raw, periodo));
    url = j.paging?.next || "";
  }
  return saida;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const recusa = await portao(req, { usuario: true, cabecalhos: cors });
  if (recusa) return recusa;

  try {
    const body = await req.json().catch(() => ({}));
    const campanhas: string[] = (Array.isArray(body.campanhas) ? body.campanhas : [])
      .filter((c: unknown) => typeof c === "string" && /^\d+$/.test(c)).slice(0, 20);
    if (!campanhas.length) return json({ linhas: [] });

    const js = janelas();
    const tarefas = campanhas.flatMap((c) => Object.entries(js).map(([p, params]) => insightsDaCampanha(c, p, params)));
    const linhas = (await Promise.all(tarefas)).flat();
    return json({ linhas, gerado_em: new Date().toISOString() });
  } catch (e) {
    return json({ erro: String((e as Error)?.message || e) }, 500);
  }
});
