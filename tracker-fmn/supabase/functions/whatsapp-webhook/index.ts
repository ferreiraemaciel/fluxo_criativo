// Tracker FMN — Webhook do WhatsApp (Cloud API oficial)
// GET  /functions/v1/whatsapp-webhook  → verificação do Meta (hub.challenge)
// POST /functions/v1/whatsapp-webhook  → mensagens recebidas + status de entrega

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertContato } from "../_shared/whatsapp-contatos.ts";
import { processarComIA } from "../_shared/whatsapp-ia.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;
const WHATSAPP_TOKEN = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE") || "";

// Baixa a mídia (áudio, por enquanto) da Cloud API do WhatsApp e guarda no
// Storage do Supabase. A URL que a Meta devolve expira em minutos, por isso
// precisa baixar o binário e salvar num lugar nosso, senão o Tracker nunca
// consegue tocar o áudio depois que a janela passa.
async function baixarEArmazenarMidia(mediaId: string, telefone: string, extensaoFallback: string): Promise<string | null> {
  if (!WHATSAPP_TOKEN) return null;
  try {
    const infoResp = await fetch(`https://graph.facebook.com/v25.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
    });
    const info = await infoResp.json();
    if (!infoResp.ok || !info?.url) return null;

    const binResp = await fetch(info.url, { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } });
    if (!binResp.ok) return null;
    const bytes = await binResp.arrayBuffer();

    const mime = info.mime_type || "audio/ogg";
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : extensaoFallback;
    const path = `${telefone}/${mediaId}.${ext}`;

    const { error } = await supabase.storage.from("whatsapp-media").upload(path, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (error) { console.error("[whatsapp-webhook] erro ao subir mídia:", error.message); return null; }

    const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (err) {
    console.error("[whatsapp-webhook] erro ao baixar mídia:", err);
    return null;
  }
}

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

// Número de celular BR às vezes chega da Meta sem o 9 extra (formato antigo).
// Normaliza pra sempre 55+DDD+9+8dígitos, senão o mesmo lead vira dois
// contatos diferentes (um pelo quiz, outro pelo webhook) e a IA se perde.
function normalizarTelefoneWhatsapp(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = "55" + d;
  const resto = d.slice(2);
  if (resto.length === 10) d = "55" + resto.slice(0, 2) + "9" + resto.slice(2);
  return d;
}

// Evita reprocessar a mesma mensagem quando a Meta reenvia o webhook (ela
// faz retry se não recebermos 200 rápido o suficiente, e duas entregas quase
// simultâneas podem chegar aqui ao mesmo tempo). Em vez de checar-e-só-depois-
// gravar (que tem corrida: as duas passam pela checagem antes de qualquer
// uma gravar), tenta gravar direto — um índice único no banco (migration 079)
// garante que a segunda tentativa falha com conflito, sem corrida nenhuma.
async function gravarEntradaSeNova(row: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("whatsapp_mensagens").insert(row);
  if (error) {
    if (error.code === "23505") return false; // duplicata pega pelo índice único, ignora.
    throw error;
  }
  return true;
}

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

  // A IA (processarComIA) pode demorar até ~1min (atraso humano + typing).
  // Isso NUNCA pode segurar a resposta HTTP: se a Meta não recebe 200 rápido,
  // ela reenvia o mesmo webhook, e cada reenvio disparava uma resposta nova
  // da IA pro mesmo lead (foi o que causou a enxurrada de mensagens). Por
  // isso: grava tudo que é rápido (mensagem + contato) na hora, e só a parte
  // lenta (IA) roda em background depois de já termos respondido 200 pra Meta.
  const tarefasEmBackground: Promise<unknown>[] = [];

  try {
    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const value = change?.value || {};

        // Mensagens recebidas do lead.
        for (const msg of value.messages || []) {
          const waMessageId = msg.id || null;

          const telefone = normalizarTelefoneWhatsapp(msg.from);
          const contato   = (value.contacts || []).find((c: any) => c.wa_id === msg.from);
          const nome       = contato?.profile?.name || null;
          let corpo = "";
          let tipo  = "texto";
          if (msg.type === "text") corpo = msg.text?.body || "";
          else if (msg.type === "button") { corpo = msg.button?.text || ""; tipo = "botao"; }
          else if (msg.type === "interactive") { corpo = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || ""; tipo = "botao"; }
          else if (msg.type === "audio") { corpo = "🎤 Áudio"; tipo = "audio"; }
          else corpo = `[${msg.type}]`;

          const gravou = await gravarEntradaSeNova({
            telefone,
            nome,
            direcao: "entrada",
            tipo,
            corpo,
            wa_message_id: waMessageId,
            status: "recebido",
            origem: "resposta_lead",
            lida_pelo_time: false,
            raw: msg,
          });
          if (!gravou) continue; // duplicata (reenvio da Meta), já tratamos essa mensagem.

          // Baixa o áudio em background e completa a mensagem já gravada com a
          // URL pública: não pode segurar a resposta 200 pra Meta esperando
          // esse download (pode demorar alguns segundos).
          if (msg.type === "audio" && msg.audio?.id && waMessageId) {
            tarefasEmBackground.push(
              baixarEArmazenarMidia(msg.audio.id, telefone, "ogg").then((midiaUrl) => {
                if (!midiaUrl) return;
                return supabase.from("whatsapp_mensagens").update({ midia_url: midiaUrl }).eq("wa_message_id", waMessageId);
              }).catch((err) => console.error("[whatsapp-webhook] erro ao processar áudio em background:", err))
            );
          }

          // Lead respondeu: se ainda estava como "lead novo", promove pra
          // "em conversa" automaticamente (respeita se já foi movido à mão).
          await upsertContato(supabase, telefone, nome, "em_conversa", { promoverParaEmConversa: true });

          // Reação de emoji, figurinha ou outro tipo sem conteúdo de texto de
          // verdade não é uma resposta pra IA processar (não é pergunta nem
          // afirmação, não tem o que responder).
          if (msg.type === "reaction" || msg.type === "sticker") continue;

          // IA vendedora: roda em background, não segura a resposta ao Meta.
          tarefasEmBackground.push(
            processarComIA(supabase, telefone, nome, waMessageId).catch((err) =>
              console.error("[whatsapp-webhook] erro na IA em background:", err)
            )
          );
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

  if (tarefasEmBackground.length) {
    // @ts-ignore — EdgeRuntime existe no runtime do Supabase Edge Functions.
    EdgeRuntime.waitUntil(Promise.all(tarefasEmBackground));
  }

  // Sempre 200, mesmo com erro interno — não queremos que o Meta desative o webhook por retry.
  return json({ ok: true });
});
