// Edge Function PÚBLICA (verify_jwt=false): devolve os últimos compradores
// aprovados do MCV com o nome já mascarado (primeiro nome + inicial do
// sobrenome), sem nenhum outro dado pessoal (nunca e-mail, CPF, telefone,
// endereço ou nome completo saem do servidor). Roda com a service role key
// pra ler a tabela vendas (protegida por RLS pra authenticated apenas),
// mesmo padrão de mapa-publico.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const PRODUTO_ID_MCV = "3400278";

function titleCase(palavra) {
  return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
}

function mascararNome(nomeCompleto) {
  const partes = (nomeCompleto || "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "Fotógrafo(a)";
  const primeiro = titleCase(partes[0]);
  if (partes.length === 1) return primeiro;
  const inicialUltimo = partes[partes.length - 1][0].toUpperCase();
  return `${primeiro} ${inicialUltimo}.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 20);
    const sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

    const { data, error } = await sb
      .from("vendas")
      .select("comprador_nome, comprador_cidade, comprador_estado, hotmart_approved_date, created_at")
      .eq("produto_id", PRODUTO_ID_MCV)
      .eq("status", "aprovada")
      .not("comprador_cidade", "is", null)
      .not("comprador_estado", "is", null)
      .order("hotmart_approved_date", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw error;

    const compradores = (data || []).map((v) => ({
      nome: mascararNome(v.comprador_nome),
      cidade: v.comprador_cidade,
      estado: (v.comprador_estado || "").toUpperCase(),
    }));

    return new Response(
      JSON.stringify({ compradores }),
      { headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=300" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
