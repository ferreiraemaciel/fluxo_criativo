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

// Ordem de prioridade das dores (pergunta "situacoes" do quiz) pro {{3}} do
// template de resultado: mais peso jurídico/financeiro primeiro. Usa a de
// maior prioridade que o lead tiver marcado.
const DORES_PRIORIDADE: [string, string][] = [
  ["Cliente cancelou o contrato e pediu o dinheiro de volta", "perder o dinheiro num cancelamento de última hora"],
  ["Cliente quer que eu entregue os arquivos brutos", "ter que entregar os arquivos brutos sem estar protegido"],
  ["Anos depois o cliente pediu as fotos que eu não guardei mais", "ser cobrado por fotos de anos atrás que você nem guardou mais"],
  ["Cliente não gostou das fotos que eu fiz", "um cliente insatisfeito com poder de te processar"],
  ["Cliente pediu várias alterações no meu contrato", "um cliente reescrever seu contrato do jeito dele"],
  ["Cliente pediu muitos retoques e Photoshop excessivo", "retrabalho infinito sem previsão no contrato"],
  ["Colocaram filtro e acabaram com a minha foto", "alguém estragar sua entrega e você não poder fazer nada"],
  ["Postaram uma foto minha sem dar os créditos", "seu trabalho sendo usado sem crédito de novo"],
  ["Ficou sem jantar/mesa em um evento", "trabalhar o evento inteiro sem nem jantar"],
];

function dorPrioritaria(situacoes: string[] | undefined): string {
  const marcadas = new Set(situacoes || []);
  for (const [original, frase] of DORES_PRIORIDADE) if (marcadas.has(original)) return frase;
  return "riscos que a maioria dos fotógrafos só percebe depois que já é tarde";
}

function normalizarTelefoneWhatsapp(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

async function enviarResultadoQuizWhatsapp(sb: ReturnType<typeof createClient>, code: string, funnelSlug: string, whatsapp: string, nome: string | null, nivelRisco: string | null, situacoes: string[] | undefined) {
  const token         = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId || !nivelRisco) return;

  const to           = normalizarTelefoneWhatsapp(whatsapp);
  const primeiroNome = (nome || "").trim().split(/\s+/)[0] || "tudo bem";
  const dor           = dorPrioritaria(situacoes);

  try {
    const r = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "resultado_quiz_mcv",
          language: { code: "pt_BR" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: primeiroNome },
              { type: "text", text: nivelRisco },
              { type: "text", text: dor },
            ],
          }],
        },
      }),
    });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);

    await sb.from("whatsapp_mensagens").insert({
      telefone: to, nome: nome, direcao: "saida", tipo: "template",
      corpo: `[template: resultado_quiz_mcv] ${primeiroNome} · ${nivelRisco} · ${dor}`,
      template_nome: "resultado_quiz_mcv",
      wa_message_id: d?.messages?.[0]?.id || null, status: "enviado", origem: "quiz", raw: d,
    });
    await sb.from("quiz_leads").update({ whatsapp_resultado_enviado: true }).eq("funnel_slug", funnelSlug).eq("code", code);
  } catch (err) {
    console.error("Erro ao enviar resultado do quiz por WhatsApp:", err);
    await sb.from("whatsapp_mensagens").insert({
      telefone: to, nome, direcao: "saida", tipo: "template", corpo: "resultado_quiz_mcv",
      template_nome: "resultado_quiz_mcv", status: "falhou", origem: "quiz", raw: { erro: String(err) },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("método", { status: 405, headers: cors });
  try {
    const body = await req.json();
    if (!body || !body.code) {
      return new Response(JSON.stringify({ error: "code obrigatório" }), { status: 400, headers: { ...cors, "content-type": "application/json" } });
    }

    const row: Record<string, unknown> = { funnel_slug: body.funnel_slug || "fotografo-protegido", origem: "novo" };
    for (const k of COLS) if (k in body) row[k] = body[k];

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { error } = await sb.from("quiz_leads").upsert(row, { onConflict: "funnel_slug,code" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "content-type": "application/json" } });

    // Resultado do quiz por WhatsApp — só no funil Fotógrafo Protegido, só
    // quando o quiz foi de fato concluído e temos WhatsApp, só uma vez.
    const funnelSlug = String(body.funnel_slug || "fotografo-protegido");
    if (body.completou_quiz && body.whatsapp && funnelSlug === "fotografo-protegido") {
      const { data: leadAtual } = await sb
        .from("quiz_leads")
        .select("whatsapp_resultado_enviado")
        .eq("funnel_slug", funnelSlug)
        .eq("code", body.code)
        .single();
      if (!leadAtual?.whatsapp_resultado_enviado) {
        await enviarResultadoQuizWhatsapp(sb, body.code, funnelSlug, body.whatsapp, body.nome || null, body.nivel_risco || null, body.situacoes);
      }
    }

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
              content_name: body.funnel_slug === "blindagem" ? "Quiz Blindagem" : "Quiz Fotógrafo Protegido",
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
