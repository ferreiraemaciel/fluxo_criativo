// Tracker FMN — processa a fila de resultado do quiz agendada (+5min).
// Antes de mandar, checa se o lead já comprou o MCV nesse intervalo; se
// comprou, cancela o envio do resultado (ele recebe o boas-vindas de aluno
// em vez disso). Agendado via pg_cron a cada 1 minuto (migration 073).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enviarResultadoQuizWhatsapp, telefonePareceSpam, normalizarTelefoneWhatsapp } from "../_shared/whatsapp-resultado-quiz.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PRODUTO_ID_MCV = "3400278";
const PRODUTO_ID_BLINDAGEM = "7963090";

Deno.serve(async (_req) => {
  try {
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
    if (!pendentes?.length) return new Response(JSON.stringify({ ok: true, processados: 0 }), { headers: { "content-type": "application/json" } });

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

    return new Response(JSON.stringify({ ok: true, processados: pendentes.length, enviados, cancelados, spam }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[whatsapp-fila-quiz] erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
