// Tracker FMN — arquiva automaticamente quem nunca respondeu.
// Roda a cada 15 minutos (migration 078). Um contato em "Lead novo" ou "Em
// conversa" vira "Perdido" quando a janela de 24h fechou e NUNCA abriu (ou
// seja, a gente mandou mensagem e o lead nunca respondeu nenhuma vez desde
// então). Enquanto ainda dá tempo de abrir a janela, ou se ele já respondeu
// alguma vez dentro das últimas 24h, continua visível normalmente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const JANELA_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (_req) => {
  try {
    const { data: contatos, error } = await supabase
      .from("whatsapp_contatos")
      .select("telefone, etapa")
      .in("etapa", ["lead_novo", "em_conversa"])
      .eq("is_spam", false);
    if (error) throw error;
    if (!contatos?.length) return new Response(JSON.stringify({ ok: true, avaliados: 0, arquivados: 0 }), { headers: { "content-type": "application/json" } });

    const agora = Date.now();
    let arquivados = 0;

    for (const contato of contatos) {
      // Última mensagem de ENTRADA (o lead já respondeu alguma vez?).
      const { data: ultimaEntrada } = await supabase
        .from("whatsapp_mensagens")
        .select("created_at")
        .eq("telefone", contato.telefone)
        .eq("direcao", "entrada")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let referencia: string | null = null;
      if (ultimaEntrada) {
        // Já respondeu antes: a janela conta a partir da última resposta dele.
        referencia = ultimaEntrada.created_at;
      } else {
        // Nunca respondeu: a janela conta a partir da mensagem de saída
        // mais RECENTE que realmente foi entregue (nunca uma que falhou —
        // tentativa falha não abriu janela nenhuma, não pode contar como
        // referência, senão arquiva gente que só recebeu a mensagem de
        // verdade bem depois de uma tentativa antiga ter dado erro).
        const { data: ultimaSaida } = await supabase
          .from("whatsapp_mensagens")
          .select("created_at")
          .eq("telefone", contato.telefone)
          .eq("direcao", "saida")
          .neq("status", "falhou")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        referencia = ultimaSaida?.created_at || null;
      }

      if (!referencia) continue; // sem histórico algum, não mexe.
      const fechouHaMais24h = (agora - new Date(referencia).getTime()) > JANELA_MS;
      if (!fechouHaMais24h) continue; // ainda dentro do prazo, ou já é recente.

      await supabase.from("whatsapp_contatos").update({ etapa: "perdido" }).eq("telefone", contato.telefone);
      arquivados++;
    }

    return new Response(JSON.stringify({ ok: true, avaliados: contatos.length, arquivados }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    console.error("[whatsapp-arquivar-perdidos] erro:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
