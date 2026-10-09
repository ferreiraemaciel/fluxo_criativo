// Tracker FMN — processa a fila de resultado do quiz agendada (+5min).
// Antes de mandar, checa se o lead já comprou o MCV nesse intervalo; se
// comprou, cancela o envio do resultado (ele recebe o boas-vindas de aluno
// em vez disso). Agendado via pg_cron a cada 1 minuto (migration 073).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarResultadoQuizWhatsapp, telefonePareceSpam, normalizarTelefoneWhatsapp } from "../_shared/whatsapp-resultado-quiz.ts";
import { upsertContato } from "../_shared/whatsapp-contatos.ts";
import { renderCorpoTemplate } from "../_shared/whatsapp-templates.ts";
import { custoTemplateUsd } from "../_shared/whatsapp-custos.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PRODUTO_ID_MCV = "3400278";
const PRODUTO_ID_BLINDAGEM = "7963090";

/* Pré-checkout da página de vendas do Blindagem (09/10/2026). Quem preenche o
   formulário e não compra em 5 minutos recebe um modelo: quem pediu contato pelo
   WhatsApp recebe o de utilidade, quem foi para o pagamento recebe o de marketing.
   Usa a mesma marca whatsapp_resultado_enviado do quiz (esses leads não têm quiz). */
