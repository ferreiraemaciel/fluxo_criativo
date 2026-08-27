// Tracker FMN — Webhook do WhatsApp (Cloud API oficial)
// GET  /functions/v1/whatsapp-webhook  → verificação do Meta (hub.challenge)
// POST /functions/v1/whatsapp-webhook  → mensagens recebidas + status de entrega

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { upsertContato } from "../_shared/whatsapp-contatos.ts";
import { processarComIA } from "../_shared/whatsapp-ia.ts";
import { transcreverAudioGroq } from "../_shared/whatsapp-transcricao.ts";

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
    const ext = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") && mime.startsWith("audio") ? "mp3"
      : mime.includes("png") ? "png" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg"
      : mime.includes("webp") ? "webp" : mime.includes("pdf") ? "pdf"
      : mime.includes("mp4") ? "mp4" : extensaoFallback;
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
//
// Decide pelo TAMANHO TOTAL do número, nunca pelo prefixo "55": DDD 55 (Rio
// Grande do Sul) é idêntico ao código do país, então "começa com 55" não diz
// se o código do país já está presente. Bug real em 2026-08-27 (Jonathan/Jho
// Ferreira Fotografia, DDD 55): a versão antiga assumia "já tem código do
// país" e corrompia o número de dois jeitos diferentes, um pra cada telefone
// bruto (quiz vs Meta), virando dois contatos pra mesma pessoa.
function normalizarTelefoneWhatsapp(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10) d = "55" + d.slice(0, 2) + "9" + d.slice(2); // DDD+8, sem DDI e sem o 9
  else if (d.length === 11) d = "55" + d; // DDD+9, sem DDI
  else if (d.length === 12) d = d.slice(0, 4) + "9" + d.slice(4); // DDI+DDD+8, falta o 9
  return d; // 13 dígitos: já está no formato certo (DDI+DDD+9+8)
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
          else if (msg.type === "image") { corpo = msg.image?.caption || "📷 Imagem"; tipo = "imagem"; }
          else if (msg.type === "sticker") { corpo = "🩵 Figurinha"; tipo = "imagem"; }
          else if (msg.type === "reaction") { corpo = msg.reaction?.emoji || "👍"; }
          else if (msg.type === "video") { corpo = msg.video?.caption || "🎥 Vídeo"; tipo = "video"; }
          else if (msg.type === "document") { corpo = msg.document?.caption || msg.document?.filename || "📄 Documento"; tipo = "documento"; }
          else if (msg.type === "location") {
            const lat = msg.location?.latitude, lng = msg.location?.longitude;
            corpo = lat && lng ? `📍 Localização: https://maps.google.com/?q=${lat},${lng}` : "📍 Localização";
          }
          else corpo = `[${msg.type}]`;

          // Vídeo (a IA não processa vídeo), localização (precisa de julgamento
          // humano, tipo "isso é perto de onde eu atendo?") e documento que não
          // é PDF (a IA só lê PDF) sempre viram handoff imediato, sem tentar
          // resposta automática em cima disso.
          const documentoEhPdf = msg.type === "document" && (msg.document?.mime_type || "").includes("pdf");
          const precisaHumanoImediato = msg.type === "video" || msg.type === "location"
            || (msg.type === "document" && !documentoEhPdf);

          // A HORA DA MENSAGEM É A DA META, NÃO A NOSSA.
          // Elas quase sempre coincidem, mas divergem justamente quando mais
          // importa: se o webhook ficar fora do ar, a Meta reentrega depois, e
          // gravar "agora" faria uma mensagem de três dias atrás parecer recém
          // chegada. Isso aconteceu de verdade no apagão de 07 a 11/08/2026 e
          // teve consequência real: o Tracker mostrou "22h restantes" numa
          // janela de 24h que estava fechada havia dias, e o envio falhou com
          // o erro 131047 da Meta. A hora dela também é o que põe a mensagem
          // no dia certo do histórico.
          const tsMeta = Number(msg.timestamp);
          const momento = Number.isFinite(tsMeta) && tsMeta > 0
            ? new Date(tsMeta * 1000).toISOString()
            : new Date().toISOString();

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
            created_at: momento,
            raw: msg,
          });
          if (!gravou) continue; // duplicata (reenvio da Meta), já tratamos essa mensagem.

          // Baixa o áudio em background e completa a mensagem já gravada com a
          // URL pública: não pode segurar a resposta 200 pra Meta esperando
          // esse download (pode demorar alguns segundos).
          if (msg.type === "audio" && msg.audio?.id && waMessageId) {
            tarefasEmBackground.push(
              baixarEArmazenarMidia(msg.audio.id, telefone, "ogg").then(async (midiaUrl) => {
                if (!midiaUrl) return;
                // Transcreve em seguida (Groq/Whisper), pro Claudinho conseguir
                // "ouvir" o que o lead falou, não só saber que mandou áudio.
                const transcricao = await transcreverAudioGroq(midiaUrl);
                return supabase.from("whatsapp_mensagens")
                  .update({ midia_url: midiaUrl, ...(transcricao ? { transcricao } : {}) })
                  .eq("wa_message_id", waMessageId);
              }).catch((err) => console.error("[whatsapp-webhook] erro ao processar áudio em background:", err))
            );
          }

          // Mesma lógica pra imagem: baixa e guarda a URL própria (a da Meta
          // expira em minutos), pra o Claudinho poder "ver" a imagem depois
          // (ver visão em whatsapp-ia.ts) e pra ficar disponível no Conversas.
          if (msg.type === "image" && msg.image?.id && waMessageId) {
            tarefasEmBackground.push(
              baixarEArmazenarMidia(msg.image.id, telefone, "jpg").then((midiaUrl) => {
                if (!midiaUrl) return;
                return supabase.from("whatsapp_mensagens").update({ midia_url: midiaUrl }).eq("wa_message_id", waMessageId);
              }).catch((err) => console.error("[whatsapp-webhook] erro ao processar imagem em background:", err))
            );
          }

          // Figurinha (sticker) é webp, mesmo download que imagem, só pra
          // mostrar de verdade no Conversas (não entra na visão da IA, não
          // tem conteúdo relevante pra responder).
          if (msg.type === "sticker" && msg.sticker?.id && waMessageId) {
            tarefasEmBackground.push(
              baixarEArmazenarMidia(msg.sticker.id, telefone, "webp").then((midiaUrl) => {
                if (!midiaUrl) return;
                return supabase.from("whatsapp_mensagens").update({ midia_url: midiaUrl }).eq("wa_message_id", waMessageId);
              }).catch((err) => console.error("[whatsapp-webhook] erro ao processar figurinha em background:", err))
            );
          }

          // Vídeo: baixa só pra guardar (a IA não processa vídeo, humano
          // assiste depois, ver handoff imediato abaixo).
          if (msg.type === "video" && msg.video?.id && waMessageId) {
            tarefasEmBackground.push(
              baixarEArmazenarMidia(msg.video.id, telefone, "mp4").then((midiaUrl) => {
                if (!midiaUrl) return;
                return supabase.from("whatsapp_mensagens").update({ midia_url: midiaUrl }).eq("wa_message_id", waMessageId);
              }).catch((err) => console.error("[whatsapp-webhook] erro ao processar vídeo em background:", err))
            );
          }

          // Documento: baixa sempre. Se for PDF, o Claudinho lê de verdade
          // (ver whatsapp-ia.ts). Qualquer outro formato (docx, etc) vira
          // handoff, porque a IA não processa esse tipo de arquivo.
          if (msg.type === "document" && msg.document?.id && waMessageId) {
            const extFallback = (msg.document?.filename || "").split(".").pop() || "bin";
            tarefasEmBackground.push(
              baixarEArmazenarMidia(msg.document.id, telefone, extFallback).then((midiaUrl) => {
                if (!midiaUrl) return;
                return supabase.from("whatsapp_mensagens").update({ midia_url: midiaUrl }).eq("wa_message_id", waMessageId);
              }).catch((err) => console.error("[whatsapp-webhook] erro ao processar documento em background:", err))
            );
          }

          // Lead respondeu: se ainda estava como "lead novo", promove pra
          // "em conversa" automaticamente (respeita se já foi movido à mão).
          await upsertContato(supabase, telefone, nome, "em_conversa", { promoverParaEmConversa: true });

          // Vídeo e localização: handoff imediato, precisa de humano.
          if (precisaHumanoImediato) {
            await supabase.from("whatsapp_contatos").update({ precisa_humano: true }).eq("telefone", telefone);
          }

          // Figurinha, vídeo, localização ou documento que não é PDF: a IA
          // não processa (é formato que ela não lê, ou não tem conteúdo de
          // texto pra responder). Reação de emoji SAI dessa lista desde
          // 2026-08-04 (combinado com o Felipe): mesmo sem conteúdo real,
          // é sinal de engajamento e vale a pena a IA seguir a conversa em
          // vez de ficar muda. O prompt tem regra própria pra tratar
          // mensagem só de emoji (reação ou texto) como sinal leve, sem
          // tentar interpretar o emoji como afirmação de conteúdo.
          if (msg.type === "sticker" || msg.type === "video" || msg.type === "location"
            || (msg.type === "document" && !documentoEhPdf)) continue;

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
          // O MOTIVO da falha vem aqui dentro e antes era descartado: a mensagem
          // ficava marcada como "falhou" sem ninguém saber por quê. Guardar em
          // `raw` é o que permite descobrir depois, sem depender de reproduzir.
          const patch: Record<string, unknown> = { status: novoStatus };
          if (st.errors?.length) {
            patch.raw = { status_errors: st.errors, status_em: new Date().toISOString() };
            console.error("[whatsapp-webhook] envio falhou:", st.id, JSON.stringify(st.errors));
          }
          await supabase.from("whatsapp_mensagens")
            .update(patch)
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
