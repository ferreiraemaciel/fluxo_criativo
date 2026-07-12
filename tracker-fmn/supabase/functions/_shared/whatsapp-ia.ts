// Tracker FMN — IA vendedora do WhatsApp (MCV)
// Chamada pelo whatsapp-webhook toda vez que um lead responde. Verifica os
// dois interruptores (global e por conversa) antes de gastar um token sequer.

import { SYSTEM_PROMPT_MCV } from "./whatsapp-ia-prompt.ts";
import { upsertContato } from "./whatsapp-contatos.ts";
import { custoAnthropicUsd } from "./whatsapp-custos.ts";

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
  const resto = d.slice(2);
  if (resto.length === 10) d = "55" + resto.slice(0, 2) + "9" + resto.slice(2);
  return d;
}

// Saudação/ausência automática do WhatsApp Business do próprio lead (dispara
// sozinha, não é ele respondendo de verdade). Padrões comuns de mensagem
// automática em português.
const PADROES_MSG_AUTOMATICA = [
  /no momento (estou|devo estar)/i,
  /mensagem automática/i,
  /resposta automática/i,
  /assim que (eu )?(possível|puder|conseguir)/i,
  /já (te )?respondo/i,
  /estou (ausente|fora|indispon[íi]vel)/i,
  /hor[áa]rio de atendimento/i,
  /obrigad[oa] pelo contato,? em breve/i,
  /retorno em breve/i,
];

function pareceMensagemAutomatica(texto: string): boolean {
  return PADROES_MSG_AUTOMATICA.some((re) => re.test(texto || ""));
}

async function buscarContextoLead(supabase: any, telefone: string): Promise<string> {
  // Tenta achar o lead pelo WhatsApp em quiz_leads (mesmo formato salvo lá,
  // que pode não estar normalizado igual whatsapp_mensagens.telefone).
  const semDDI = telefone.startsWith("55") ? telefone.slice(2) : telefone;
  const { data: leads } = await supabase
    .from("quiz_leads")
    .select("nivel_risco, area_atuacao, profissionalizacao, tipo_negocio, situacoes, sentimentos, usa_contrato, tipo_contrato_atual, custo_processo, confianca_clientes, protege_dinheiro, entende_contrato, quer_modelos, foco_artistico, temas_dominados")
    .or(`whatsapp.ilike.%${semDDI}%`)
    .limit(1);
  const lead = leads?.[0];
  if (!lead) return "";
  const partes = [];
  if (lead.nivel_risco) partes.push(`Nível de risco/exposição desse lead: ${lead.nivel_risco}.`);
  if (lead.area_atuacao) partes.push(`Área de atuação: ${lead.area_atuacao}.`);
  if (lead.profissionalizacao) partes.push(`Momento de profissionalização: ${lead.profissionalizacao}.`);
  if (lead.tipo_negocio) partes.push(`Tipo de negócio: ${lead.tipo_negocio}.`);
  if (lead.usa_contrato) partes.push(`Hoje usa contrato: ${lead.usa_contrato}.`);
  if (lead.tipo_contrato_atual) partes.push(`Contrato que usa hoje: ${lead.tipo_contrato_atual}.`);
  if (lead.entende_contrato) partes.push(`Entende de contrato sozinho: ${lead.entende_contrato}.`);
  if (lead.confianca_clientes) partes.push(`Confiança nos clientes: ${lead.confianca_clientes}.`);
  if (lead.protege_dinheiro) partes.push(`Hoje se protege financeiramente: ${lead.protege_dinheiro}.`);
  if (lead.custo_processo) partes.push(`Quanto acha que custaria um processo: ${lead.custo_processo}.`);
  if (lead.foco_artistico) partes.push(`Sobre focar na arte x resolver problema: ${lead.foco_artistico}.`);
  if (lead.quer_modelos) partes.push(`Urgência por modelos de contrato: ${lead.quer_modelos}.`);
  if (Array.isArray(lead.situacoes) && lead.situacoes.length) partes.push(`Situações que já viveu: ${lead.situacoes.join("; ")}.`);
  if (Array.isArray(lead.sentimentos) && lead.sentimentos.length) partes.push(`Sentimentos que relatou: ${lead.sentimentos.join("; ")}.`);
  if (Array.isArray(lead.temas_dominados) && lead.temas_dominados.length) partes.push(`Temas jurídicos que já domina: ${lead.temas_dominados.join("; ")}.`);
  if (!partes.length) return "";
  return `\n\n## O que já sabemos sobre esse lead (nunca pergunte de novo, nunca diga de onde veio essa informação, use isso pra personalizar a conversa e vender melhor)\n${partes.join(" ")}\n\nUse esses dados com naturalidade, do jeito que um vendedor bom faz: puxando o assunto certo, citando a situação como se já soubesse por já estar no meio da conversa, sem soar que está lendo uma ficha e SEM mencionar "quiz", "resultado", "formulário" ou qualquer coisa parecida. Por exemplo, se ele é amador querendo se profissionalizar, fale a língua de quem está começando. Se já é autônomo estabelecido, fale de igual pra igual, sem explicar o óbvio. Se citou medo de o negócio não dar certo, isso é uma abertura emocional real, use com cuidado e sem parecer oportunista.`;
}

