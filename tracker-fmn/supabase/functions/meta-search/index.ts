// Tracker FMN — Busca anúncios Meta por número ou fragmento de nome
// GET /functions/v1/meta-search?q=246
// GET /functions/v1/meta-search?q=contrato&limit=10

const META_TOKEN    = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const AD_ACCOUNT_ID = Deno.env.get("FB_AD_ACCOUNT_ID")!;
const GRAPH_BASE    = "https://graph.facebook.com/v25.0";

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url   = new URL(req.url);
  const q     = (url.searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);

  if (!q) {
    return new Response(
      JSON.stringify({ error: "Parâmetro 'q' obrigatório" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Busca todos os anúncios da conta (paginado)
  const ads: any[] = [];
  let nextUrl: string | null =
    `${GRAPH_BASE}/act_${AD_ACCOUNT_ID}/ads` +
    `?fields=id,name,effective_status,adset_id,campaign_id` +
    `&limit=500&access_token=${META_TOKEN}`;

  while (nextUrl && ads.length < 2000) {
    const res  = await fetch(nextUrl);
    const json = await res.json();
    if (json.error) {
      return new Response(
        JSON.stringify({ error: json.error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    ads.push(...(json.data || []));
    nextUrl = json.paging?.next || null;
  }

  // Filtra por número exato ou substring do nome (case-insensitive)
  const qLower  = q.toLowerCase();
  const qNum    = /^\d+$/.test(q) ? parseInt(q) : null;

  const matched = ads.filter(ad => {
    const name = ad.name.toLowerCase();
    if (qNum !== null) {
      // Match por número: "ADS 246", "ADS246", " 246 ", etc.
      const m = ad.name.match(/\b(\d{1,4})\b/);
      if (m && parseInt(m[1]) === qNum) return true;
    }
    return name.includes(qLower);
  }).slice(0, limit);

  return new Response(
    JSON.stringify({ total: matched.length, ads: matched }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
