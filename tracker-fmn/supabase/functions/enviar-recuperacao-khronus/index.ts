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
// Histórico que explica o formato do telefone aqui: até 2026-08-26 a Ponte
// só conseguia mandar pra quem ela já tinha visto conversando (contato com
// `wa_chat_id` preenchido), e sem isso o envio morria em "contato sem
// identificador de chat". Nesse mesmo dia a Ponte ganhou o passo de
// perguntar ao WhatsApp qual é o identificador de um número (queryExists),
// então iniciar conversa nova voltou a ser possível: basta o contato existir
// com o telefone certo, que a Ponte resolve o identificador sozinha na
// primeira tentativa de envio.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const khronus = createClient(
  Deno.env.get("KHRONUS_SUPABASE_URL")!,
  Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!,
  { db: { schema: "khronus" } },
);

// Estúdio "Fotografia é o Meu Negócio" no Khronus: é a Ponte dele que roda
// no número de SUPORTE do FMN. Corrigido em 2026-08-26 depois de uma
// mensagem sair pelo WhatsApp errado — estava apontando pro estúdio
// "Ferreira & Maciel" (o único que existia quando isso foi escrito), cuja
// Ponte roda no WhatsApp pessoal do Felipe. Ao mexer aqui, confira antes em
// khronus.crm_whatsapp_ponte_status qual número está pareado em cada
// estúdio: é ele que decide de qual WhatsApp a mensagem sai.
const STUDIO_ID = "d00109c7-84ec-4905-b39d-cbe0da66af75";

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
  const nome = body?.nome || null;

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
    const { data: existente, error: erroContato } = await khronus
      .from("crm_whatsapp_contatos")
      .select("id")
      .eq("studio_id", STUDIO_ID)
      .eq("telefone", telefone)
      .maybeSingle();
    if (erroContato) throw new Error(`Buscar contato: ${erroContato.message}`);

    // Contato novo entra sem wa_chat_id de propósito: é a Ponte que descobre
    // o identificador com o WhatsApp e preenche na primeira tentativa de
    // envio. Nome de contato que já existe nunca é sobrescrito (pode já ter
    // conversa e nome próprio lá).
    let contatoId = existente?.id;
    if (!contatoId) {
      const { data: novo, error: errNovo } = await khronus
        .from("crm_whatsapp_contatos")
        .insert({ studio_id: STUDIO_ID, telefone, nome, etapa: "em_conversa" })
        .select("id")
        .single();
      if (errNovo) throw new Error(`Criar contato: ${errNovo.message}`);
      contatoId = novo.id;
    }

    const { error: errFila } = await khronus.from("crm_whatsapp_fila_envio").insert({
      studio_id: STUDIO_ID,
      contato_id: contatoId,
      telefone,
      tipo: "texto",
      corpo,
      status: "pendente",
    });
    if (errFila) throw new Error(`Enfileirar: ${errFila.message}`);

    return new Response(JSON.stringify({ ok: true, contatoId }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.error("[enviar-recuperacao-khronus] erro:", e.message);
    return new Response(JSON.stringify({ ok: false, erro: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