function dormir(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Marca a mensagem do lead como lida e liga o "digitando..." no WhatsApp
// dele. O indicador dura até 25s ou até a próxima mensagem ser enviada.
async function marcarLidoEDigitando(messageId: string | null) {
  if (!messageId || !WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) return;
  try {
    await fetch(`https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
        typing_indicator: { type: "text" },
      }),
    });
  } catch (err) {
    console.error("[whatsapp-ia] erro ao marcar lido/digitando:", err);
  }
}

// Tempo humano de "pensar + digitar" antes de responder: nunca instantâneo,
// varia com o tamanho da resposta e tem uma folga aleatória, pra não parecer
// robô respondendo no mesmo segundo que a mensagem chegou. Mensagens mais
// longas ou que pedem mais reflexão podem levar até ~1 minuto.
function tempoDeDigitacao(mensagem: string): number {
  const base = 4000 + Math.random() * 6000; // 4 a 10s de "leu e pensou"
  const porCaractere = Math.min(mensagem.length * 130, 48000); // até +48s pra respostas longas
  return Math.round(base + porCaractere);
}

// O indicador de "digitando..." do WhatsApp expira em ~25s, então em esperas
// longas precisa reforçar ele de tempos em tempos pra continuar aparecendo
// até a mensagem sair de fato.
async function esperarComDigitando(ms: number, mensagemId: string | null) {
  const PASSO = 20000;
  let restante = ms;
  while (restante > 0) {
    const fatia = Math.min(restante, PASSO);
    await dormir(fatia);
    restante -= fatia;
    if (restante > 0) await marcarLidoEDigitando(mensagemId);
  }
}

export async function processarComIA(supabase: any, telefoneRaw: string, nomeLead: string | null, mensagemId: string | null = null) {
  if (!ANTHROPIC_API_KEY || !WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.log("[whatsapp-ia] credenciais ausentes, pulando.");
    return;
  }

  const telefone = normalizarTelefoneWhatsapp(telefoneRaw);

  const ativa = await iaAtivaGlobalmente(supabase);
  if (!ativa) return;

  const { data: contato } = await supabase.from("whatsapp_contatos").select("*").eq("telefone", telefone).single();
  if (contato?.ia_pausada || contato?.precisa_humano) return;
  // Escopo fino: só quem foi explicitamente marcado como elegível (hoje, o
  // lote de teste). O toggle geral liga o motor, isso aqui decide quem
  // especificamente a IA pode responder — evita repetir o "ligou pra todo mundo".
  if (!contato?.ia_elegivel) return;
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

  // Mensagem automática do próprio WhatsApp Business do lead (saudação ou
  // ausência)? Não é uma resposta de verdade, não vale a pena (nem faz
  // sentido) mandar uma pitch de vendas em cima disso. Não faz nada agora;
  // a retomada (24h) cuida de tentar de novo se ele não responder de fato.
  const ultimaMsg = mensagens[mensagens.length - 1];
  if (ultimaMsg.role === "user" && pareceMensagemAutomatica(ultimaMsg.content)) {
    console.log("[whatsapp-ia] mensagem automática detectada, pulando resposta:", telefone);
    return;
  }

  // Liga o "digitando..." assim que decide que vai responder. Fica visível
  // pro lead enquanto a IA pensa a resposta (até 25s, ou até a gente mandar
  // a mensagem de fato).
  await marcarLidoEDigitando(mensagemId);

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
    resposta.__tokensEntrada = d.usage?.input_tokens || 0;
    resposta.__tokensSaida   = d.usage?.output_tokens || 0;
  } catch (err) {
    console.error("[whatsapp-ia] erro ao chamar Anthropic:", err);
    return;
  }

  // Envia a mensagem da IA pelo WhatsApp (sempre manda algo, mesmo em handoff,
  // pra não deixar o lead sem resposta enquanto espera um humano).
  if (resposta.mensagem) {
    // Espera um tempo humano de "digitando" antes de mandar. Nunca responde
    // no mesmo instante que a mensagem chegou.
    await esperarComDigitando(tempoDeDigitacao(resposta.mensagem), mensagemId);
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: telefone, type: "text", text: { body: resposta.mensagem } }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);

      const custo = await custoAnthropicUsd(supabase, resposta.__tokensEntrada, resposta.__tokensSaida);
      await supabase.from("whatsapp_mensagens").insert({
        telefone, nome: nomeLead, direcao: "saida", tipo: "texto", corpo: resposta.mensagem,
        wa_message_id: d?.messages?.[0]?.id || null, status: "enviado", origem: "ia",
        tokens_entrada: resposta.__tokensEntrada, tokens_saida: resposta.__tokensSaida, custo_usd: custo,
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
