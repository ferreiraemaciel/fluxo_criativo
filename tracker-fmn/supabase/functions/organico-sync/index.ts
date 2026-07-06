// Tracker FMN — Sincronização de métricas orgânicas (Instagram)
// Endpoint: POST/GET /functions/v1/organico-sync
// Puxa a lista de posts + insights da conta e grava um snapshot diário
// na tabela organico_metricas (um registro por post por dia).
//
// Paginação por cursor: ?after=CURSOR&limit=N. Retorna next_after pra continuar.
// - Cron diário: chama sem cursor (atualiza os posts mais recentes).
// - Backfill histórico: chama em sequência seguindo next_after até acabar.
//
// Leitura pura da Graph API: não gera custo, só consome cota de chamadas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const META_TOKEN = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const IG_USER_ID = Deno.env.get("IG_USER_ID") || "17841404378886420";
const GRAPH      = "https://graph.facebook.com/v25.0";

const MEDIA_FIELDS = [
  "id", "media_type", "media_product_type", "timestamp",
  "permalink", "caption", "like_count", "comments_count",
  "media_url", "thumbnail_url",
].join(",");

// Busca insights de uma mídia de forma tolerante: se a métrica não valer
// para aquele tipo de post, a Graph devolve erro e a gente ignora sem quebrar a linha.
async function fetchInsights(mediaId: string, metric: string): Promise<Record<string, number>> {
  try {
    const qs = new URLSearchParams({ metric, access_token: META_TOKEN });
    const res  = await fetch(`${GRAPH}/${mediaId}/insights?${qs}`);
    const json = await res.json();
    if (!json?.data) return {};
    const out: Record<string, number> = {};
    for (const m of json.data) out[m.name] = Number(m?.values?.[0]?.value ?? 0);
    return out;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Método não permitido", { status: 405 });
  }

  const url   = new URL(req.url);
  const after = url.searchParams.get("after") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "25"), 50);

  // 1. Uma página de mídias da conta
  const mediaQs = new URLSearchParams({
    fields:       MEDIA_FIELDS,
    limit:        String(limit),
    access_token: META_TOKEN,
  });
  if (after) mediaQs.set("after", after);

  const mediaRes  = await fetch(`${GRAPH}/${IG_USER_ID}/media?${mediaQs}`);
  const mediaJson = await mediaRes.json();

  if (!mediaJson?.data) {
    return new Response(
      JSON.stringify({ ok: false, erro: mediaJson?.error?.message || "sem dados de mídia" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Data de hoje no fuso de Brasília (YYYY-MM-DD)
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

  let processados = 0;
  const erros: any[] = [];

  for (const media of mediaJson.data) {
    try {
      const isReels = media.media_product_type === "REELS";

      // Métricas válidas para qualquer tipo de post
      const base = await fetchInsights(media.id, "reach,total_interactions,saved,shares");
      // Seguidores e visitas ao perfil que vieram do post (toleradas por tipo)
      const eng  = await fetchInsights(media.id, "follows,profile_visits");
      // Reels: visualizações
      const vid  = isReels ? await fetchInsights(media.id, "views") : {};

      await supabase.from("organico_metricas").upsert({
        meta_media_id:      media.id,
        ig_user_id:         IG_USER_ID,
        media_type:         media.media_type || null,
        media_product_type: media.media_product_type || null,
        permalink:          media.permalink || null,
        caption:            media.caption || null,
        posted_at:          media.timestamp || null,
        reach:              base.reach ?? null,
        likes:              media.like_count ?? null,
        comments:           media.comments_count ?? null,
        saved:              base.saved ?? null,
        shares:             base.shares ?? null,
        total_interactions: base.total_interactions ?? null,
        profile_visits:     eng.profile_visits ?? null,
        follows:            eng.follows ?? null,
        video_views:        vid.views ?? null,
        media_url:          media.media_url || null,
        thumbnail_url:      media.thumbnail_url || null,
        data:               hoje,
        captured_at:        new Date().toISOString(),
      }, { onConflict: "meta_media_id,data" });

      processados++;
    } catch (err) {
      erros.push({ media_id: media.id, erro: String(err) });
    }
  }

  const temMais   = !!mediaJson?.paging?.next;
  const nextAfter = temMais ? (mediaJson?.paging?.cursors?.after || null) : null;

  return new Response(
    JSON.stringify({ ok: true, processados, erros: erros.length, next_after: nextAfter }),
    { headers: { "Content-Type": "application/json" } }
  );
});
