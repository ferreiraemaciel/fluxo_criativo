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

Deno.serve(async (_req) => {
  try {
    const agora = new Date().toISOString();
    const { data: pendentes, error } = await supabase
      .from("quiz_leads")
      .select("code, funnel_slug, email, nome, whatsapp, nivel_risco, situacoes")
      .eq("funnel_slug", "fotografo-protegido")
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

      // Mesmo número já recebeu o resultado antes (quiz preenchido de novo,
      // com outro nome/code)? Trata como a mesma pessoa, nunca manda 2x pro
      // mesmo telefone.
      const tel = normalizarTelefoneWhatsapp(lead.whatsapp);
      const { data: jaRecebeu } = await supabase
        .from("whatsapp_mensagens")
        .select("id")
        .eq("telefone", tel)
        .eq("template_nome", "resultado_quiz_mcv")
        .eq("status", "enviado")
        .limit(1)
        .maybeSingle();
      if (jaRecebeu) { cancelados++; continue; }

      // Já comprou o MCV? Cancela o envio do resultado, ele já está no
      // fluxo de boas-vindas de aluno.
      if (lead.email) {
        const { data: compra } = await supabase
          .from("vendas")
          .select("id")
          .eq("status", "aprovada")
          .eq("produto_id", PRODUTO_ID_MCV)
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
