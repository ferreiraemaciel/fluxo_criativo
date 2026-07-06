// Edge Function PÚBLICA (verify_jwt=false): devolve só agregados do mapa,
// sem nenhum dado pessoal. Usa SERVICE_ROLE no servidor para ler `vendas`
// (que tem PII e é bloqueada para anon por RLS). Retorna:
//   { byState: {UF: n}, citiesByState: {UF: {cidade: n}}, total }
// Replica a lógica do app/map.jsx (cores = status != recuperacao/pendente;
// total = status 'aprovada'). Aceita ?from=YYYY-MM-DD&to=YYYY-MM-DD opcionais.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    async function fetchGeo(applyDateFilter: boolean) {
      let q = sb.from("vendas").select("comprador_estado, comprador_cidade")
        .not("comprador_estado", "is", null)
        .not("status", "in", '("recuperacao","pendente")')
        .limit(5000);
      if (applyDateFilter && from) q = q.gte("created_at", from + "T00:00:00");
      if (applyDateFilter && to) q = q.lte("created_at", to + "T23:59:59");
      return await q;
    }

    let cntQ = sb.from("vendas").select("id", { count: "exact", head: true }).eq("status", "aprovada");
    if (from) cntQ = cntQ.gte("created_at", from + "T00:00:00");
    if (to) cntQ = cntQ.lte("created_at", to + "T23:59:59");

    const [geoRes, countRes] = await Promise.all([fetchGeo(true), cntQ]);
    let rows = geoRes.data || [];
    if (rows.length === 0 && (from || to)) {
      const fb = await fetchGeo(false);
      rows = fb.data || [];
    }

    const byState: Record<string, number> = {};
    const citiesByState: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const uf = r.comprador_estado;
      if (!uf) continue;
      const s = String(uf).toUpperCase().slice(0, 2);
      byState[s] = (byState[s] || 0) + 1;
      if (r.comprador_cidade) {
        if (!citiesByState[s]) citiesByState[s] = {};
        citiesByState[s][r.comprador_cidade] = (citiesByState[s][r.comprador_cidade] || 0) + 1;
      }
    }

    return new Response(
      JSON.stringify({ byState, citiesByState, total: countRes.count || 0 }),
      { headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=300" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
