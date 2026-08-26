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
// Sem a Ponte conectada e logada nesse número, a mensagem fica represada em
// `status='pendente'` na fila — não é erro, é só esperar a ponte processar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const khronus = createClient(
  Deno.env.get("KHRONUS_SUPABASE_URL")!,
  Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!,
  { db: { schema: "khronus" } },
);

// Estúdio "Ferreira & Maciel" no Khronus — o mesmo que já existe pra
// contato@ferreiraemaciel.com.br. Fixo por enquanto: só um estúdio nosso lá.
const STUDIO_ID = "37029f8d-3d05-424e-8d80-e89951815359";

function normalizarTelefone(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ erro: "Payload inválido" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const telefoneRaw = body?.telefone;
  const corpo = (body?.corpo || "").trim();
  const nome = body?.nome || null;

  if (!telefoneRaw) {
    return new Response(JSON.stringify({ erro: "telefone é obrigatório" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  if (!corpo) {
    return new Response(JSON.stringify({ erro: "corpo é obrigatório" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const telefone = normalizarTelefone(telefoneRaw);

  try {
    // Acha o contato existente no estúdio, ou cria um novo. Não sobrescreve
    // nome de contato que já existe (pode já ter conversa e nome próprio).
    const { data: existente } = await khronus
      .from("crm_whatsapp_contatos")
      .select("id")
      .eq("studio_id", STUDIO_ID)
      .eq("telefone", telefone)
      .maybeSingle();

    let contatoId = existente?.id;
    if (!contatoId) {
      const { data: novo, error: errContato } = await khronus
        .from("crm_whatsapp_contatos")
        .insert({ studio_id: STUDIO_ID, telefone, nome, etapa: "em_conversa" })
        .select("id")
        .single();
      if (errContato) throw new Error(`Criar contato: ${errContato.message}`);
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
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[enviar-recuperacao-khronus] erro:", e.message);
    return new Response(JSON.stringify({ ok: false, erro: e.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
