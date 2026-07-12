// Tracker FMN — custo REAL cobrado pela Meta (não estimativa), via API de
// pricing_analytics da WABA. GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
const WHATSAPP_TOKEN = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE");
const WABA_ID = Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID");

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to   = url.searchParams.get("to");
    if (!from || !to) return new Response(JSON.stringify({ error: "from e to são obrigatórios" }), { status: 400, headers: { ...CORS, "content-type": "application/json" } });
    if (!WHATSAPP_TOKEN || !WABA_ID) return new Response(JSON.stringify({ error: "credenciais ausentes" }), { status: 500, headers: { ...CORS, "content-type": "application/json" } });

    const inicio = Math.floor(new Date(`${from}T00:00:00Z`).getTime() / 1000);
    const fim    = Math.floor(new Date(`${to}T23:59:59Z`).getTime() / 1000);

    const r = await fetch(
      `https://graph.facebook.com/v25.0/${WABA_ID}?access_token=${WHATSAPP_TOKEN}` +
      `&fields=${encodeURIComponent(`pricing_analytics.start(${inicio}).end(${fim}).granularity(DAILY).dimensions(["pricing_type","pricing_category"])`)}`
    );
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error?.message || `meta ${r.status}`);

    const pontos = d.pricing_analytics?.data?.[0]?.data_points || [];
    const custoTotalUsd = pontos.reduce((s: number, p: any) => s + (p.cost || 0), 0);
    const volumeTotal    = pontos.reduce((s: number, p: any) => s + (p.volume || 0), 0);
    const porCategoria: Record<string, { volume: number; custo: number }> = {};
    for (const p of pontos) {
      const chave = p.pricing_category || "OUTRO";
      porCategoria[chave] ||= { volume: 0, custo: 0 };
      porCategoria[chave].volume += p.volume || 0;
      porCategoria[chave].custo  += p.cost || 0;
    }

    return new Response(JSON.stringify({ custoTotalUsd, volumeTotal, porCategoria }), { headers: { ...CORS, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
