/**
 * pico-publico
 *
 * Link de leitura do planejamento de um pico, para alguém de fora acompanhar
 * sem ter login no Tracker.
 *
 * Por que existe: as policies do Tracker são `authenticated` com `using(true)`,
 * então qualquer usuário logado leria vendas, conversas e financeiro pela API.
 * Dar login a um convidado seria dar a chave da casa. Esta função devolve
 * apenas o que é do pico, sempre somente leitura, validada por token.
 *
 * Devolve o mesmo que o dono ve na aba, menos o que e de outras areas do
 * Tracker: nada de vendas individuais, conversas ou dado de comprador.
 *
 * Uso: GET /pico-publico?t=TOKEN
 * Revogar: trocar ou apagar `token_publico` do projeto.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = new URL(req.url).searchParams.get("t") || "";
  // Token curto demais nem chega ao banco: evita varredura por tentativa.
  if (token.length < 32) {
    return new Response(JSON.stringify({ erro: "link inválido" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: projeto } = await db
    .from("pico_projetos")
    .select("id,nome,data_abertura,data_encerramento,status,nivel_operacao,plano_midia,ticket,cpa_limite,observacoes,declaracoes")
    .eq("token_publico", token)
    .maybeSingle();

  if (!projeto) {
    return new Response(JSON.stringify({ erro: "link inválido ou revogado" }), {
      status: 401, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const [tarefas, decisoes, ads, metricas, bib] = await Promise.all([
    db.from("pico_tarefas")
      .select("id,fase,trilha,titulo,criterio_pronto,offset_dias,data_prevista,status,nivel_minimo,campos,definicoes,referencias,observacoes")
      .eq("projeto_id", projeto.id)
      .order("offset_dias").order("ordem"),
    db.from("pico_decisoes")
      .select("chave,pergunta,opcoes,escolha,regra,fonte,explicacoes,ordem")
      .eq("projeto_id", projeto.id)
      .order("ordem"),
    db.from("ads")
      .select("numero,titulo,status,meta_ad_id")
      .eq("pico_projeto_id", projeto.id),
    db.from("pico_metricas")
      .select("momento,cenario,indicador,valor,unidade")
      .eq("projeto_id", projeto.id),
    db.from("pico_biblioteca")
      .select("categoria,titulo,url,tipo,nota,ordem")
      .order("ordem"),
  ]);

  // Gasto dos anúncios deste pico. Nada de vendas nem de dado de comprador:
  // quem acompanha de fora vê o plano e o consumo de verba, não o financeiro.
  let gasto = 0, compras = 0;
  let porAnuncio: Array<Record<string, unknown>> = [];
  const ids = (ads.data || []).map((a) => a.meta_ad_id).filter(Boolean);
  if (ids.length) {
    const { data: ins } = await db.from("insights_cache")
      .select("meta_ad_id,gasto,compras").eq("periodo", "maximum").in("meta_ad_id", ids);
    const mapa = Object.fromEntries((ins || []).map((i) => [i.meta_ad_id, i]));
    porAnuncio = (ads.data || []).map((a) => ({
      numero: a.numero, titulo: a.titulo, status: a.status,
      gasto: Number(mapa[a.meta_ad_id!]?.gasto) || 0,
      compras: Number(mapa[a.meta_ad_id!]?.compras) || 0,
    })).sort((x, y) => (y.gasto as number) - (x.gasto as number));
    gasto   = porAnuncio.reduce((a, x) => a + (x.gasto as number), 0);
    compras = porAnuncio.reduce((a, x) => a + (x.compras as number), 0);
  }

  return new Response(JSON.stringify({
    projeto,
    tarefas: tarefas.data || [],
    decisoes: decisoes.data || [],
    metricas: metricas.data || [],
    anuncios: (ads.data || []).length,
    porAnuncio,
    gasto,
    compras,
    biblioteca: bib.data || [],
      lido_em: new Date().toISOString(),
  }), {
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});
