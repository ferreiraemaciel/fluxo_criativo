// Tracker FMN — Webhook do WhatsApp (Cloud API oficial)
// GET  /functions/v1/whatsapp-webhook  → verificação do Meta (hub.challenge)
// POST /functions/v1/whatsapp-webhook  → mensagens recebidas + status de entrega

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const STATUS_MAP: Record<string, string> = {
  sent: "enviado", delivered: "entregue", read: "lido", failed: "falhou",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);

  // ── Verificação de assinatura do webhook (Meta chama isso 1x ao configurar) ──
  if (req.method === "GET") {
    const mode      = url.searchParams.get("hub.mode");
    const token     = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge || "", { status: 200 });
    }
    return json({ error: "verificação falhou" }, 403);
  }

  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: true }); // Meta não gosta de retry por payload malformado, só engole.
  }

  try {
    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value || {};

        // Mensagens recebidas do lead.
        for (const msg of value.messages || []) {
          const telefone = msg.from;
          const contato   = (value.contacts || []).find((c: any) => c.wa_id === telefone);
          const nome       = contato?.profile?.name || null;
          let corpo = "";
          let tipo  = "texto";
          if (msg.type === "text") corpo = msg.text?.body || "";
          else if (msg.type === "button") { corpo = msg.button?.text || ""; tipo = "botao"; }
          else if (msg.type === "interactive") { corpo = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ""; tipo = "botao"; }
          else corpo = `[${msg.type}]`;

          await supabase.from("whatsapp_mensagens").insert({
            telefone,
            nome,
            direcao: "entrada",
            tipo,
            corpo,
            wa_message_id: msg.id || null,
            status: "recebido",
            origem: "resposta_lead",
            lida_pelo_time: false,
            raw: msg,
          });
        }

        // Atualizações de status (enviado/entregue/lido/falhou) das mensagens que a gente mandou.
        for (const st of value.statuses || []) {
          if (!st.id) continue;
          const novoStatus = STATUS_MAP[st.status];
          if (!novoStatus) continue;
          await supabase.from("whatsapp_mensagens")
            .update({ status: novoStatus })
            .eq("wa_message_id", st.id);
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp-webhook] erro processando payload:", err);
  }

  // Sempre 200, mesmo com erro interno — não queremos que o Meta desative o webhook por retry.
  return json({ ok: true });
});
