// Tracker FMN — Enviar mensagem de Recuperação de Venda pelo número de
// suporte, via Khronus.
//
// Combinado com Felipe em 2026-08-26: o clique no ícone de WhatsApp da aba
// Funis > Recuperação de Venda não manda pela API oficial do Meta (essa é a
// linha do Claudinho) — manda pelo número de suporte do FMN, que roda pela
// Ponte do Khronus (WhatsApp Web automatizado, fora da API oficial).
//
// O Tracker não fala WhatsApp diretamente aqui: ele só grava na fila de
// envio do Khronus (schema `khronus`, banco do projeto "Blindagem", que
// hospeda os dois produtos). Quem realmente manda a mensagem é a extensão
// Ponte, instalada no perfil de Chrome com o WhatsApp Web do número de
// suporte logado, puxando essa fila e enviando pelo wa-js.
//
// Descoberta real em 2026-08-26, comparando com a integração já existente
// do Blindagem (contratovisual/src/lib/khronus-whatsapp.ts): a Ponte só
// consegue mandar mensagem pra quem ela já RECONHECE de uma conversa real
// no WhatsApp Web (khronus.crm_whatsapp_contatos.wa_chat_id preenchido).
// Contato nunca visto = sem wa_chat_id = a Ponte marca a fila como
// "falhou" com o erro "contato sem identificador de chat"
// (ver ~/Documents/khronus/extensao-ponte/ponte.js). Por isso esta function
// NUNCA cria contato novo (só o próprio observador da Ponte pode criar —
// tem uma trava lá especificamente contra isso, ver comentário em
// ponte.js linha ~118) e, se não achar wa_chat_id, devolve
// `sem_contato_conhecido` com um link wa.me pronto — o mesmo fallback
// manual que o Blindagem já usa: alguém manda essa primeira mensagem na
// mão, a Ponte passa a reconhecer o contato, e da próxima vez em diante o
// envio automático funciona.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const khronus = createClient(
  Deno.env.get("KHRONUS_SUPABASE_URL")!,
  Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!,
  { db: { schema: "khronus" } },
);

// Estúdio "Ferreira & Maciel" no Khronus — o mesmo que já existe pra
// contato@ferreiraemaciel.com.br. Fixo por enquanto: só um estúdio nosso lá.
const STUDIO_ID = "37029f8d-3d05-424e-8d80-e89951815359";

// Mesma lógica de contratovisual/src/lib/khronus-whatsapp.ts
// (normalizarTelefoneKhronus). O Khronus guarda telefone SEM o 9º dígito
// (12 dígitos: 55+DDD+8 números), é assim que o WhatsApp normaliza o
// número por baixo — nunca 13 dígitos. Sem tirar esse 9 aqui, a busca por
// telefone nunca bate com o contato que a Ponte já reconhece de verdade.
function normalizarTelefoneKhronus(bruto: string): string | null {
  const digitos = String(bruto || "").replace(/\D/g, "");
  if (!digitos) return null;
  let local = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  if (local.length === 11 && local[2] === "9") {
    local = local.slice(0, 2) + local.slice(3);
  }
  if (local.length !== 10) return null;
  return `55${local}`;
}

// Chamado direto pelo navegador (frontend Tracker), precisa de CORS — sem
// isso o preflight OPTIONS falha antes da requisição sair e o front só vê
// "Failed to fetch", sem detalhe nenhum do erro real.
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405, headers: CORS });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ erro: "Payload inválido" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const telefoneRaw = body?.telefone;
  const corpo = (body?.corpo || "").trim();

  if (!telefoneRaw) {
    return new Response(JSON.stringify({ erro: "telefone é obrigatório" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
  if (!corpo) {
    return new Response(JSON.stringify({ erro: "corpo é obrigatório" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const telefone = normalizarTelefoneKhronus(telefoneRaw);
  if (!telefone) {
    return new Response(JSON.stringify({ erro: "Telefone inválido" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  try {
    const { data: contato, error: erroContato } = await khronus
      .from("crm_whatsapp_contatos")
      .select("id, wa_chat_id")
      .eq("studio_id", STUDIO_ID)
      .eq("telefone", telefone)
      .maybeSingle();
    if (erroContato) throw new Error(`Buscar contato: ${erroContato.message}`);

    if (!contato?.wa_chat_id) {
      // Ponte nunca viu esse número numa conversa real — não dá pra
      // enfileirar (falharia sempre). Devolve o link manual, igual ao
      // fallback do Blindagem.
      const waLink = `https://wa.me/${telefone}?text=${encodeURIComponent(corpo)}`;
      return new Response(JSON.stringify({ ok: false, motivo: "sem_contato_conhecido", waLink }), {
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const { error: errFila } = await khronus.from("crm_whatsapp_fila_envio").insert({
      studio_id: STUDIO_ID,
      contato_id: contato.id,
      telefone,
      tipo: "texto",
      corpo,
      status: "pendente",
    });
    if (errFila) throw new Error(`Enfileirar: ${errFila.message}`);

    return new Response(JSON.stringify({ ok: true, contatoId: contato.id }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.error("[enviar-recuperacao-khronus] erro:", e.message);
    return new Response(JSON.stringify({ ok: false, erro: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
