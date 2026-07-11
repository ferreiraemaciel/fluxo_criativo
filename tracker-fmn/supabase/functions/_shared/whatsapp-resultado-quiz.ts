// Compartilhado entre quiz-lead-intake (agenda) e whatsapp-fila-quiz (envia
// de fato, depois de checar se o lead já comprou).
import { upsertContato } from "./whatsapp-contatos.ts";
import { renderCorpoTemplate } from "./whatsapp-templates.ts";

// Ordem de prioridade das dores (pergunta "situacoes" do quiz) pro {{3}} do
// template de resultado: mais peso jurídico/financeiro primeiro. Usa a de
// maior prioridade que o lead tiver marcado.
const DORES_PRIORIDADE: [string, string][] = [
  ["Cliente cancelou o contrato e pediu o dinheiro de volta", "perder o dinheiro num cancelamento de última hora"],
  ["Cliente quer que eu entregue os arquivos brutos", "ter que entregar os arquivos brutos sem estar protegido"],
  ["Anos depois o cliente pediu as fotos que eu não guardei mais", "ser cobrado por fotos de anos atrás que você nem guardou mais"],
  ["Cliente não gostou das fotos que eu fiz", "um cliente insatisfeito com poder de te processar"],
  ["Cliente pediu várias alterações no meu contrato", "um cliente reescrever seu contrato do jeito dele"],
  ["Cliente pediu muitos retoques e Photoshop excessivo", "retrabalho infinito sem previsão no contrato"],
  ["Colocaram filtro e acabaram com a minha foto", "alguém estragar sua entrega e você não poder fazer nada"],
  ["Postaram uma foto minha sem dar os créditos", "seu trabalho sendo usado sem crédito de novo"],
  ["Ficou sem jantar/mesa em um evento", "trabalhar o evento inteiro sem nem jantar"],
];

export function dorPrioritaria(situacoes: string[] | undefined): string {
  const marcadas = new Set(situacoes || []);
  for (const [original, frase] of DORES_PRIORIDADE) if (marcadas.has(original)) return frase;
  return "riscos que a maioria dos fotógrafos só percebe depois que já é tarde";
}

export function normalizarTelefoneWhatsapp(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

export async function enviarResultadoQuizWhatsapp(
  sb: any,
  code: string,
  funnelSlug: string,
  whatsapp: string,
  nome: string | null,
  nivelRisco: string | null,
  situacoes: string[] | undefined,
) {
  const token         = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneNumberId || !nivelRisco) return;

  const to           = normalizarTelefoneWhatsapp(whatsapp);
  const primeiroNome = (nome || "").trim().split(/\s+/)[0] || "tudo bem";
  const dor           = dorPrioritaria(situacoes);

  try {
    const r = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "resultado_quiz_mcv",
          language: { code: "pt_BR" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: primeiroNome },
              { type: "text", text: nivelRisco },
              { type: "text", text: dor },
            ],
          }],
        },
      }),
    });
    const d = await r.json();
    if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);

    await sb.from("whatsapp_mensagens").insert({
      telefone: to, nome: nome, direcao: "saida", tipo: "template",
      corpo: renderCorpoTemplate("resultado_quiz_mcv", [primeiroNome, nivelRisco, dor]),
      template_nome: "resultado_quiz_mcv",
      wa_message_id: d?.messages?.[0]?.id || null, status: "enviado", origem: "quiz", raw: d,
    });
    await sb.from("quiz_leads").update({ whatsapp_resultado_enviado: true }).eq("funnel_slug", funnelSlug).eq("code", code);
    await upsertContato(sb, to, nome, "lead_novo");
  } catch (err) {
    console.error("Erro ao enviar resultado do quiz por WhatsApp:", err);
    await sb.from("whatsapp_mensagens").insert({
      telefone: to, nome, direcao: "saida", tipo: "template", corpo: "resultado_quiz_mcv",
      template_nome: "resultado_quiz_mcv", status: "falhou", origem: "quiz", raw: { erro: String(err) },
    });
  }
}
