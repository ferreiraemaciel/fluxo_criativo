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
  // adset_id/campaign_id entraram em 2026-08-25 pra viabilizar a "via de volta":
  // anúncio criado direto no Gerenciador do Meta (nomeado "ADS N - título",
  // pra um número já reservado no Tracker) agora é adotado automaticamente,
  // sem precisar ter nascido pelo botão Publicar do Tracker.
  const qs = new URLSearchParams({
    fields: "id,name,effective_status,adset_id,campaign_id",
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
  // (prioriza ACTIVE se houver mais de um ad_id pro mesmo número — recorrência),
  // e guarda junto o id/adset/campanha desse ad — precisa disso pra "adotar"
  // um ad criado direto no Gerenciador (ver `adotarPorNumero` abaixo).
  const statusPorNumero: Record<number, string> = {};
  const adPorNumero: Record<number, { id: string; adset_id?: string; campaign_id?: string }> = {};
  for (const d of todos) {
    const m = ADS_PATTERN.exec(d.name || "");
    if (!m) continue;
    const num = parseInt(m[1], 10);
    if (!statusPorNumero[num] || d.effective_status === "ACTIVE") {
      statusPorNumero[num] = d.effective_status;
      adPorNumero[num] = { id: d.id, adset_id: d.adset_id, campaign_id: d.campaign_id };
    }
  }

  const AINDA_NAO_LIVRE = new Set(["PAUSED", "IN_PROCESS", "PENDING_REVIEW", "DISAPPROVED", "WITH_ISSUES"]);
  const SUMIU = new Set(["ARCHIVED", "DELETED"]);

  // Reconcilia todo card que já existe localmente — inclusive quem ainda não
  // tem `meta_ad_id` (card criado no Tracker só pra reservar o número, ou
  // esperando ser "adotado" por um ad publicado direto no Gerenciador). Nunca
  // cria linha nova sozinho: isso continua proibido (evita reintroduzir o
  // upsert cego que já causou card incompleto no passado), o número sempre
  // precisa já existir como card no Tracker antes.
  const { data: locais } = await supabase
    .from("ads")
    .select("numero, status, meta_publish_status, tag, meta_ad_id, vendas_total, cpa_historico, gasto_total")
    .limit(2000);

  const ativosDeVerdade = new Set<number>();

  for (const ad of locais || []) {
    const efStatus = statusPorNumero[ad.numero];
    if (!efStatus) continue; // não achado nesta varredura — não mexe

    if (efStatus === "ACTIVE") {
      ativosDeVerdade.add(ad.numero);
      const patch: Record<string, unknown> = {};

      // Adoção: card existe no Tracker (número reservado) mas nunca foi
      // publicado por aqui — foi criado direto no Gerenciador do Meta, com o
      // nome "ADS N - título" apontando pra esse mesmo número. Vincula pela
      // primeira vez, incluindo o permalink (mesma chamada que o fluxo normal
      // de publicação usa). Combinado com Felipe em 2026-08-25: via de volta,
      // Meta → Tracker, simétrica à que já existe de Tracker → Meta.
      if (!ad.meta_ad_id) {
        const metaAd = adPorNumero[ad.numero];
        if (metaAd?.id) {
          patch.meta_ad_id = metaAd.id;
          if (metaAd.adset_id)    patch.meta_adset_id    = metaAd.adset_id;
          if (metaAd.campaign_id) patch.meta_campaign_id = metaAd.campaign_id;
          const permalink = await fetchAdPermalink(metaAd.id);
          if (permalink) patch.meta_ad_url = permalink;
        }
      }

      if (ad.meta_publish_status !== "ativo") patch.meta_publish_status = "ativo";
      // Bug corrigido 2026-07-23: só movia pra Ativos quem vinha de Fazer/Fazendo
      // (o caminho normal de 1ª publicação). Quando o anúncio é ativado direto
      // no Gerenciador do Meta (fora do botão "Ativar no Meta" do Tracker) e o
      // card já estava em Campeões/Arquivados (ex: reutilizado, republicado),
      // ficava com meta_publish_status=ativo mas preso na coluna antiga pra
      // sempre. Mesmo espírito da regra simétrica de PAUSED/SUMIU logo abaixo,
      // que já tira da coluna Ativos incondicionalmente quando não está mais
      // ativo — aqui é o inverso: qualquer status vira Ativos quando o Meta
      // confirma ACTIVE.
      if (ad.status !== "ativo") { patch.status = "ativo"; patch.etapa = null; }
      if (Object.keys(patch).length) {
        await supabase.from("ads").update(patch).eq("numero", ad.numero);
      }
    } else if (AINDA_NAO_LIVRE.has(efStatus)) {
      // Reconcilia "aguardando 1ª ativação" pra quem ainda está em
      // Fazendo/Feito (ids fazer/fazendo — mesclagem de 2026-08-02, ver
      // ADS_COLUMNS em kanban.jsx). Um anúncio já arquivado ou campeão fica
      // PAUSED no Meta o tempo todo por decisão do usuário — não é "pendente", é decidido.
      if ((ad.status === "fazer" || ad.status === "fazendo") && ad.meta_publish_status !== "rascunho") {
        await supabase.from("ads").update({ meta_publish_status: "rascunho" }).eq("numero", ad.numero);
      }
      // Anúncio que estava "Ativo" e foi pausado no Meta (decisão do usuário,
      // ex: pausou a campanha inteira) não pode ficar preso pra sempre na
      // coluna Ativos — ele não está rodando de verdade. Vai pra Campeões se
      // a etiqueta calculada for Ótimo, senão pra Arquivados (mesma regra do
      // REGRAS-KANBAN.md: "Anúncio pausado... move pra Campeões (Ótimo) ou
      // Arquivados"). Bug corrigido 2026-07-22: mandava direto pra Arquivados
      // sempre, mesmo quando a etiqueta calculada já era Ótimo.
      if (ad.status === "ativo") {
        const novaTag = classificarAd(ad.vendas_total, ad.cpa_historico, ad.gasto_total);
        const novoStatus = novaTag === "Ótimo" ? "campeoes" : "arquivado";
        await supabase.from("ads").update({ status: novoStatus, tag: novaTag, meta_publish_status: "pausado" }).eq("numero", ad.numero);
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
      // preso em Ativos, e vai pra Campeões ou Arquivados conforme a tag.
      if (ad.status === "ativo") {
        const novaTag = classificarAd(ad.vendas_total, ad.cpa_historico, ad.gasto_total);
        patch.status = novaTag === "Ótimo" ? "campeoes" : "arquivado";
        patch.tag = novaTag;
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

      // Card em "Fazendo" (id fazer) com mídia pronta avança sozinho pra
      // "Feito" (id fazendo). Opção B da mesclagem Fazer+Fazendo de 2026-08-02.
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
    // "etapa" (Copy/Produção) só faz sentido em Fazendo (status=fazer) — some
    // sozinho em qualquer transição automática pra fora dali.
    if (status !== "fazer") payload.etapa = null;
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
    // Guarda o ad_id de MAIOR gasto recente pra cada número — é assim que um
    // anúncio relançado no Gerenciador (mesmo "ADS N", ad_id novo) assume o
    // lugar do antigo sozinho: o antigo para de gastar, o novo passa a gastar
    // mais, e em até 15min (ciclo desta função) o `meta_ad_id` troca. Guardar
    // adset/campanha junto (não só o id) fechou uma lacuna real em 2026-08-25:
    // o meta_ad_id trocava certinho, mas meta_campaign_id/meta_adset_id
    // ficavam apontando pro anúncio antigo, o que podia agrupar errado na aba
    // Tráfego se o relançamento fosse numa campanha ou conjunto diferente.
    const bestAdId: Record<number, { id: string; gasto: number; adsetId?: string; campaignId?: string }> = {};

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
          if (!cur || gasto > cur.gasto) {
            bestAdId[num] = { id: d.ad_id, gasto, adsetId: d.adset_id, campaignId: d.campaign_id };
          }
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
      const melhor = bestAdId[num];
      if (melhor) {
        payload.meta_ad_id = melhor.id;
        if (melhor.adsetId)    payload.meta_adset_id    = melhor.adsetId;
        if (melhor.campaignId) payload.meta_campaign_id = melhor.campaignId;
      }
      const { error } = await supabase.from("ads").update(payload).eq("numero", num);
      if (!error) ok++;
    }

    let permalinksOk = 0;
    for (const [numStr, melhor] of Object.entries(bestAdId)) {
      const permalink = await fetchAdPermalink(melhor.id);
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

    // "maximum" traz uma linha por ad_id (inclusive arquivado/deletado, desde
    // que tenha gasto histórico), e o agrupamento aqui é por NÚMERO extraído
    // do nome, não por ad_id — então gasto_total/vendas_total/cpa_historico
    // já é o CPA global somado de TODO ad_id que já usou esse "ADS N", não só
    // o que está rodando agora. Relançar o mesmo número com um ad_id novo não
    // zera nem perde o histórico do antigo, os dois entram na mesma soma.
    const agg: Record<number, { gasto: number; vendas: number }> = {};
    const bestAdId: Record<number, { id: string; gasto: number; adsetId?: string; campaignId?: string }> = {};
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
        if (!cur || gasto > cur.gasto) {
          bestAdId[num] = { id: d.ad_id, gasto, adsetId: d.adset_id, campaignId: d.campaign_id };
        }
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
      const melhor = bestAdId[num];
      if (melhor) {
        payload.meta_ad_id = melhor.id;
        if (melhor.adsetId)    payload.meta_adset_id    = melhor.adsetId;
        if (melhor.campaignId) payload.meta_campaign_id = melhor.campaignId;
      }
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
