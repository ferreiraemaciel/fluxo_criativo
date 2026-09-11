// Tracker FMN — pede ao Claudinho para responder uma conversa que ficou parada.
//
// Existe por causa de 10/09/2026: o crédito da Anthropic acabou, o Claudinho
// ficou uma semana sem responder e, depois da recarga, as mensagens que já
// tinham chegado não recebiam resposta nenhuma. A IA só rodava quando chegava
// mensagem NOVA da Meta. Esta função chama a mesma processarComIA, então a
// resposta passa pelas mesmas travas (Claudinho ligado, contato elegível, não
// pausado, "mensagem mais nova"), pelo mesmo prompt e pelo mesmo "digitando".
//
// Só aceita a chave de serviço. A chave pública da tela não serve: sem esta
// trava, qualquer um com o site aberto poderia disparar respostas a leads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { processarComIA } from "../_shared/whatsapp-ia.ts";

const CHAVE_SERVICO = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, CHAVE_SERVICO);

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ erro: "Método não permitido" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token || token !== CHAVE_SERVICO) return json({ erro: "sem permissão" }, 401);

  let body: any;
  try { body = await req.json(); } catch { return json({ erro: "payload inválido" }, 400); }
  const telefone = String(body?.telefone || "").replace(/\D/g, "");
  if (!telefone) return json({ erro: "telefone é obrigatório" }, 400);

  const { data: contato } = await supabase.from("whatsapp_contatos")
    .select("telefone, nome").eq("telefone", telefone).maybeSingle();
  if (!contato) return json({ erro: "contato não encontrado" }, 404);

  const { data: ultima } = await supabase.from("whatsapp_mensagens")
    .select("wa_message_id, created_at").eq("telefone", telefone).eq("direcao", "entrada")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!ultima?.wa_message_id) return json({ erro: "o lead não mandou nenhuma mensagem" }, 409);

  // A resposta leva até ~1 min (espera humana + digitando). Roda depois de
  // devolver a resposta HTTP, do mesmo jeito que o whatsapp-webhook faz.
  const tarefa = processarComIA(supabase, telefone, contato.nome ?? null, ultima.wa_message_id)
    .catch((err) => console.error("[whatsapp-ia-responder] erro:", err));
  // @ts-ignore EdgeRuntime existe no ambiente das Edge Functions
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(tarefa); else await tarefa;

  return json({ ok: true, telefone, respondendo_a: ultima.created_at }, 202);
});
