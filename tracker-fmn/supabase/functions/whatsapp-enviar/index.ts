// Tracker FMN — Envio de mensagens WhatsApp (Cloud API oficial)
// POST /functions/v1/whatsapp-enviar  { action: "template", to, nome?, template_nome, idioma?, parametros: [] , origem? }
// POST /functions/v1/whatsapp-enviar  { action: "texto",    to, nome?, texto, origem? }
//
// "template" é a única forma de a empresa iniciar contato (fora da janela de
// 24h de serviço). "texto" só funciona se o lead respondeu algo nas últimas
// 24h, senão o WhatsApp recusa. Usado pela tela Conversas e por qualquer
// função interna que precise mandar mensagem livre dentro da janela aberta.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertContato } from "../_shared/whatsapp-contatos.ts";
import { renderCorpoTemplate } from "../_shared/whatsapp-templates.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const META_TOKEN       = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const PHONE_NUMBER_ID  = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;
const GRAPH             = "https://graph.facebook.com/v25.0";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Normaliza pro formato E.164 sem "+": só dígitos, com DDI 55 se faltar.
function normalizarTelefone(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

async function graphPost(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${META_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const d = await r.json();
  if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);
  return d;
}

async function enviarTemplate(to: string, templateNome: string, idioma: string, parametros: string[]) {
  const body: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateNome,
      language: { code: idioma || "pt_BR" },
      ...(parametros?.length
        ? { components: [{ type: "body", parameters: parametros.map((p) => ({ type: "text", text: String(p) })) }] }
        : {}),
    },
  };
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, body);
}

async function enviarTexto(to: string, texto: string) {
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: texto },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const action = String(body.action || "");
  const toRaw  = String(body.to || "");
  if (!toRaw) return json({ error: "to é obrigatório" }, 400);
  const to = normalizarTelefone(toRaw);

  try {
    if (action === "template") {
      const templateNome = String(body.template_nome || "");
      const idioma        = String(body.idioma || "pt_BR");
      const parametros     = Array.isArray(body.parametros) ? body.parametros.map(String) : [];
      if (!templateNome) return json({ error: "template_nome é obrigatório" }, 400);

      const resp = await enviarTemplate(to, templateNome, idioma, parametros);

      await supabase.from("whatsapp_mensagens").insert({
        telefone: to,
        nome: body.nome || null,
        direcao: "saida",
        tipo: "template",
        corpo: renderCorpoTemplate(templateNome, parametros),
        template_nome: templateNome,
        wa_message_id: resp?.messages?.[0]?.id || null,
        status: "enviado",
        origem: body.origem || null,
        raw: resp,
      });
      await upsertContato(supabase, to, body.nome ? String(body.nome) : null, "lead_novo");

      return json({ ok: true, wa_message_id: resp?.messages?.[0]?.id || null });
    }

    if (action === "texto") {
      const texto = String(body.texto || "");
      if (!texto) return json({ error: "texto é obrigatório" }, 400);

      const resp = await enviarTexto(to, texto);

      await supabase.from("whatsapp_mensagens").insert({
        telefone: to,
        nome: body.nome || null,
        direcao: "saida",
        tipo: "texto",
        corpo: texto,
        wa_message_id: resp?.messages?.[0]?.id || null,
        status: "enviado",
        origem: body.origem || "manual",
        raw: resp,
      });

      return json({ ok: true, wa_message_id: resp?.messages?.[0]?.id || null });
    }

    return json({ error: `action desconhecida: ${action}` }, 400);
  } catch (err) {
    // Registra a tentativa falha também, ajuda a diagnosticar direto pela caixa de entrada.
    await supabase.from("whatsapp_mensagens").insert({
      telefone: to,
      nome: body.nome || null,
      direcao: "saida",
      tipo: action === "template" ? "template" : "texto",
      corpo: action === "template" ? String(body.template_nome || "") : String(body.texto || ""),
      template_nome: action === "template" ? String(body.template_nome || "") : null,
      status: "falhou",
      origem: body.origem || null,
      raw: { erro: String(err) },
    });
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
