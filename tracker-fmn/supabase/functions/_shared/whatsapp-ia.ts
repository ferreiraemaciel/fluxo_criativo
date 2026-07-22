// Tracker FMN — IA vendedora do WhatsApp (MCV)
// Chamada pelo whatsapp-webhook toda vez que um lead responde. Verifica os
// dois interruptores (global e por conversa) antes de gastar um token sequer.

import { SYSTEM_PROMPT_MCV } from "./whatsapp-ia-prompt.ts";
import { upsertContato } from "./whatsapp-contatos.ts";
import { custoAnthropicUsd } from "./whatsapp-custos.ts";
import { pareceMensagemAutomatica, contatoSoRespondeAutomatico } from "./whatsapp-automatica.ts";
import { aplicarCorrecoesAutomaticas } from "./whatsapp-texto-fixes.ts";

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

// Etapa de treinamento do Claudinho: enquanto true, nenhuma resposta ao vivo
// sai sozinha pra ninguém, só a retomada de última hora (ver whatsapp-retomada).
// Única exceção é o número de teste do Felipe, onde ele mesmo conversa com o
// Claudinho pra treinar e avaliar as respostas na hora.
const TELEFONE_TESTE_TREINAMENTO = "5548996981982";

async function modoTreinamentoAtivo(supabase: any): Promise<boolean> {
  const { data } = await supabase.from("app_config").select("valor").eq("chave", "whatsapp_modo_treinamento").single();
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
  return `\n\n## O que já sabemos sobre esse lead (nunca pergunte de novo, nunca diga de onde veio essa informação, use isso pra personalizar a conversa e vender melhor)\n${partes.join(" ")}\n\nUse esses dados com naturalidade, do jeito que um vendedor bom faz: puxando o assunto certo, citando a situação como se já soubesse por já estar no meio da conversa, sem soar que está lendo uma ficha e SEM mencionar "quiz", "resultado", "formulário" ou qualquer coisa parecida.\n\n**Nunca afirme esses dados como fato certo pro lead, mesmo sem citar a fonte.** Frases tipo "você relatou que...", "você disse que...", "você teve..." soam vigilância, mesmo sem a palavra "quiz". **Prefira sempre a suposição empática** ("imagino que já deve ter rolado..., isso é super comum por aqui"), é a forma que soa mais natural, como vendedor lendo a situação, não interrogando. Só use a pergunta de confirmação ("isso não foi parecido com algo que já rolou com você?") como alternativa, quando a suposição direta não couber bem na frase. Errado: "Você relatou que já teve cliente cancelando e pedindo o dinheiro de volta." Certo: "Imagino que já deve ter rolado cliente cancelando de última hora e pedindo o dinheiro de volta, isso é super comum por aqui." A informação entra como intuição de vendedor experiente, não como dado registrado em algum lugar.\n\nPor exemplo, se ele é amador querendo se profissionalizar, fale a língua de quem está começando. Se já é autônomo estabelecido, fale de igual pra igual, sem explicar o óbvio. Se citou medo de o negócio não dar certo, isso é uma abertura emocional real, use com cuidado e sem parecer oportunista.`;
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

  // Etapa de treinamento: nenhuma resposta ao vivo automática, exceto no
  // número de teste do Felipe OU num contato específico que ele liberou à mão
  // (ia_elegivel = true) pra treinar o Claudinho num caso real também.
  const treinamento = await modoTreinamentoAtivo(supabase);
  if (treinamento && telefone !== TELEFONE_TESTE_TREINAMENTO && !contato?.ia_elegivel) return;

  // Escopo fino: só quem foi explicitamente marcado como elegível (hoje, o
  // lote de teste). O toggle geral liga o motor, isso aqui decide quem
  // especificamente a IA pode responder — evita repetir o "ligou pra todo mundo".
  if (!contato?.ia_elegivel) return;
  // Por enquanto a IA só atua no fluxo de leads do quiz. Aluno novo (quem
  // comprou o MCV, etapa forçada por enviarBoasVindasMcv) fica de fora.
  if (contato?.etapa === "aluno") return;

  // Trava contra duas mensagens do lead chegando quase juntas: cada uma
  // dispara seu próprio processarComIA em background, e sem essa trava as
  // duas rodam em paralelo e o lead recebe resposta duplicada. Só uma por
  // vez; se já tem uma rodando, essa aqui desiste (a próxima mensagem real
  // dele já vai puxar o histórico atualizado de qualquer forma).
  const { data: travou } = await supabase
    .from("whatsapp_contatos")
    .update({ ia_processando: true })
    .eq("telefone", telefone)
    .eq("ia_processando", false)
    .select("telefone");
  if (!travou?.length) return;

  try {
    await processarComIAInterno(supabase, telefone, nomeLead, mensagemId, contato);
  } finally {
    await supabase.from("whatsapp_contatos").update({ ia_processando: false }).eq("telefone", telefone);
  }
}

