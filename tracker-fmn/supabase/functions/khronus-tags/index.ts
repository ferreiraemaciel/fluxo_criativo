// Tracker FMN — Tags de produto no Khronus: listar e marcar um contato.
//
// Existe por causa do botão "Registrar Receita" (aba Financeiro): venda
// fechada por fora da Hotmart não passa pelo hotmart-webhook, então a
// marcação automática de tag (TAG_POR_PRODUTO lá) não acontece. Aqui o
// próprio Felipe escolhe a tag na hora de lançar a receita.
//
// O frontend não fala direto com o banco do Khronus (é outro projeto
// Supabase, precisa de service role), por isso essa ponte.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const khronus = createClient(
  Deno.env.get("KHRONUS_SUPABASE_URL")!,
  Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!,
  { db: { schema: "khronus" } },
);

// Estúdio "Fotografia é o Meu Negócio": é a Ponte dele que roda no número de
// suporte do FMN. Mesmo estúdio das outras functions do Khronus aqui.
const STUDIO_ID = "d00109c7-84ec-4905-b39d-cbe0da66af75";

// O Khronus guarda telefone SEM o 9º dígito (12 dígitos: 55+DDD+8), é assim
// que o WhatsApp normaliza por baixo. Ver enviar-recuperacao-khronus.
function normalizarTelefoneKhronus(bruto: string): string | null {
  const digitos = String(bruto || "").replace(/\D/g, "");
  if (!digitos) return null;
  let local = digitos.startsWith("55") && digitos.length > 11 ? digitos.slice(2) : digitos;
  if (local.length === 11 && local[2] === "9") local = local.slice(0, 2) + local.slice(3);
  if (local.length !== 10) return null;
  return `55${local}`;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status, headers: { "Content-Type": "application/json", ...CORS },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("Método não permitido", { status: 405, headers: CORS });

  let body: any;
  try { body = await req.json(); } catch { return json({ erro: "Payload inválido" }, 400); }

  try {
    if (body?.acao === "listar") {
      const { data, error } = await khronus
        .from("crm_whatsapp_tags")
        .select("id, nome, cor")
        .eq("studio_id", STUDIO_ID)
        .eq("ativo", true)
        .order("ordem", { ascending: true, nullsFirst: false });
      if (error) throw new Error(error.message);
      return json({ tags: data || [] });
    }

    if (body?.acao === "marcar") {
      const tagId = body?.tag_id;
      const telefone = normalizarTelefoneKhronus(body?.telefone || "");
      if (!tagId)    return json({ erro: "tag_id é obrigatório" }, 400);
      if (!telefone) return json({ erro: "Telefone inválido" }, 400);

      const { data: contato } = await khronus
        .from("crm_whatsapp_contatos")
        .select("id")
        .eq("studio_id", STUDIO_ID)
        .eq("telefone", telefone)
        .maybeSingle();
      // Mesma regra do hotmart-webhook: não cria contato só pra pendurar
      // tag. Quem cria contato é o fluxo de mensagem.
      if (!contato?.id) return json({ ok: false, motivo: "sem_contato" });

      const { data: existente } = await khronus
        .from("crm_whatsapp_contato_tags")
        .select("id, removida_em")
        .eq("studio_id", STUDIO_ID)
        .eq("contato_id", contato.id)
        .eq("tag_id", tagId)
        .maybeSingle();

      if (existente?.id) {
        if (existente.removida_em) {
          await khronus.from("crm_whatsapp_contato_tags")
            .update({ removida_em: null, aplicada_em: new Date().toISOString() })
            .eq("id", existente.id);
        }
        return json({ ok: true, ja_tinha: !existente.removida_em });
      }

      const { error } = await khronus.from("crm_whatsapp_contato_tags").insert({
        studio_id: STUDIO_ID, contato_id: contato.id, tag_id: tagId,
      });
      if (error) throw new Error(error.message);
      return json({ ok: true });
    }

    return json({ erro: "acao inválida (use 'listar' ou 'marcar')" }, 400);
  } catch (e) {
    console.error("[khronus-tags] erro:", e.message);
    return json({ ok: false, erro: e.message }, 500);
  }
});
