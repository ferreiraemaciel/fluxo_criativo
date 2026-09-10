/**
 * trafego-publico
 * Leitura do Tráfego para quem tem o link do pico (pico.html?t=TOKEN).
 *
 * Por que existe: o Samuel Rezende (mentor do Fluxo) acompanha o pico por esse
 * link e pediu para ver também o Tráfego. Dar login no Tracker entregaria
 * vendas, conversas e financeiro (as policies são `authenticated` com
 * `using(true)`), então esta função segue o mesmo desenho da pico-publico:
 * valida o token do pico e devolve só números de anúncio, sempre somente leitura.
 *
 * O que sai daqui: campanha, conjunto e anúncio com as métricas de cada período
 * (hoje, 3, 5, 7 dias e total) e a miniatura do criativo. Vendas e receita vêm
 * da Hotmart pelo rastreio do anúncio (vendas.meta_ad_id), mesma regra da aba
 * Tráfego desde 10/09/2026. Nenhum dado de comprador sai do servidor: da tabela
 * vendas só se lê o ID do anúncio, a data, o valor e se é complemento.
 *
 * Uso: GET /trafego-publico?t=TOKEN   Revogar: trocar o token_publico do pico.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const PERIODOS = ["hoje", "3d", "5d", "7d", "maximum"];
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;

type Linha = Record<string, any>;
type Venda = { dia: string; valor: number; bump: boolean };

// Métricas de um conjunto de linhas do cache (um anúncio, ou todos de um grupo),
// sempre recalculadas a partir dos totais, nunca média das razões.
function metricas(pares: { row: Linha; vendas: Venda[] }[]) {
  const ok = pares.filter((p) => p.row && Number(p.row.gasto) > 0);
  if (!ok.length) return null;
  let gasto = 0, impr = 0, cliques = 0, lp = 0, init = 0, vendas = 0, receita = 0, vendasMeta = 0;
  let cpmW = 0, ctrW = 0, freqW = 0, conW = 0, hookW = 0;
  for (const { row, vendas: vs } of ok) {
    const g = Number(row.gasto) || 0;
    gasto += g;
    impr += Number(row.impressoes) || 0;
    cliques += Number(row.link_clicks) || 0;
    lp += Number(row.landing_page_views) || 0;
    init += Number(row.initiate_checkout) || 0;
    vendasMeta += Number(row.compras) || 0;
    vendas += vs.filter((v) => !v.bump).length;
    receita += vs.reduce((t, v) => t + v.valor, 0);
    cpmW += (Number(row.cpm) || 0) * g;
    ctrW += (Number(row.ctr_unico) || 0) * g;
    freqW += (Number(row.frequencia) || 0) * g;
    conW += (Number(row.connect_rate) || 0) * g;
    hookW += (Number(row.hook_rate) || 0) * g;
  }
  return {
    gasto: r2(gasto),
    vendas,
    vendas_meta: vendasMeta,
    cpa: vendas > 0 ? r2(gasto / vendas) : null,
    cpa_mais1: r2(gasto / (vendas + 1)),
    cpc: cliques > 0 ? r2(gasto / cliques) : null,
    cpm: r2(cpmW / gasto),
    ctr: r4(ctrW / gasto),
    impressoes: impr,
    hook_rate: r4(hookW / gasto),
    lp_views: lp,
    custo_lp: lp > 0 ? r2(gasto / lp) : null,
    init_check: init,
    custo_init: init > 0 ? r2(gasto / init) : null,
    connect: r4(conW / gasto),
    freq: r2(freqW / gasto),
    roas: r2(receita / gasto),
  };
}

function miniatura(ad: Linha | undefined): string | null {
  if (!ad) return null;
  if (ad.thumb_url) return ad.thumb_url;
  let files: any[] = [];
  try { files = Array.isArray(ad.media_files) ? ad.media_files : (ad.media_files ? JSON.parse(ad.media_files) : []); } catch { /* sem mídia */ }
  const img = files.find((f) => f?.tipo === "imagem" && f.file_id) || files.find((f) => f?.file_id);
  return img ? `https://drive.google.com/thumbnail?id=${img.file_id}&sz=w200` : null;
}

// ── Análise de campanhas (a última gerada, a mesma que aparece na aba Tráfego) ──
// Copia só os campos listados aqui, um por um. A análise hoje não tem dado de
// comprador, mas o link é público: se um campo novo entrar nela no futuro, ele
// fica fora daqui até alguém decidir que pode sair.
const pick = (o: any, ks: string[]) =>
  Object.fromEntries(ks.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));
