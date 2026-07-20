// Tracker FMN — acompanhamento 30min depois de mandar o link de checkout do
// MCV. Se a pessoa ainda não comprou (etapa nunca virou "aluno"), manda uma
// mensagem leve perguntando se o link abriu e deu tudo certo. Roda a cada
// 5 minutos (migration 082). Texto livre, dentro da janela ainda aberta
// (o link só sai quando o lead está em conversa ativa), sem custo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WHATSAPP_TOKEN = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

const ESPERA_MIN_MS = 28 * 60 * 1000; // um pouco antes de 30min, o cron roda de 5 em 5
const ESPERA_MAX_MS = 45 * 60 * 1000; // margem de segurança, não manda se passou muito do previsto

const MENSAGEM = "Conseguiu abrir o link do checkout certinho? Deu tudo certo ou ficou alguma dúvida no meio do caminho?";

Deno.serve(async (_req) => {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return new Response(JSON.stringify({ ok: true, motivo: "credenciais ausentes" }), { headers: { "content-type": "application/json" } });
  }

  try {
    const { data: contatos, error } = await supabase
      .from("whatsapp_contatos")
      .select("telefone, nome, etapa, checkout_enviado_em, checkout_followup_enviado_para")
      .not("checkout_enviado_em", "is", null)
      .neq("etapa", "aluno")
      .eq("is_spam", false);
    if (error) throw error;
    if (!contatos?.length) return new Response(JSON.stringify({ ok: true, avaliados: 0, enviados: 0 }), { headers: { "content-type": "application/json" } });

    const agora = Date.now();
    let enviados = 0;

    for (const contato of contatos) {
      // Já mandou o acompanhamento pra esse MESMO envio de link? Pula (só
      // reenvia se um link NOVO sair depois, mudando checkout_enviado_em).
      if (contato.checkout_followup_enviado_para === contato.checkout_enviado_em) continue;

      const decorrido = agora - new Date(contato.checkout_enviado_em).getTime();
      if (decorrido < ESPERA_MIN_MS || decorrido > ESPERA_MAX_MS) continue;

      try {
        const r = await fetch(`https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: contato.telefone, type: "text", text: { body: MENSAGEM } }),
        });
        const d = await r.json();
        if (!r.ok || d.error) throw new Error(d.error?.message || `whatsapp ${r.status}`);

        await supabase.from("whatsapp_mensagens").insert({
          telefone: contato.telefone, nome: contato.nome, direcao: "saida", tipo: "texto", corpo: MENSAGEM,
          wa_message_id: d?.messages?.[0]?.id || null, status: "enviado", origem: "followup_checkout",
        });
        await supabase.from("whatsapp_contatos")
          .update({ checkout_followup_enviado_para: contato.checkout_enviado_em })
          .eq("telefone", contato.telefone);
        enviados++;
      } catch (err) {
        console.error("[whatsapp-followup-checkout] erro ao enviar:", contato.telefone, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, avaliados: contatos.length, enviados }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[whatsapp-followup-checkout] erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
