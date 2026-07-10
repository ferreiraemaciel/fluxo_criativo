// Tracker FMN — IA vendedora do WhatsApp (MCV)
// Chamada pelo whatsapp-webhook toda vez que um lead responde. Verifica os
// dois interruptores (global e por conversa) antes de gastar um token sequer.

import { SYSTEM_PROMPT_MCV } from "./whatsapp-ia-prompt.ts";
import { upsertContato } from "./whatsapp-contatos.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL   = Deno.env.get("ANTHROPIC_IA_MODEL") || "claude-haiku-4-5-20251001";
const WHATSAPP_TOKEN         = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

const TOOL_RESPONDER = {
  name: "responder_lead",
  description: "Responde a mensagem do lead no WhatsApp, no tom combinado, e sinaliza se a conversa precisa de um humano.",
  input_schema: {
    type: "object",
    properties: {
      mensagem: { type: "string", description: "Texto curto (1 a 3 frases) a enviar agora pro lead, no tom de WhatsApp." },
      estagio: { type: "string", enum: ["descoberta", "encantamento", "fechamento"], description: "Em qual estágio DEF a conversa está agora, depois dessa resposta." },
      handoff: { type: "boolean", description: "true se um humano precisa assumir a conversa a partir daqui." },
      motivo_handoff: { type: "string", description: "Motivo curto do handoff, só quando handoff=true." },
    },
    required: ["mensagem", "estagio", "handoff"],
  },
};

async function iaAtivaGlobalmente(supabase: any): Promise<boolean> {
  const { data } = await supabase.from("app_config").select("valor").eq("chave", "whatsapp_ia_ativa").single();
  return data?.valor === true;
}

function normalizarTelefoneWhatsapp(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

async function buscarContextoLead(supabase: any, telefone: string): Promise<string> {
  // Tenta achar o lead pelo WhatsApp em quiz_leads (mesmo formato salvo lá,
  // que pode não estar normalizado igual whatsapp_mensagens.telefone).
  const semDDI = telefone.startsWith("55") ? telefone.slice(2) : telefone;
  const { data: leads } = await supabase
    .from("quiz_leads")
    .select("nivel_risco, area_atuacao, situacoes, usa_contrato, custo_processo")
    .or(`whatsapp.ilike.%${semDDI}%`)
    .limit(1);
  const lead = leads?.[0];
  if (!lead) return "";
  const partes = [];
  if (lead.nivel_risco) partes.push(`Nível de risco do quiz: ${lead.nivel_risco}.`);
  if (lead.area_atuacao) partes.push(`Área de atuação: ${lead.area_atuacao}.`);
  if (lead.usa_contrato) partes.push(`Hoje usa contrato: ${lead.usa_contrato}.`);
  if (Array.isArray(lead.situacoes) && lead.situacoes.length) partes.push(`Situações que já viveu: ${lead.situacoes.join("; ")}.`);
  return partes.length ? `\n\n## O que já sabemos sobre esse lead (não pergunte de novo, use pra personalizar)\n${partes.join(" ")}` : "";
}

export async function processarComIA(supabase: any, telefoneRaw: string, nomeLead: string | null) {
  if (!ANTHROPIC_API_KEY || !WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log("[whatsapp-ia] credenciais ausentes, pulando.");
    return;
  }

  const telefone = normalizarTelefoneWhatsapp(telefoneRaw);

  const ativa = await iaAtivaGlobalmente(supabase);
  if (!ativa) return;

  const { data: contato } = await supabase.from("whatsapp_contatos").select("*").eq("telefone", telefone).single();
  if (contato?.ia_pausada || contato?.precisa_humano) return;
  // Por enquanto a IA só atua no fluxo de leads do quiz. Aluno novo (quem
  // comprou o MCV, etapa forçada por enviarBoasVindasMcv) fica de fora.
  if (contato?.etapa === "aluno") return;

  const { data: historico } = await supabase
    .from("whatsapp_mensagens")
    .select("direcao, tipo, corpo, created_at")
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(20);

  const mensagens = (historico || [])
    .slice()
    .reverse()
    .filter((m: any) => m.corpo)
    .map((m: any) => ({
      role: m.direcao === "entrada" ? "user" : "assistant",
      content: m.corpo,
    }));

  if (!mensagens.length) return;

  const contextoLead = await buscarContextoLead(supabase, telefone);
  const estagioAtual = contato?.estagio_venda || "descoberta";
  const systemPrompt = `${SYSTEM_PROMPT_MCV}${contextoLead}\n\n## Estágio atual da conversa\n${estagioAtual}`;

  let resposta: any;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 500,
        system: systemPrompt,
        messages: mensagens,
        tools: [TOOL_RESPONDER],
        tool_choice: { type: "tool", name: "responder_lead" },
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || `anthropic ${r.status}`);
    const toolUse = (d.content || []).find((c: any) => c.type === "tool_use");
    if (!toolUse) throw new Error("Anthropic não devolveu tool_use");
    resposta = toolUse.input;
  } catch (err) {
    console.error("[whatsapp-ia] erro ao chamar Anthropic:", err);
    return;
  }

  // Envia a mensagem da IA pelo WhatsApp (sempre manda algo, mesmo em handoff,
  // pra não deixar o lead sem resposta enquanto espera um humano).
  if (resposta.mensagem) {
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: telefone, type: "text", text: { body: resposta.mensagem } }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);

      await supabase.from("whatsapp_mensagens").insert({
        telefone, nome: nomeLead, direcao: "saida", tipo: "texto", corpo: resposta.mensagem,
        wa_message_id: d?.messages?.[0]?.id || null, status: "enviado", origem: "ia",
      });
    } catch (err) {
      console.error("[whatsapp-ia] erro ao enviar resposta:", err);
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (resposta.estagio) patch.estagio_venda = resposta.estagio;
  if (resposta.handoff) patch.precisa_humano = true;
  await supabase.from("whatsapp_contatos").update(patch).eq("telefone", telefone);

  if (resposta.handoff) {
    console.log("[whatsapp-ia] handoff sinalizado:", telefone, resposta.motivo_handoff);
  }
}
