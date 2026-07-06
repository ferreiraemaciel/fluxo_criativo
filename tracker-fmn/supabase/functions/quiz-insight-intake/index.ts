// Edge Function: recebe o "insight do Claudinho" (gerado pela rotina diária do Claude)
// e grava com privilégio de servidor, fonte='claude', um por dia.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("método", { status: 405, headers: cors });
  try {
    const b = await req.json();
    if (!b || !b.titulo) {
      return new Response(JSON.stringify({ error: "titulo obrigatório" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }
    const row = {
      dia: new Date().toISOString().slice(0, 10),
      fonte: "claude",
      titulo: String(b.titulo).slice(0, 200),
      gancho: b.gancho ? String(b.gancho).slice(0, 600) : null,
      detalhe: b.detalhe ? String(b.detalhe).slice(0, 400) : null,
      formato: b.formato ? String(b.formato).slice(0, 40) : "Reels",
      usado: false,
    };
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await sb.from("quiz_insights").upsert(row, { onConflict: "dia,fonte" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
  }
});
