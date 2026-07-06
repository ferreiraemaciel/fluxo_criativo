// Edge Function: recebe o lead da vitrine pública, grava com privilégio de servidor
// e dispara CAPI Lead para o Meta Pixel quando o lead tem e-mail.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const COLS = [
  "code", "created_at", "email", "nome", "whatsapp",
  "area_atuacao", "profissionalizacao", "tipo_negocio", "confianca_clientes",
  "situacoes", "custo_processo", "usa_contrato", "tipo_contrato_atual",
  "foco_artistico", "sentimentos", "protege_dinheiro", "temas_dominados",
  "entende_contrato", "quer_modelos", "completou_lead",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
  "device_platform", "ip", "tracking_raw", "respostas", "perfil", "nivel_risco",
  "fbp", "fbc", "completou_quiz",
];

async function sha256hex(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("método", { status: 405, headers: cors });
  try {
    const body = await req.json();
    if (!body || !body.code) {
      return new Response(JSON.stringify({ error: "code obrigatório" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    const row: Record<string, unknown> = { funnel_slug: "fotografo-protegido", origem: "novo" };
    for (const k of COLS) if (k in body) row[k] = body[k];

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await sb.from("quiz_leads").upsert(row, { onConflict: "funnel_slug,code" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "content-type": "application/json" } });

    // CAPI Lead — fire-and-forget, só quando temos e-mail
    if (body.completou_lead && body.email) {
      const pixelId = Deno.env.get("META_PIXEL_ID");
      const capiToken = Deno.env.get("META_CAPI_TOKEN");
      if (pixelId && capiToken) {
        const emailHash = await sha256hex(body.email.trim().toLowerCase());
        const capiPayload = {
          data: [{
            event_name: "Lead",
            event_time: Math.floor(Date.now() / 1000),
            event_id: `${body.code}_lead`,
            action_source: "website",
            event_source_url: body.event_source_url || "https://fotografoprotegido.fotografiaeomeunegocio.com.br",
            user_data: {
              em: [emailHash],
              ...(body.ip ? { client_ip_address: body.ip } : {}),
              ...(body.fbp ? { fbp: body.fbp } : {}),
              ...(body.fbc ? { fbc: body.fbc } : {}),
              client_user_agent: req.headers.get("user-agent") || undefined,
            },
            custom_data: {
              content_name: "Quiz Fotógrafo Protegido",
              ...(body.nivel_risco ? { lead_quality: body.nivel_risco } : {}),
            },
          }],
          access_token: capiToken,
        };
        fetch(`https://graph.facebook.com/v19.0/${pixelId}/events`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(capiPayload),
        }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
  }
});
