// Edge Function PÚBLICA (verify_jwt=false): devolve só agregados do mapa,
// sem nenhum dado pessoal. A agregação roda inteira dentro do banco via a
// RPC mapa_agregado (migration 071) — antes buscava linhas cruas via
// PostgREST, que tem limite padrão de 1000 linhas por resposta e ignorava
// silenciosamente o .limit(5000) do lado do cliente, fazendo a soma por
// estado ficar sempre menor que o total real quando passava de 1000 vendas.
// Aceita ?from=YYYY-MM-DD&to=YYYY-MM-DD opcionais.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // "-03:00" explícito: sem isso, o Postgres interpreta o horário como UTC
    // (fuso da sessão), não como horário de Brasília. Uma venda das 21h30 de
    // ontem (Brasília) já é 00h30 UTC de hoje, cai do lado errado do corte e
    // aparece no filtro do dia errado.
    const { data, error } = await sb.rpc("mapa_agregado", {
      p_from: from ? `${from}T00:00:00-03:00` : null,
      p_to:   to   ? `${to}T23:59:59-03:00`   : null,
    });
    if (error) throw error;

    return new Response(
      JSON.stringify(data),
      { headers: { ...cors, "content-type": "application/json", "cache-control": "public, max-age=300" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
});
