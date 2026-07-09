// Tracker FMN — Sincronização de status/agregados do Kanban com o Meta (nuvem)
// Endpoint: POST /functions/v1/kanban-sync?scope=curtas|maximo
// Porta para a nuvem o que era scripts/sync_insights.py + scripts/aplicar_regras.py
// no Mac (2026-07-05), para o painel não depender do Mac estar ligado.
//
// scope=curtas (mais frequente): sincroniza ads.status com o Meta (fonte da
// verdade), atualiza agregados 3d/5d/hoje por ADS e os permalinks.
// scope=maximo (menos frequente, é a varredura pesada de conta inteira):
// atualiza agregados de vida inteira (gasto_total/vendas_total/cpa_historico)
// e em seguida aplica as regras de classificação do Kanban (aplicar_regras).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const FB_TOKEN   = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const FB_ACCOUNT = Deno.env.get("FB_AD_ACCOUNT_ID")!;
const GRAPH_BASE = "https://graph.facebook.com/v21.0";

const ADS_PATTERN = /ADS\s*0*(\d+)/i;
const CLEAN_TITLE_RE = /^.*?ADS\s*0*\d+\s*[-–]?\s*/i;

async function graphGet(url: string): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url);
    if (res.ok) return await res.json();
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code || 0;
    if ([17, 4, 32, 613].includes(code)) {
      const wait = 15000 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Graph API erro: ${JSON.stringify(body)}`);
  }
  throw new Error("Falhou após 4 tentativas (rate limit)");
}

async function fetchAccountAdInsights(params: Record<string, string>): Promise<any[]> {
  const qs = new URLSearchParams({
    level: "ad",
    fields: "ad_id,ad_name,adset_id,campaign_id,spend,actions,action_values,impressions,clicks",
    limit: "500",
    access_token: FB_TOKEN,
    ...params,
  });
  let url: string | null = `${GRAPH_BASE}/act_${FB_ACCOUNT}/insights?${qs}`;
  const rows: any[] = [];
  while (url) {
    const resp = await graphGet(url);
    rows.push(...(resp.data || []));
    url = resp.paging?.next || null;
  }
  return rows;
}

function extractMetric(d: any, actionType: string): number {
  return Number((d.actions || []).find((a: any) => a.action_type === actionType)?.value || 0);
}
function extractValue(d: any, actionType: string): number {
  return Number((d.action_values || []).find((a: any) => a.action_type === actionType)?.value || 0);
}
function purchasesOf(d: any): number {
  return extractMetric(d, "purchase") || extractMetric(d, "offsite_conversion.fb_pixel_purchase");
}
function purchaseValueOf(d: any): number {
  return extractValue(d, "purchase") || extractValue(d, "offsite_conversion.fb_pixel_purchase");
}

function dateRange(daysBack: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until);
  since.setDate(until.getDate() - (daysBack - 1));
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

// ── Sincroniza ads.status com o Meta (fonte da verdade) ──────────────────────
async function syncMetaAdStatus(): Promise<Set<number>> {
  const qs = new URLSearchParams({
    fields: "id,name,effective_status",
    // Só ACTIVE conta como "ativo" de verdade. PENDING_REVIEW e IN_PROCESS acontecem
    // mesmo com o anúncio PAUSADO (revisão de criativo roda independente do estado),
    // e marcavam o card como ativo no Tracker antes do usuário confirmar em "Ativar tudo".
    effective_status: JSON.stringify(["ACTIVE"]),
    limit: "500",
    access_token: FB_TOKEN,
  });
  let url: string | null = `${GRAPH_BASE}/act_${FB_ACCOUNT}/ads?${qs}`;
  const metaAtivos: any[] = [];
  while (url) {
    const resp = await graphGet(url);
    metaAtivos.push(...(resp.data || []));
    url = resp.paging?.next || null;
  }

  const novos: Record<number, any> = {};
  for (const d of metaAtivos) {
    const nome = d.name || "";
    const m = ADS_PATTERN.exec(nome);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (novos[num]) continue;
    const clean = nome.replace(CLEAN_TITLE_RE, "").trim() || nome;
    novos[num] = { numero: num, meta_ad_id: d.id, titulo: clean, status: "ativo", tipo: "reels" };
  }

  if (Object.keys(novos).length > 0) {
    await supabase.from("ads").upsert(Object.values(novos), { onConflict: "numero" });
  }

  const numsAtivos = new Set(Object.keys(novos).map(Number));

  const { data: ativosLocais } = await supabase
    .from("ads").select("numero, meta_ad_id").eq("status", "ativo").limit(2000);
  for (const a of ativosLocais || []) {
    if (!numsAtivos.has(a.numero)) {
      await supabase.from("ads").update({ status: "pausado" }).eq("numero", a.numero);
    }
  }

  return numsAtivos;
}

// ── Permalinks ────────────────────────────────────────────────────────────────
async function fetchAdPermalink(metaAdId: string): Promise<string | null> {
  try {
    const url = `https://graph.facebook.com/v25.0/${metaAdId}?fields=creative%7Beffective_object_story_id%7D&access_token=${FB_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    const storyId = data?.creative?.effective_object_story_id;
    if (!storyId || !storyId.includes("_")) return null;
    const [pageId, postId] = storyId.split("_");
    return `https://www.facebook.com/permalink/story?story_fbid=${postId}&id=${pageId}`;
  } catch {
    return null;
  }
}