async function processarPrecheckout(): Promise<Record<string, number>> {
  const corte = new Date(Date.now() - 5 * 60e3).toISOString();
  const { data: leads } = await supabase
    .from("quiz_leads")
    .select("code, funnel_slug, email, nome, whatsapp, respostas")
    .eq("funnel_slug", "blindagem").eq("origem", "precheckout-lp")
    .eq("whatsapp_resultado_enviado", false)
    .lte("created_at", corte)
    .limit(50);
  let enviados = 0, pulados = 0;
  const token = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE");
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  for (const lead of leads || []) {
    const { data: travada } = await supabase.from("quiz_leads")
      .update({ whatsapp_resultado_enviado: true })
      .eq("funnel_slug", lead.funnel_slug).eq("code", lead.code).eq("whatsapp_resultado_enviado", false)
      .select("code");
    if (!travada?.length) continue;
    if (!lead.whatsapp || telefonePareceSpam(lead.whatsapp)) { pulados++; continue; }
    const tel = normalizarTelefoneWhatsapp(lead.whatsapp);
    const template = lead.respostas?.destino === "whatsapp" ? "blindagem_contato_solicitado" : "blindagem_checkout_pendente";

    // Já comprou o Blindagem? Não manda.
    if (lead.email) {
      const { data: compra } = await supabase.from("vendas").select("id")
        .eq("status", "aprovada").eq("produto_id", PRODUTO_ID_BLINDAGEM).ilike("comprador_email", lead.email)
        .limit(1).maybeSingle();
      if (compra) { pulados++; continue; }
    }
    // Mesmo número já recebeu qualquer um dos dois? Não repete.
    const { data: ja } = await supabase.from("whatsapp_mensagens").select("id")
      .eq("telefone", tel).in("template_nome", ["blindagem_contato_solicitado", "blindagem_checkout_pendente"])
      .eq("status", "enviado").limit(1).maybeSingle();
    if (ja) { pulados++; continue; }

    const primeiroNome = (lead.nome || "").trim().split(/\s+/)[0] || "tudo bem";
    const corpo = renderCorpoTemplate(template, [primeiroNome]);
    try {
      const r = await fetch(`https://graph.facebook.com/v25.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: tel, type: "template",
          template: { name: template, language: { code: "pt_BR" },
            components: [{ type: "body", parameters: [{ type: "text", text: primeiroNome }] }] },
        }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);
      await supabase.from("whatsapp_mensagens").insert({
        telefone: tel, nome: lead.nome, direcao: "saida", tipo: "template", corpo, template_nome: template,
        wa_message_id: d?.messages?.[0]?.id || null, status: "enviado", origem: "precheckout", raw: d,
        custo_usd: await custoTemplateUsd(supabase, template === "blindagem_contato_solicitado" ? "utility" : "marketing"),
        funnel_slug: "blindagem",
      });
      await upsertContato(supabase, tel, lead.nome, "lead_novo", { iaElegivel: true });
      enviados++;
    } catch (err) {
      console.error("[precheckout] falha:", err);
      await supabase.from("whatsapp_mensagens").insert({
        telefone: tel, nome: lead.nome, direcao: "saida", tipo: "template", corpo: template, template_nome: template,
        status: "falhou", origem: "precheckout", raw: { erro: String(err) }, funnel_slug: "blindagem",
      });
    }
  }
  return { precheckout_enviados: enviados, precheckout_pulados: pulados };
}

Deno.serve(async (_req) => {
  try {
    const pre = await processarPrecheckout().catch((e) => { console.error("[precheckout]", e); return {}; });
    const agora = new Date().toISOString();
    const { data: pendentes, error } = await supabase
      .from("quiz_leads")
      .select("code, funnel_slug, email, nome, whatsapp, nivel_risco, situacoes")
      .in("funnel_slug", ["fotografo-protegido", "blindagem"])
      .eq("completou_quiz", true)
      .eq("whatsapp_resultado_enviado", false)
      .not("resultado_agendado_para", "is", null)
      .lte("resultado_agendado_para", agora)
      .limit(50);

    if (error) throw error;
    if (!pendentes?.length) return new Response(JSON.stringify({ ok: true, processados: 0, ...pre }), { headers: { "content-type": "application/json" } });

    let enviados = 0, cancelados = 0, spam = 0;
    for (const lead of pendentes) {
      // Trava essa lead ANTES de mandar (evita corrida: se duas execuções
      // pegarem a fila quase juntas, só a que conseguir o update segue).
      const { data: travada } = await supabase
        .from("quiz_leads")
        .update({ whatsapp_resultado_enviado: true })
        .eq("funnel_slug", lead.funnel_slug).eq("code", lead.code)
        .eq("whatsapp_resultado_enviado", false)
        .select("code");
      if (!travada?.length) continue; // outra execução já pegou essa lead

      // Número visivelmente falso (00000..., sequência, tamanho errado):
      // não gasta mensagem, marca o contato como spam direto.
      if (telefonePareceSpam(lead.whatsapp)) {
        const tel = normalizarTelefoneWhatsapp(lead.whatsapp);
        await supabase.from("whatsapp_contatos")
          .upsert({ telefone: tel, nome: lead.nome, etapa: "perdido", is_spam: true }, { onConflict: "telefone" });
        spam++;
        continue;
      }

      // Mesmo número já recebeu o resultado DESTE MESMO quiz antes (refez o
      // quiz com outro nome/code)? Não manda de novo.
      //
      // A trava é por FUNIL, não só por telefone. Corrigido em 2026-08-28:
      // antes bastava ter recebido qualquer resultado de quiz alguma vez pra
      // nunca mais receber nenhum. Como quase todo lead que entra no funil do
      // Blindagem já tinha feito o quiz do MCV antes (8 dos 10 abandonos do
      // dia eram desse perfil), a base mais qualificada que existe estava
      // sendo silenciosamente excluída do novo funil. Achado num teste real
      // do próprio Felipe: ele completou o quiz do Blindagem, o registro foi
      // marcado como enviado, e a mensagem nunca saiu porque ele tinha
      // recebido o resultado do quiz do MCV em 11/07.
      //
      // São diagnósticos diferentes, de produtos diferentes: quem faz os dois
      // deve receber os dois.
      const tel = normalizarTelefoneWhatsapp(lead.whatsapp);
      const { data: jaRecebeu } = await supabase
        .from("whatsapp_mensagens")
        .select("id")
        .eq("telefone", tel)
        .eq("template_nome", "resultado_quiz_mcv")
        .eq("funnel_slug", lead.funnel_slug)
        .eq("status", "enviado")
        .limit(1)
        .maybeSingle();
      if (jaRecebeu) { cancelados++; continue; }

      // Já comprou o produto do funil? Cancela o envio — ele já está no
      // fluxo de boas-vindas de aluno.
      if (lead.email) {
        const produtoId = lead.funnel_slug === "blindagem" ? PRODUTO_ID_BLINDAGEM : PRODUTO_ID_MCV;
        const { data: compra } = await supabase
          .from("vendas")
          .select("id")
          .eq("status", "aprovada")
          .eq("produto_id", produtoId)
          .ilike("comprador_email", lead.email)
          .limit(1)
          .maybeSingle();
        if (compra) {
          await supabase.from("quiz_leads")
            .update({ whatsapp_resultado_enviado: true })
            .eq("funnel_slug", lead.funnel_slug).eq("code", lead.code);
          cancelados++;
          continue;
        }
      }

      await enviarResultadoQuizWhatsapp(
        supabase, lead.code, lead.funnel_slug, lead.whatsapp,
        lead.nome || null, lead.nivel_risco || null, lead.situacoes,
      );
      enviados++;
    }

    return new Response(JSON.stringify({ ok: true, processados: pendentes.length, enviados, cancelados, spam, ...pre }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[whatsapp-fila-quiz] erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