const lista = (a: any, ks: string[]) => (Array.isArray(a) ? a.map((x: any) => pick(x, ks)) : []);

function limparAnalise(v: any, mini: Record<string, string | null>) {
  const comMini = (arr: any[], chave = "numero") => arr.map((r) => ({ ...r, miniatura: mini[r[chave]] || null }));
  const orc = v.orcamento_receita;
  return {
    gerado_em: v.gerado_em || null,
    gerado_em_brasilia: v.gerado_em_brasilia || null,
    resumo_por_produto: Object.fromEntries(Object.entries(v.resumo_por_produto || {}).map(([prod, r]: any) => [prod, {
      ...pick(r, ["ativos", "gasto_5d", "vendas_5d", "gasto_total_ativos", "vendas_total_ativos"]),
      perto_de_pausar: lista(r.perto_de_pausar, ["numero", "titulo", "produto", "gasto_5d", "vendas_5d", "cpa_3d", "cpa_5d", "motivo"]),
    }])),
    radar: {
      pendentes: comMini(lista(v.radar_regras?.pendentes_em_ads_ativos, ["ads_numero", "regra_codigo", "mensagem"]), "ads_numero"),
      pausas_14d: comMini(lista(v.radar_regras?.resolvidos_14d, ["created_at", "ads_numero", "regra_codigo", "mensagem"]), "ads_numero"),
      orfaos: Number(v.radar_regras?.pendentes_orfaos_count) || 0,
    },
    funil: comMini(lista(v.funil, ["numero", "titulo", "produto", "ctr_7d", "gargalo", "gargalo_detalhe"])),
    aviso_hot_cold: v.leitura_vtsd?.aviso_hot_cold || null,
    fadiga: comMini(lista(v.fadiga, ["numero", "titulo", "produto", "frequencia_7d"])),
    candidatos_escala: comMini(lista(v.candidatos_escala, ["numero", "titulo", "produto", "cpa_historico", "vendas_total"])),
    lifecycle: {
      rodando_45d: comMini(lista(v.lifecycle?.ativos_rodando_45d_ou_mais, ["numero", "titulo", "produto", "dias_rodando"])),
      campeoes: comMini(lista(v.lifecycle?.campeoes_atuais, ["numero", "titulo", "produto", "cpa_historico", "vendas_total"])),
      arquivados: comMini(lista(v.lifecycle?.arquivados_reativaveis, ["numero", "titulo", "produto", "tag", "cpa_historico"])),
    },
    orcamento: orc ? {
      ...pick(orc, ["janela_vendas", "dias_restantes_no_mes", "receita_sem_atribuicao_na_janela"]),
      por_produto: Object.fromEntries(Object.entries(orc.por_produto || {}).map(([prod, x]: any) => [prod, pick(x, [
        "ativos_hoje", "media_diaria_5d", "projecao_resto_do_mes", "receita_liquida_janela", "n_vendas_janela",
        "gasto_estimado_mesma_janela", "roas_vida_ativos", "receita_vida_ativos", "gasto_vida_ativos",
        "aviso_gasto_estimado", "vendas_total_vida_ativos_meta", "n_vendas_vida_ativos_hotmart",
      ])])),
    } : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const token = new URL(req.url).searchParams.get("t") || "";
  // Token curto demais nem chega ao banco: evita varredura por tentativa.
  if (token.length < 32) return json({ erro: "link inválido" }, 401);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: projeto } = await db.from("pico_projetos").select("id,cpa_limite").eq("token_publico", token).maybeSingle();
  if (!projeto) return json({ erro: "link inválido ou revogado" }, 401);

  const [{ data: cache, error: e1 }, { data: ads, error: e2 }] = await Promise.all([
    db.from("insights_cache")
      .select("meta_ad_id,meta_campaign_id,meta_campaign_name,meta_adset_id,meta_adset_name,periodo,data_inicio,data_fim,gasto,compras,impressoes,link_clicks,landing_page_views,initiate_checkout,cpm,ctr_unico,frequencia,connect_rate,hook_rate,atualizado_em")
      .eq("status_meta", "ativo").in("periodo", PERIODOS),
    db.from("ads").select("numero,titulo,meta_ad_id,thumb_url,media_files,media_tipo").not("meta_ad_id", "is", null),
  ]);
  if (e1 || e2) return json({ erro: "Não foi possível ler os dados agora." }, 500);

  // Vendas aprovadas da Hotmart com anúncio, página por página (limite de 1000).
  const vendasPorAd: Record<string, Venda[]> = {};
  for (let pag = 0; pag < 50; pag++) {
    const { data: vs, error } = await db.from("vendas")
      .select("meta_ad_id,created_at,valor_bruto,is_order_bump")
      .eq("status", "aprovada").not("meta_ad_id", "is", null)
      .range(pag * 1000, pag * 1000 + 999);
    if (error) return json({ erro: "Não foi possível ler as vendas agora." }, 500);
    for (const v of vs || []) {
      const dia = new Date(new Date(v.created_at).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
      (vendasPorAd[v.meta_ad_id] ||= []).push({ dia, valor: Number(v.valor_bruto) || 0, bump: !!v.is_order_bump });
    }
    if (!vs || vs.length < 1000) break;
  }
  const naJanela = (row: Linha): Venda[] =>
    (vendasPorAd[row.meta_ad_id] || []).filter((v) =>
      row.periodo === "maximum" || !row.data_inicio || (v.dia >= row.data_inicio && v.dia <= (row.data_fim || row.data_inicio)));

  const adPorId = Object.fromEntries((ads || []).map((a) => [a.meta_ad_id, a]));

  // Só entra anúncio que está rodando agora: o meta-sync reconcilia os períodos
  // curtos de anúncio parado (apaga ou marca "pausado"), mas a linha "maximum"
  // de anúncio parado continua com status_meta "ativo". Sem esse filtro,
  // campanhas encerradas apareciam com dado só no Total.
  const rodando = new Set((cache || []).filter((r) => r.periodo !== "maximum").map((r) => r.meta_ad_id));

  // campanha > conjunto > anúncio > período
  const camps: Record<string, any> = {};
  let atualizado = "";
  for (const row of (cache || []).filter((r) => rodando.has(r.meta_ad_id))) {
    if (row.atualizado_em > atualizado) atualizado = row.atualizado_em;
    const c = (camps[row.meta_campaign_id] ||= { id: row.meta_campaign_id, nome: row.meta_campaign_name, conjuntos: {} });
    const s = (c.conjuntos[row.meta_adset_id] ||= { id: row.meta_adset_id, nome: row.meta_adset_name, anuncios: {} });
    const a = (s.anuncios[row.meta_ad_id] ||= { id: row.meta_ad_id, linhas: {} });
    a.linhas[row.periodo] = row;
  }

  const porPeriodo = (linhas: Linha[]) =>
    Object.fromEntries(PERIODOS.map((p) => [p,
      metricas(linhas.map((l) => l[p]).filter(Boolean).map((row: Linha) => ({ row, vendas: naJanela(row) })))]));

  const campanhas = Object.values(camps).map((c: any) => {
    const conjuntos = Object.values(c.conjuntos).map((s: any) => {
      const anuncios = Object.values(s.anuncios).map((a: any) => {
        const info = adPorId[a.id];
        return {
          numero: info?.numero ?? null,
          titulo: info?.titulo || null,
          miniatura: miniatura(info),
          video: ["reels", "video"].includes(info?.media_tipo),
          periodos: porPeriodo([a.linhas]),
        };
      }).sort((x: any, y: any) => (y.periodos.maximum?.gasto || 0) - (x.periodos.maximum?.gasto || 0));
      return { nome: s.nome, periodos: porPeriodo(Object.values(s.anuncios).map((a: any) => a.linhas)), anuncios };
    });
    const todas = conjuntos.length ? Object.values(c.conjuntos).flatMap((s: any) => Object.values(s.anuncios).map((a: any) => a.linhas)) : [];
    // Limite de CPA das regras do Tracker (G5): R$ 207,90 no MCV. Nas outras
    // campanhas não há limite definido, então o CPA vai sem cor.
    const limite = /^MCV/i.test(c.nome || "") ? (Number(projeto.cpa_limite) || 207.9) : null;
    return { nome: c.nome, limite, periodos: porPeriodo(todas), conjuntos };
  }).sort((x: any, y: any) => (y.periodos["7d"]?.gasto || 0) - (x.periodos["7d"]?.gasto || 0));

  const miniPorNumero: Record<string, string | null> = {};
  for (const a of ads || []) if (a.numero != null) miniPorNumero[a.numero] = miniatura(a);
  const { data: cfg } = await db.from("app_config").select("valor").eq("chave", "analise_campanhas_ultima").maybeSingle();
  const analise = cfg?.valor?.gerado_em ? limparAnalise(cfg.valor, miniPorNumero) : null;

  return json({ atualizado_em: atualizado || null, cpa_limite: Number(projeto.cpa_limite) || null, campanhas, analise });
});