// Baixa a imagem já guardada no nosso storage e devolve em base64, pro
// Claude "ver" de verdade (visão nativa da Anthropic, sem precisar de outra
// API). Só chamado pra ÚLTIMA mensagem do lead quando ela é imagem — o
// histórico mais antigo continua só como texto placeholder, pra não inflar
// o tamanho/custo de cada chamada com imagens antigas que já perderam o contexto.
async function baixarImagemBase64(midiaUrl: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const r = await fetch(midiaUrl);
    if (!r.ok) return null;
    const mediaType = r.headers.get("content-type") || "image/jpeg";
    const bytes = new Uint8Array(await r.arrayBuffer());
    let binary = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return { data: btoa(binary), mediaType };
  } catch (err) {
    console.error("[whatsapp-ia] erro ao baixar imagem pra visão:", err);
    return null;
  }
}

async function processarComIAInterno(supabase: any, telefone: string, nomeLead: string | null, mensagemId: string | null, contato: any) {
  const { data: historico } = await supabase
    .from("whatsapp_mensagens")
    .select("direcao, tipo, corpo, midia_url, transcricao, created_at")
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(20);

  const linhas = (historico || []).slice().reverse().filter((m: any) => m.corpo);

  // Áudio com transcrição já pronta (Groq/Whisper): usa o texto transcrito
  // em vez do placeholder "🎤 Áudio", pro Claudinho entender o conteúdo de
  // verdade. Sem transcrição ainda (corrida rara com o download em background),
  // fica no placeholder mesmo, melhor que travar a resposta esperando.
  const mensagens = linhas.map((m: any) => ({
    role: m.direcao === "entrada" ? "user" : "assistant",
    content: m.tipo === "audio" && m.transcricao ? `(áudio transcrito) ${m.transcricao}` : m.corpo,
  }));

  if (!mensagens.length) return;

  // Se a última mensagem do lead for uma imagem já baixada, troca o content
  // por um bloco de visão (texto + imagem), só pra essa última mensagem.
  const ultimaLinha = linhas[linhas.length - 1];
  if (ultimaLinha?.direcao === "entrada" && ultimaLinha?.tipo === "imagem" && ultimaLinha?.midia_url) {
    const img = await baixarImagemBase64(ultimaLinha.midia_url);
    if (img) {
      mensagens[mensagens.length - 1] = {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
          { type: "text", text: ultimaLinha.corpo === "📷 Imagem" ? "(o lead mandou essa imagem, sem legenda)" : ultimaLinha.corpo },
        ],
      };
    }
  }

  // Mesma coisa pra PDF (documento que chegou até aqui já é garantido PDF —
  // o webhook manda qualquer outro formato direto pra handoff, sem chamar a
  // IA). Visão nativa da Anthropic também lê PDF, mesmo mecanismo da imagem.
  if (ultimaLinha?.direcao === "entrada" && ultimaLinha?.tipo === "documento" && ultimaLinha?.midia_url) {
    const doc = await baixarImagemBase64(ultimaLinha.midia_url);
    if (doc) {
      mensagens[mensagens.length - 1] = {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.data } },
          { type: "text", text: ultimaLinha.corpo === "📄 Documento" ? "(o lead mandou esse PDF, sem legenda)" : ultimaLinha.corpo },
        ],
      };
    }
  }

  // Mensagem automática do próprio WhatsApp Business do lead (saudação ou
  // ausência)? Não é uma resposta de verdade, não vale a pena (nem faz
  // sentido) mandar uma pitch de vendas em cima disso. Não faz nada agora;
  // a retomada (24h) cuida de tentar de novo se ele não responder de fato.
  const ultimaMsg = mensagens[mensagens.length - 1];
  if (ultimaMsg.role === "user" && typeof ultimaMsg.content === "string" && pareceMensagemAutomatica(ultimaMsg.content)) {
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
        max_tokens: 700,
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

    // Se o modelo estourou o limite de tokens no meio da resposta, o JSON do
    // tool_use pode vir com o texto cortado no meio da frase (já vazou pro
    // lead uma vez, tipo "cliente p"). Nesse caso não manda o texto quebrado:
    // troca por uma linha curta segura e já sinaliza handoff pra um humano
    // assumir, em vez de arriscar credibilidade.
    if (d.stop_reason === "max_tokens") {
      console.error("[whatsapp-ia] resposta cortada por max_tokens, usando fallback:", telefone);
      resposta.mensagem = "Deixa eu confirmar uma coisa aqui e já te retorno.";
      resposta.handoff = true;
      resposta.motivo_handoff = "resposta da IA foi cortada por limite de tokens";
    }

    // Rede de segurança: se o modelo devolver "\n" escapado como texto literal
    // em vez de quebra de linha de verdade, converte antes de mandar pro
    // WhatsApp (já vazou uma vez pro lead, ficou feio).
    // Trava também o travessão: mesmo proibido no prompt, o modelo já vazou
    // um "—" pro lead (grave, é o tipo de coisa que entrega "resposta de IA").
    // Não confia só na instrução, garante removendo aqui também.
    if (typeof resposta.mensagem === "string") {
      resposta.mensagem = aplicarCorrecoesAutomaticas(
        resposta.mensagem.replace(/\\n/g, "\n").replace(/\s*[—–]\s*/g, ", ").trim(),
      );
    }

    // Rede de segurança pro handoff: se a própria mensagem promete passar a
    // conversa pra alguém do time ("vou passar", "vou te encaminhar", "colega
    // do time", "time de pagamento" etc.) mas o modelo esqueceu de marcar
    // handoff=true, força aqui. Já aconteceu do texto prometer handoff e o
    // precisa_humano nunca virar true no banco.
    const prometeuPassarPraHumano = typeof resposta.mensagem === "string" &&
      /\b(vou (te )?(passar|encaminhar|repassar)|passo (isso |voc[eê] )?pra|colega do time|time de pagamento|algu[eé]m do time)\b/i.test(resposta.mensagem);
    if (prometeuPassarPraHumano && !resposta.handoff) {
      console.log("[whatsapp-ia] handoff forçado: mensagem prometeu passar pra humano mas handoff veio false:", telefone);
      resposta.handoff = true;
      resposta.motivo_handoff = resposta.motivo_handoff || "mensagem prometeu encaminhar pra um humano";
    }

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
  // Mandou o link de checkout? Marca pra rotina de acompanhamento (30min
  // depois) checar se deu tudo certo, caso ainda não tenha comprado.
  if (resposta.mensagem && resposta.mensagem.includes("pay.hotmart.com/W87258826R")) {
    patch.checkout_enviado_em = new Date().toISOString();
  }
  await supabase.from("whatsapp_contatos").update(patch).eq("telefone", telefone);

  if (resposta.handoff) {
    console.log("[whatsapp-ia] handoff sinalizado:", telefone, resposta.motivo_handoff);
  }
}