// ── Regras de classificação do Kanban (espelho de classifyAd() no kanban.jsx) ─
const TICKET_VAL = 297.0;
const GASTO_MIN_TEST = 145.53;

function classificarAd(vendas: number | null, cpa: number | null, gasto: number | null): string {
  const v = vendas || 0;
  const g = gasto || 0;
  const c = cpa != null ? cpa : (v > 0 && g > 0 ? g / v : null);
  if (v === 0) return g >= GASTO_MIN_TEST ? "Testar novamente" : "Ruim";
  if (v >= 5 && (c === null || c < TICKET_VAL)) return "Ótimo";
  return "Mediano";
}

async function aplicarRegrasKanban() {
  const { data: ads } = await supabase
    .from("ads")
    .select("numero, status, tag, vendas_total, cpa_historico, gasto_total, media_files, media_drive_url")
    .limit(1000);

  const batches = new Map<string, number[]>();
  const push = (status: string, tag: string | null, num: number) => {
    const key = `${status}::${tag ?? ""}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key)!.push(num);
  };

  for (const ad of ads || []) {
    const status = ad.status || "fazer";
    const tag = ad.tag;
    const vendas = ad.vendas_total;
    const cpa = ad.cpa_historico;
    const gasto = ad.gasto_total;

    let hasMedia = false;
    try {
      const mf = ad.media_files;
      const files = Array.isArray(mf) ? mf : JSON.parse(mf || "[]");
      hasMedia = files.length > 0 || !!ad.media_drive_url;
    } catch {
      hasMedia = !!ad.media_drive_url;
    }

    if (status === "fazer" && hasMedia) {
      push("fazendo", null, ad.numero);
    } else if (status === "campeoes") {
      const novaTag = classificarAd(vendas, cpa, gasto);
      if (novaTag !== "Ótimo") push("arquivado", novaTag, ad.numero);
      else if (tag !== "Ótimo") push("campeoes", "Ótimo", ad.numero);
    } else if (status === "testar-novamente") {
      const novaTag = classificarAd(vendas, cpa, gasto);
      if (novaTag !== "Testar novamente") push("arquivado", novaTag, ad.numero);
      else if (tag !== "Testar novamente") push("testar-novamente", "Testar novamente", ad.numero);
    } else if (status === "arquivado") {
      const novaTag = classificarAd(vendas, cpa, gasto);
      if (novaTag !== tag) push("arquivado", novaTag, ad.numero);
    }
  }

  let alterados = 0;
  for (const [key, numeros] of batches) {
    const [status, tag] = key.split("::");
    const payload: Record<string, unknown> = { status };
    if (tag) payload.tag = tag;
    await supabase.from("ads").update(payload).in("numero", numeros);
    alterados += numeros.length;
  }
  return { alterados, lotes: batches.size };
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Método não permitido", { status: 405 });
  }
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") === "maximo" ? "maximo" : "curtas";

  const targetNums = await syncMetaAdStatus();
  if (targetNums.size === 0) {
    return new Response(JSON.stringify({ ok: true, scope, aviso: "nenhum ad ativo no Meta" }),
      { headers: { "Content-Type": "application/json" } });
  }

  if (scope === "curtas") {
    const { since: since3d, until: until3d } = dateRange(3);
    const { since: since5d, until: until5d } = dateRange(5);

    const rows3d = await fetchAccountAdInsights({ time_range: JSON.stringify({ since: since3d, until: until3d }) });
    const rows5d = await fetchAccountAdInsights({ time_range: JSON.stringify({ since: since5d, until: until5d }) });
    const rowsHoje = await fetchAccountAdInsights({ date_preset: "today" });

    const agg: Record<number, { g3d: number; v3d: number; g5d: number; v5d: number }> = {};
    const bestAdId: Record<number, [string, number]> = {};

    const accumulate = (rows: any[], key: "3d" | "5d", trackBest: boolean) => {
      for (const d of rows) {
        const nome = d.ad_name || "";
        const m = ADS_PATTERN.exec(nome);
        if (!m) continue;
        const num = parseInt(m[1], 10);
        if (!targetNums.has(num)) continue;
        const gasto = Number(d.spend || 0);
        const vendas = purchasesOf(d);
        const slot = agg[num] || (agg[num] = { g3d: 0, v3d: 0, g5d: 0, v5d: 0 });
        if (key === "3d") { slot.g3d += gasto; slot.v3d += vendas; }
        else { slot.g5d += gasto; slot.v5d += vendas; }
        if (trackBest && gasto > 0) {
          const cur = bestAdId[num];
          if (!cur || gasto > cur[1]) bestAdId[num] = [d.ad_id, gasto];
        }
      }
    };
    accumulate(rows3d, "3d", true);
    accumulate(rows5d, "5d", true);
    void rowsHoje; // hoje já é coberto pela edge function meta-sync (insights_cache); aqui só serve de sinal de vida

    let ok = 0;
    for (const [numStr, slot] of Object.entries(agg)) {
      const num = Number(numStr);
      const payload: Record<string, unknown> = {
        gasto_3d: Math.round(slot.g3d * 100) / 100,
        vendas_3d: slot.v3d,
        cpa_3d: slot.v3d > 0 ? Math.round((slot.g3d / slot.v3d) * 100) / 100 : null,
        gasto_5d: Math.round(slot.g5d * 100) / 100,
        vendas_5d: slot.v5d,
        cpa_5d: slot.v5d > 0 ? Math.round((slot.g5d / slot.v5d) * 100) / 100 : null,
      };
      if (bestAdId[num]) payload.meta_ad_id = bestAdId[num][0];
      const { error } = await supabase.from("ads").update(payload).eq("numero", num);
      if (!error) ok++;
    }

    let permalinksOk = 0;
    for (const [numStr, [metaAdId]] of Object.entries(bestAdId)) {
      const permalink = await fetchAdPermalink(metaAdId);
      if (permalink) {
        await supabase.from("ads").update({ meta_ad_url: permalink }).eq("numero", Number(numStr));
        permalinksOk++;
      }
    }

    return new Response(JSON.stringify({ ok: true, scope, ads_ativos: targetNums.size, agregados_3d5d: ok, permalinks: permalinksOk }),
      { headers: { "Content-Type": "application/json" } });
  } else {
    // scope=maximo: varredura de vida inteira (pesada) + reclassificação do Kanban
    const rowsMax = await fetchAccountAdInsights({ date_preset: "maximum" });

    const agg: Record<number, { gasto: number; vendas: number }> = {};
    const bestAdId: Record<number, [string, number]> = {};
    for (const d of rowsMax) {
      const nome = d.ad_name || "";
      const m = ADS_PATTERN.exec(nome);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      if (!targetNums.has(num)) continue;
      const gasto = Number(d.spend || 0);
      const vendas = purchasesOf(d);
      const slot = agg[num] || (agg[num] = { gasto: 0, vendas: 0 });
      slot.gasto += gasto;
      slot.vendas += vendas;
      if (gasto > 0) {
        const cur = bestAdId[num];
        if (!cur || gasto > cur[1]) bestAdId[num] = [d.ad_id, gasto];
      }
    }

    let ok = 0;
    for (const [numStr, slot] of Object.entries(agg)) {
      const num = Number(numStr);
      const payload: Record<string, unknown> = {
        gasto_total: Math.round(slot.gasto * 100) / 100,
        vendas_total: slot.vendas,
        cpa_historico: slot.vendas > 0 ? Math.round((slot.gasto / slot.vendas) * 100) / 100 : null,
      };
      if (bestAdId[num]) payload.meta_ad_id = bestAdId[num][0];
      const { error } = await supabase.from("ads").update(payload).eq("numero", num);
      if (!error) ok++;
    }

    const regras = await aplicarRegrasKanban();

    return new Response(JSON.stringify({ ok: true, scope, ads_ativos: targetNums.size, agregados_maximo: ok, regras }),
      { headers: { "Content-Type": "application/json" } });
  }
});
