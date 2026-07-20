// Tracker FMN — Envio de mensagens WhatsApp (Cloud API oficial)
// POST /functions/v1/whatsapp-enviar  { action: "template", to, nome?, template_nome, idioma?, parametros: [] , origem? }
// POST /functions/v1/whatsapp-enviar  { action: "texto",    to, nome?, texto, origem? }
// POST /functions/v1/whatsapp-enviar  { action: "midia_link", to, nome?, url, legenda?, origem? }         (JSON)
// POST /functions/v1/whatsapp-enviar  multipart/form-data: action=midia_arquivo, to, nome?, legenda?, arquivo=<file>
//
// "template" é a única forma de a empresa iniciar contato (fora da janela de
// 24h de serviço). "texto"/"midia_*" só funcionam se o lead respondeu algo
// nas últimas 24h, senão o WhatsApp recusa. Usado pela tela Conversas e por
// qualquer função interna que precise mandar mensagem livre dentro da janela
// aberta. Envio de mídia é sempre manual (Amanda/Felipe escolhendo o
// arquivo), o Claudinho (IA) não manda mídia sozinho.

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

// Deriva o tipo de mídia do WhatsApp (image/video/audio/document) a partir
// do mime type do arquivo. Qualquer coisa fora dos três primeiros vira
// documento (o WhatsApp aceita quase qualquer formato como documento).
function tipoMidiaPorMime(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

// Mapa tipo do WhatsApp → tipo salvo em whatsapp_mensagens.tipo (ver 088).
const TIPO_DB: Record<string, string> = { image: "imagem", video: "video", audio: "audio", document: "documento" };

async function enviarMidia(to: string, tipoWa: "image" | "video" | "audio" | "document", url: string, legenda: string, nomeArquivo?: string) {
  const payload: Record<string, unknown> = { link: url };
  if (legenda && (tipoWa === "image" || tipoWa === "video" || tipoWa === "document")) payload.caption = legenda;
  if (tipoWa === "document" && nomeArquivo) payload.filename = nomeArquivo;
  return graphPost(`/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: "whatsapp",
    to,
    type: tipoWa,
    [tipoWa]: payload,
  });
}

// Upload de arquivo escolhido/arrastado no Conversas: sobe pro bucket
// público whatsapp-media (o mesmo usado pra guardar áudio recebido) e manda
// como mídia pro WhatsApp usando o link público.
async function handleMidiaArquivo(req: Request) {
  const form = await req.formData();
  const toRaw = String(form.get("to") || "");
  if (!toRaw) return json({ error: "to é obrigatório" }, 400);
  const to = normalizarTelefone(toRaw);
  const nome = form.get("nome") ? String(form.get("nome")) : null;
  const legenda = String(form.get("legenda") || "");
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return json({ error: "arquivo é obrigatório" }, 400);

  const mime = arquivo.type || "application/octet-stream";
  const tipoWa = tipoMidiaPorMime(mime);
  const ext = (arquivo.name.split(".").pop() || "bin").toLowerCase();
  const path = `saida/${to}/${crypto.randomUUID()}.${ext}`;

  try {
    const bytes = await arquivo.arrayBuffer();
    const { error: erroUpload } = await supabase.storage.from("whatsapp-media").upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (erroUpload) throw new Error(erroUpload.message);
    const { data: pub } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    const url = pub?.publicUrl;
    if (!url) throw new Error("falha ao gerar URL pública do arquivo");

    const resp = await enviarMidia(to, tipoWa, url, legenda, arquivo.name);

    await supabase.from("whatsapp_mensagens").insert({
      telefone: to, nome, direcao: "saida", tipo: TIPO_DB[tipoWa], corpo: legenda || null, midia_url: url,
      wa_message_id: resp?.messages?.[0]?.id || null, status: "enviado", origem: "manual", raw: resp,
    });

    return json({ ok: true, wa_message_id: resp?.messages?.[0]?.id || null, url });
  } catch (err) {
    await supabase.from("whatsapp_mensagens").insert({
      telefone: to, nome, direcao: "saida", tipo: TIPO_DB[tipoWa], corpo: legenda || null,
      status: "falhou", origem: "manual", raw: { erro: String(err) },
    });
    return json({ error: String((err as Error).message || err) }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "método não suportado" }, 405);

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    return handleMidiaArquivo(req);
  }

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
    if (action === "midia_link") {
      const url = String(body.url || "").trim();
      if (!url) return json({ error: "url é obrigatória" }, 400);
      const legenda = String(body.legenda || "");
      // Deduz o tipo pela extensão do link (não temos o mime aqui, já que não
      // baixamos o arquivo, só repassamos o link pro WhatsApp buscar).
      const extMatch = /\.([a-z0-9]+)(\?|$)/i.exec(url.toLowerCase());
      const ext = extMatch?.[1] || "";
      const mimePorExt: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
        mp4: "video/mp4", "3gp": "video/3gpp",
        mp3: "audio/mpeg", ogg: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", amr: "audio/amr",
      };
      const tipoWa = tipoMidiaPorMime(mimePorExt[ext] || "application/octet-stream");

      const resp = await enviarMidia(to, tipoWa, url, legenda);
      await supabase.from("whatsapp_mensagens").insert({
        telefone: to, nome: body.nome || null, direcao: "saida", tipo: TIPO_DB[tipoWa], corpo: legenda || null, midia_url: url,
        wa_message_id: resp?.messages?.[0]?.id || null, status: "enviado", origem: body.origem || "manual", raw: resp,
      });
      return json({ ok: true, wa_message_id: resp?.messages?.[0]?.id || null });
    }

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

      // Mandou o link de checkout manualmente? Marca pra rotina de
      // acompanhamento (30min depois) checar se deu tudo certo.
      if (texto.includes("pay.hotmart.com/W87258826R")) {
        await supabase.from("whatsapp_contatos")
          .upsert({ telefone: to, checkout_enviado_em: new Date().toISOString() }, { onConflict: "telefone" });
      }

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
