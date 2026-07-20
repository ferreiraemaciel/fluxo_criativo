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
import { classificarAd } from "../_shared/classificar.ts";
import { extrairCompras } from "../_shared/metricas.ts";

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

function dateRange(daysBack: number): { since: string; until: string } {
  const until = new Date();
  const since = new Date(until);
  since.setDate(until.getDate() - (daysBack - 1));
  return { since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10) };
}

// ── Sincroniza status com o Meta (fonte da verdade) ──────────────────────────
// Nunca mexe em titulo/tipo (conteúdo do criativo, não tem nada a ver com
// status) e nunca escreve um valor de `status` que não existe nas colunas do
// Kanban (fazer/fazendo/ativo/campeoes/testar-novamente/arquivado) — antes
// escrevia "pausado", que não é nenhuma delas, e o card sumia da visão.
// Só PROMOVE (fazer/fazendo → ativo); nunca rebaixa um card sozinho — isso
// continua sendo decisão manual (arrastar pra Testar novamente/Arquivados).
async function syncMetaAdStatus(): Promise<Set<number>> {
  // Sem filtro de effective_status: precisamos ver TODOS os estados (inclusive
  // PAUSED/ARCHIVED) pra reconciliar corretamente o meta_publish_status.
  const qs = new URLSearchParams({
    fields: "id,name,effective_status",
    limit: "500",
    access_token: FB_TOKEN,
  });
  let url: string | null = `${GRAPH_BASE}/act_${FB_ACCOUNT}/ads?${qs}`;
  const todos: any[] = [];
  while (url) {
    const resp = await graphGet(url);
    todos.push(...(resp.data || []));
    url = resp.paging?.next || null;
  }

  // Mapeia numero (extraído do nome "ADS N") → o status mais relevante achado
  // (prioriza ACTIVE se houver mais de um ad_id pro mesmo número — recorrência).
  const statusPorNumero: Record<number, string> = {};
  for (const d of todos) {
    const m = ADS_PATTERN.exec(d.name || "");
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (!statusPorNumero[num] || d.effective_status === "ACTIVE") {
      statusPorNumero[num] = d.effective_status;
    }
  }

  const AINDA_NAO_LIVRE = new Set(["PAUSED", "IN_PROCESS", "PENDING_REVIEW", "DISAPPROVED", "WITH_ISSUES"]);
  const SUMIU = new Set(["ARCHIVED", "DELETED"]);

  // Só reconcilia ads que a gente já conhece localmente (criados via o app,
  // que já grava meta_ad_id na criação) — evita reintroduzir o upsert cego
  // que criava linha nova incompleta (só numero/titulo/status/tipo).
  const { data: locais } = await supabase
    .from("ads")
    .select("numero, status, meta_publish_status, tag, vendas_total, cpa_historico, gasto_total")
    .not("meta_ad_id", "is", null)
    .limit(2000);

  const ativosDeVerdade = new Set<number>();

  for (const ad of locais || []) {
    const efStatus = statusPorNumero[ad.numero];
    if (!efStatus) continue; // não achado nesta varredura — não mexe

    if (efStatus === "ACTIVE") {
      ativosDeVerdade.add(ad.numero);
      const patch: Record<string, unknown> = {};
      if (ad.meta_publish_status !== "ativo") patch.meta_publish_status = "ativo";
      if (ad.status === "fazer" || ad.status === "fazendo") patch.status = "ativo";
      if (Object.keys(patch).length) {
        await supabase.from("ads").update(patch).eq("numero", ad.numero);
      }
    } else if (AINDA_NAO_LIVRE.has(efStatus)) {
      // Reconcilia "aguardando 1ª ativação" pra quem ainda está em
      // Fazer/Fazendo. Um anúncio já arquivado ou campeão fica PAUSED no Meta
      // o tempo todo por decisão do usuário — não é "pendente", é decidido.
      if ((ad.status === "fazer" || ad.status === "fazendo") && ad.meta_publish_status !== "rascunho") {
        await supabase.from("ads").update({ meta_publish_status: "rascunho" }).eq("numero", ad.numero);
      }
      // Anúncio que estava "Ativo" e foi pausado no Meta (decisão do usuário,
      // ex: pausou a campanha inteira) não pode ficar preso pra sempre na
      // coluna Ativos — ele não está rodando de verdade. Move pra Arquivados,
      // já com a etiqueta calculada a partir do histórico que já temos salvo.
      if (ad.status === "ativo") {
        const novaTag = classificarAd(ad.vendas_total, ad.cpa_historico, ad.gasto_total);
        await supabase.from("ads").update({ status: "arquivado", tag: novaTag }).eq("numero", ad.numero);
      }
    } else if (SUMIU.has(efStatus)) {
      const patch: Record<string, unknown> = {};
      if (ad.meta_publish_status !== null) {
        patch.meta_publish_status = null;
        patch.meta_ad_id = null;
        patch.meta_campaign_id = null;
        patch.meta_adset_id = null;
        patch.meta_ad_url = null;
      }
      // Mesma lógica do PAUSED: arquivado/deletado no Meta não pode ficar
      // preso em Ativos.
      if (ad.status === "ativo") {
        patch.status = "arquivado";
        patch.tag = classificarAd(ad.vendas_total, ad.cpa_historico, ad.gasto_total);
      }
      if (Object.keys(patch).length) {
        await supabase.from("ads").update(patch).eq("numero", ad.numero);
      }
    }
  }

  return ativosDeVerdade;
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
    } else if (status === "ativo") {
      // CORRIGIDO (2026-07-10): eu tinha entendido errado a regra. Um
      // anúncio em "Ativos" está rodando de verdade no Meta, gastando
      // dinheiro agora — não faz sentido mudar a coluna dele sozinho por
      // performance enquanto ele continua ativo (o usuário corrigiu isso ao
      // ver 4 anúncios ativos irem parar em Campeões/Arquivados). A saída de
      // Ativos só deveria acontecer JUNTO com o anúncio parar de rodar de
      // verdade no Meta — que é exatamente o que processar-pausas já faz
      // (pausa no Meta + reclassifica, as duas coisas juntas, hoje só
      // reativo ao alerta de CPA alto G5). Não fazer nada aqui.
    } else if (status === "campeoes") {
      const novaTag = classificarAd(vendas, cpa, gasto);
      if (novaTag !== "Ótimo") push("arquivado", novaTag, ad.numero);
      else if (tag !== "Ótimo") push("campeoes", "Ótimo", ad.numero);
    } else if (status === "arquivado") {
      // "Testar novamente" não é mais coluna própria (removida em 2026-07-10)
      // — é só uma etiqueta que convive com Mediano/Ruim dentro de Arquivados.
      // Só sai de Arquivados quando a tag calculada vira Ótimo (vai pra
      // Campeões); todo o resto (Mediano/Ruim/Testar novamente) fica aqui,
      // só atualizando a etiqueta.
      const novaTag = classificarAd(vendas, cpa, gasto);
      if (novaTag === "Ótimo") push("campeoes", "Ótimo", ad.numero);
      else if (novaTag !== tag) push("arquivado", novaTag, ad.numero);
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

// Trava contra duas execuções pesadas (scope=maximo) rodando ao mesmo tempo.
// Descoberto ao vivo: sem isso, execuções concorrentes se sobrescrevem numa
// mesma linha da tabela ads e a classificação pode decidir em cima de um
// valor intermediário. Trava expira sozinha em 10 min (caso a função caia
// no meio e nunca libere).
async function tentarTravar(): Promise<boolean> {
  const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("kanban_sync_lock")
    .update({ running_since: new Date().toISOString() })
    .eq("id", 1)
    .or(`running_since.is.null,running_since.lt.${limite}`)
    .select();
  return (data?.length ?? 0) > 0;
}
async function destravar() {
  await supabase.from("kanban_sync_lock").update({ running_since: null }).eq("id", 1);
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Método não permitido", { status: 405 });
  }
  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope");
  const scope = scopeParam === "maximo" ? "maximo" : scopeParam === "completo" ? "completo" : "curtas";

  // scope=completo: recalcula TODOS os anúncios já cadastrados (ativos ou
  // não), não só os ativos agora. Corrige o histórico congelado de anúncios
  // que já saíram do ar antes da fórmula de venda ser unificada (ver
  // _shared/metricas.ts) — sem isso, um anúncio arquivado fica com o número
  // errado pra sempre, porque a varredura diária (scope=maximo) só atualiza
  // quem está ativo agora. Rodar manualmente quando precisar recalcular tudo
  // de uma vez; não é agendado (o diário continua só nos ativos).
  if (scope === "completo") {
    if (!(await tentarTravar())) {
      return new Response(JSON.stringify({ ok: true, scope, aviso: "já tem uma varredura rodando, pulei esta" }),
        { headers: { "Content-Type": "application/json" } });
    }
    try {
      const rowsMax = await fetchAccountAdInsights({ date_preset: "maximum" });
      const agg: Record<number, { gasto: number; vendas: number }> = {};
      for (const d of rowsMax) {
        const nome = d.ad_name || "";
        const m = ADS_PATTERN.exec(nome);
        if (!m) continue;
        const num = parseInt(m[1], 10);
        const gasto = Number(d.spend || 0);
        const vendas = extrairCompras(d);
        const slot = agg[num] || (agg[num] = { gasto: 0, vendas: 0 });
        slot.gasto += gasto;
        slot.vendas += vendas;
      }

      let ok = 0;
      for (const [numStr, slot] of Object.entries(agg)) {
        const num = Number(numStr);
        const payload: Record<string, unknown> = {
          gasto_total: Math.round(slot.gasto * 100) / 100,
          vendas_total: slot.vendas,
          cpa_historico: slot.vendas > 0 ? Math.round((slot.gasto / slot.vendas) * 100) / 100 : null,
        };
        const { error } = await supabase.from("ads").update(payload).eq("numero", num);
        if (!error) ok++;
      }

      const regras = await aplicarRegrasKanban();
      return new Response(JSON.stringify({ ok: true, scope, ads_encontrados: Object.keys(agg).length, agregados: ok, regras }),
        { headers: { "Content-Type": "application/json" } });
    } finally {
      await destravar();
    }
  }

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
        const vendas = extrairCompras(d);
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
    // scope=maximo: varredura de vida inteira (pesada) + reclassificação do Kanban.
    // Trava: se já tiver uma execução rodando, não faz nada (evita corromper
    // os agregados com uma escrita concorrente — ver comentário da trava acima).
    if (!(await tentarTravar())) {
      return new Response(JSON.stringify({ ok: true, scope, aviso: "já tem uma varredura rodando, pulei esta" }),
        { headers: { "Content-Type": "application/json" } });
    }

    try {
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
      const vendas = extrairCompras(d);
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
    } finally {
      await destravar();
    }
  }
});
