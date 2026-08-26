// Tracker FMN — Consulta se um telefone já tem mensagem na fila do Khronus
// (número de suporte, via Ponte), pra marcar "Já contatado pelo suporte" na
// aba Funis > Recuperação de Venda — cobre tanto o envio manual de
// recuperação (enviar-recuperacao-khronus) quanto a boas-vindas automática
// de aluno novo (hotmart-webhook), porque as duas gravam na mesma fila
// khronus.crm_whatsapp_fila_envio. Combinado com Felipe em 2026-08-26.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const khronus = createClient(
  Deno.env.get("KHRONUS_SUPABASE_URL")!,
  Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!,
  { db: { schema: "khronus" } },
);

const STUDIO_ID = "37029f8d-3d05-424e-8d80-e89951815359"; // "Ferreira & Maciel"

function normalizarTelefone(raw: string): string {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("Método não permitido", { status: 405, headers: CORS });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ erro: "Payload inválido" }), {
      status: 400, headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const telefones: string[] = Array.isArray(body?.telefones) ? body.telefones : [];
  if (!telefones.length) {
    return new Response(JSON.stringify({ telefones: [] }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const candidatos = [...new Set(telefones.map(normalizarTelefone))];

  try {
    const encontrados = new Set<string>();
    for (let i = 0; i < candidatos.length; i += 200) {
      const { data, error } = await khronus
        .from("crm_whatsapp_fila_envio")
        .select("telefone")
        .eq("studio_id", STUDIO_ID)
        .in("telefone", candidatos.slice(i, i + 200));
      if (error) throw new Error(error.message);
      (data || []).forEach((r) => encontrados.add(r.telefone));
    }
    return new Response(JSON.stringify({ telefones: [...encontrados] }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.error("[khronus-fila-status] erro:", e.message);
    return new Response(JSON.stringify({ erro: e.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
