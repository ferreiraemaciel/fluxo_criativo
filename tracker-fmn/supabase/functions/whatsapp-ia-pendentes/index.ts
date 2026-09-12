// Tracker FMN — repesca as conversas que ficaram sem resposta.
//
// Auditoria de 12/09/2026: quando a chamada à Anthropic falhava, o motivo era
// registrado e a conversa era abandonada. Nada tentava de novo. Foi o que
// aconteceu entre 3 e 10/09/2026, com o crédito zerado: uma semana de lead
// quente sem resposta, e depois da recarga as mensagens antigas continuaram
// sem ninguém, porque a IA só rodava quando chegava mensagem nova da Meta.
//
// Roda a cada 10 minutos e procura conversa cuja última mensagem é do lead,
// com mais de 12 minutos e menos de 24 horas. Não decide nada sozinha: chama
// a mesma processarComIA do webhook, então todas as travas continuam valendo
// (Claudinho ligado, contato elegível, não pausado, sem precisar de humano,
// spam de fora, "mensagem mais nova").
//
// Os 12 minutos existem para não atropelar o fluxo normal: a resposta do
// webhook leva até um minuto entre espera humana e "digitando", e o lead
// costuma mandar mensagens picadas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processarComIA } from "../_shared/whatsapp-ia.ts";
import { portao } from "../_shared/portao.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

const MINUTOS_DE_ESPERA = 12;
const TETO_POR_VOLTA = 5; // a fila normal dá conta do resto na volta seguinte

Deno.serve(async (req) => {
  const recusa = await portao(req, { usuario: true });
  if (recusa) return recusa;

  const agora = Date.now();
  const desde = new Date(agora - 24 * 3_600_000).toISOString();
  const ate = new Date(agora - MINUTOS_DE_ESPERA * 60_000).toISOString();

  // Mensagens das últimas 24h, mais novas primeiro: a primeira de cada
  // telefone é a última daquela conversa.
  const { data: msgs, error } = await supabase
    .from("whatsapp_mensagens")
    .select("telefone, direcao, created_at, wa_message_id")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return json({ erro: error.message }, 500);

  const ultimaPorTelefone = new Map<string, any>();
  for (const m of msgs || []) {
    if (!ultimaPorTelefone.has(m.telefone)) ultimaPorTelefone.set(m.telefone, m);
  }

  const candidatos = [...ultimaPorTelefone.values()]
    .filter((m) => m.direcao === "entrada" && m.created_at <= ate && m.wa_message_id)
    .slice(0, TETO_POR_VOLTA);

  if (!candidatos.length) return json({ ok: true, repescados: 0 });

  const telefones = candidatos.map((c) => c.telefone);
  const { data: contatos } = await supabase
    .from("whatsapp_contatos")
    .select("telefone, nome, is_spam, ia_pausada, precisa_humano")
    .in("telefone", telefones);
  const porTelefone = Object.fromEntries((contatos || []).map((c) => [c.telefone, c]));

  const repescados: string[] = [];
  for (const c of candidatos) {
    const contato = porTelefone[c.telefone];
    if (!contato || contato.is_spam || contato.ia_pausada || contato.precisa_humano) continue;
    repescados.push(c.telefone);
    const tarefa = processarComIA(supabase, c.telefone, contato.nome ?? null, c.wa_message_id)
      .catch((err: Error) => console.error("[ia-pendentes] erro:", err.message));
    // @ts-ignore EdgeRuntime existe no ambiente das Edge Functions
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(tarefa); else await tarefa;
  }

  return json({ ok: true, repescados: repescados.length, telefones: repescados });
});
