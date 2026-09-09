// Tracker FMN — Análise de campanhas, direto do Supabase (nunca da Graph API do
// Meta, nunca do Notion). O Tracker já sincroniza tudo sozinho (meta-sync,
// kanban-sync) e já roda as regras G1-G7 de pausa automática; esta function só
// lê o que já está lá e devolve um diagnóstico calculado, pronto pro botão
// "Analisar campanhas" da aba Tráfego renderizar.
//
// POST /functions/v1/analise-campanhas   (sem corpo obrigatório)
//
// Porta de volta pra dentro do Tracker a lógica que nasceu como script Python
// em fluxo-criativo/.claude/skills/tracker-analise-campanhas (histórico das
// correções e o porquê de cada uma está lá, no CLAUDE.md do tracker-fmn e no
// commit que trouxe essa function). Zero chamada a modelo de IA aqui dentro,
// é tudo cálculo determinístico sobre dado já sincronizado.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function supa() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const PAGINA = 1000;

// O PostgREST/supabase-js corta em 1000 linhas por padrão. `.range()` pagina
// de verdade (ver CLAUDE.md do tracker-fmn, "O corte de 1.000 linhas").
async function buscarTudo<T>(montar: (de: number, ate: number) => any): Promise<T[]> {
  const linhas: T[] = [];
  let de = 0;
  while (true) {
    const { data, error } = await montar(de, de + PAGINA - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    linhas.push(...(data as T[]));
    if (data.length < PAGINA) break;
    de += PAGINA;
  }
  return linhas;
}

function batched<T>(seq: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < seq.length; i += n) out.push(seq.slice(i, i + n));
  return out;
}

function num(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : def;
}

const BR_TZ = "America/Sao_Paulo";

function fmtBrData(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? iso + "T00:00:00Z" : iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(d);
}

function diasDoPeriodo(p: { data_inicio?: string; data_fim?: string } | undefined): number {
  if (!p?.data_inicio || !p?.data_fim) return 0;
  const ini = new Date(p.data_inicio + "T00:00:00Z");
  const fim = new Date(p.data_fim + "T00:00:00Z");
  return Math.round((fim.getTime() - ini.getTime()) / 86400000);
}

/* ───────────────────────── Tipos ───────────────────────── */

type Ad = {
  numero: number; titulo: string; tipo: string; status: string; produto: string | null;
  tag: string | null; meta_ad_id: string | null; meta_campaign_id: string | null;
  meta_adset_id: string | null; gasto_total: number | null; vendas_total: number | null;
  cpa_historico: number | null; gasto_3d: number | null; vendas_3d: number | null;
  cpa_3d: number | null; gasto_5d: number | null; vendas_5d: number | null; cpa_5d: number | null;
  isento_regra: string | null; observacoes: string | null; posicionamento: string[] | null;
  created_at: string; updated_at: string;
};

type Insight = {
  meta_ad_id: string; meta_ad_name: string | null; meta_adset_id: string | null;
  meta_campaign_id: string | null; meta_campaign_name: string | null; periodo: string;
  data_inicio: string | null; data_fim: string | null; gasto: number | null;
  impressoes: number | null; cliques: number | null; link_clicks: number | null;
  landing_page_views: number | null; compras: number | null; valor_compras: number | null;
  initiate_checkout: number | null; cpa: number | null; roas: number | null;
  ctr_unico: number | null; cpm: number | null; frequencia: number | null;
  connect_rate: number | null; conv_pagina: number | null; checkout_rate: number | null;
  hook_rate: number | null; hold_rate: number | null; status_meta: string | null;
  atualizado_em: string | null;
};

type Alerta = {
  id: string; ads_numero: number | null; meta_ad_id: string | null; regra_codigo: string;
  mensagem: string; acao_tomada: string | null; created_at: string;
};

/* ─────────────────────── Funil + leitura VTSD ─────────────────────── */

function diagnosticoFunil(p7: Insight | undefined, p30: Insight | undefined) {
  if (!p7 || num(p7.cliques) === 0) {
    return { gargalo: "sem_dado", detalhe: "Sem clique suficiente no período pra avaliar o funil.", leitura: null as string | null };
  }
  const ctr = num(p7.ctr_unico);
  const connect = num(p7.connect_rate);
  const convPagina = num(p7.conv_pagina);
  const checkoutRate = p7.checkout_rate == null ? null : num(p7.checkout_rate);

  if (connect && connect < 0.5) {
    return { gargalo: "gargalo_pagina", detalhe: `Connect rate baixo (${(connect * 100).toFixed(0)}%), o link foi clicado mas a página não carrega bem ou demora.`, leitura: null };
  }
  if (convPagina && convPagina < 0.01 && num(p7.landing_page_views) > 50) {
    return { gargalo: "gargalo_conversao", detalhe: `Muita visita na página (${Math.trunc(num(p7.landing_page_views))}) e poucas compras, a oferta ou a copy da página é o gargalo.`, leitura: null };
  }
  if (checkoutRate !== null && num(p7.initiate_checkout) > 5 && checkoutRate < 0.3) {
    return { gargalo: "gargalo_checkout", detalhe: `Inicia checkout mas não termina (${(checkoutRate * 100).toFixed(0)}% de conclusão), travou no pagamento.`, leitura: null };
  }
  if (ctr && ctr < 0.01) {
    // Leitura VTSD: "esgotou" (Urgência Oculta esgotou, CTR já foi bom e caiu) x
    // "nunca decolou" (CTR sempre baixo). Usa 30d, nunca "maximum": esse período
    // reflete a vida do meta_ad_id atual, tão curto quanto os 7 dias se o
    // anúncio foi relançado com número novo recentemente.
    const dias30d = diasDoPeriodo(p30);
    const ctr30d = p30 ? num(p30.ctr_unico) : null;
    if (dias30d < 20) {
      return { gargalo: "gargalo_criativo", leitura: "sem_comparacao_confiavel",
        detalhe: `CTR baixo (${(ctr * 100).toFixed(2)}%), mas esse anúncio só tem ${dias30d} dias de histórico disponível, pouco pra dizer se é fadiga ou se nunca decolou.` };
    }
    if (ctr30d && ctr30d >= 0.015 && ctr < ctr30d * 0.7) {
      return { gargalo: "gargalo_criativo", leitura: "esgotou",
        detalhe: `CTR caiu de ${(ctr30d * 100).toFixed(2)}% (30 dias) pra ${(ctr * 100).toFixed(2)}% agora, a Urgência Oculta desse criativo esgotou com esse público.` };
    }
    return { gargalo: "gargalo_criativo", leitura: "nunca_decolou",
      detalhe: `CTR baixo (${(ctr * 100).toFixed(2)}%) e nunca foi muito melhor que isso nos últimos ${dias30d} dias, essa Urgência Oculta nunca decolou com esse público, não é fadiga.` };
  }
  return { gargalo: "saudavel", detalhe: "Funil sem gargalo evidente no período.", leitura: null };
}

/* ─────────────────────────── Handler ─────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "Método não permitido" }, 405);
  }

  try {
    const sb = supa();
    const agora = new Date();
    const desde30d = new Date(agora.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const desde14d = new Date(agora.getTime() - 14 * 86400000).toISOString().slice(0, 10);

    const camposAds = "numero,titulo,tipo,status,produto,tag,meta_ad_id,meta_campaign_id," +
      "meta_adset_id,gasto_total,vendas_total,cpa_historico,gasto_3d,vendas_3d,cpa_3d," +
      "gasto_5d,vendas_5d,cpa_5d,isento_regra,observacoes,posicionamento,created_at,updated_at";

    const [adsAtivos, adsCampeoes, adsArquivados, regrasAtp, adsNumeroProduto] = await Promise.all([
      buscarTudo<Ad>((de, ate) => sb.from("ads").select(camposAds).eq("status", "ativo").range(de, ate)),
      buscarTudo<Ad>((de, ate) => sb.from("ads").select(camposAds).eq("status", "campeoes").range(de, ate)),
      buscarTudo<Ad>((de, ate) => sb.from("ads").select(camposAds).eq("status", "arquivado").order("updated_at", { ascending: false }).range(de, ate)),
      buscarTudo<{ codigo: string; nome: string; ativo: boolean; parametros: any }>((de, ate) => sb.from("regras_atp").select("codigo,nome,ativo,parametros").range(de, ate)),
      buscarTudo<{ numero: number; produto: string | null; meta_ad_id: string | null }>((de, ate) => sb.from("ads").select("numero,produto,meta_ad_id").range(de, ate)),
    ]);

    const metaAdIds = adsAtivos.map((a) => a.meta_ad_id).filter((x): x is string => !!x);
    const periodos = ["maximum", "3d", "5d", "7d", "14d", "30d"];
    const insightsCache: Insight[] = [];
    for (const lote of batched(metaAdIds, 100)) {
      if (lote.length === 0) continue;
      const parte = await buscarTudo<Insight>((de, ate) => sb.from("insights_cache")
        .select("meta_ad_id,meta_ad_name,meta_adset_id,meta_campaign_id,meta_campaign_name," +
          "periodo,data_inicio,data_fim,gasto,impressoes,cliques,link_clicks,landing_page_views," +
          "compras,valor_compras,initiate_checkout,cpa,roas,ctr_unico,cpm,frequencia,connect_rate," +
          "conv_pagina,checkout_rate,hook_rate,hold_rate,status_meta,atualizado_em")
        .in("meta_ad_id", lote).in("periodo", periodos).range(de, ate));
      insightsCache.push(...parte);
    }

    const [alertasPendentes, alertasResolvidos14d, vendas30d] = await Promise.all([
      buscarTudo<Alerta>((de, ate) => sb.from("alertas").select("id,ads_numero,meta_ad_id,regra_codigo,mensagem,acao_tomada,created_at")
        .eq("resolvido", false).order("created_at", { ascending: false }).range(de, ate)),
      buscarTudo<Alerta>((de, ate) => sb.from("alertas").select("id,ads_numero,meta_ad_id,regra_codigo,mensagem,acao_tomada,created_at")
        .eq("resolvido", true).gte("created_at", desde14d).order("created_at", { ascending: false }).range(de, ate)),
      buscarTudo<{ ads_numero: number | null; produto_nome: string | null; valor_liquido: number | null; created_at: string }>(
        (de, ate) => sb.from("vendas").select("ads_numero,produto_nome,valor_liquido,created_at")
          .eq("status", "aprovada").gte("created_at", desde30d).range(de, ate)),
    ]);

    const numerosAtivos = adsAtivos.map((a) => a.numero);
    let vendasVidaAtivos: { ads_numero: number | null; valor_liquido: number | null }[] = [];
    for (const lote of batched(numerosAtivos, 150)) {
      if (lote.length === 0) continue;
      const parte = await buscarTudo<{ ads_numero: number | null; valor_liquido: number | null }>(
        (de, ate) => sb.from("vendas").select("ads_numero,valor_liquido").eq("status", "aprovada").in("ads_numero", lote).range(de, ate));
      vendasVidaAtivos.push(...parte);
    }

    /* ───────────── Parâmetros por produto (ticket, CPA limite) ───────────── */
    const params: Record<string, { ticket: number; cpa_limite: number }> = {
      MCV: { ticket: 297, cpa_limite: 207.9 },
      BLI: { ticket: 397, cpa_limite: 277.9 },
    };
    for (const r of regrasAtp) {
      const porProduto = r.parametros?.por_produto || {};
      for (const [produto, vals] of Object.entries<any>(porProduto)) {
        if (!params[produto]) params[produto] = { ticket: 0, cpa_limite: 0 };
        if (vals.cpa_limite != null) params[produto].cpa_limite = vals.cpa_limite;
        if (vals.ticket != null) params[produto].ticket = vals.ticket;
      }
    }

    /* ───────────── Índices auxiliares ───────────── */
    const insightsIdx = new Map<string, Map<string, Insight>>();
    for (const row of insightsCache) {
      if (!insightsIdx.has(row.meta_ad_id)) insightsIdx.set(row.meta_ad_id, new Map());
      insightsIdx.get(row.meta_ad_id)!.set(row.periodo, row);
    }
    const numeroProduto = new Map<number, string>();
    for (const a of adsNumeroProduto) numeroProduto.set(a.numero, a.produto || "MCV");
    const metaAdIdParaNumero = new Map<string, number>();
    for (const a of adsNumeroProduto) if (a.meta_ad_id) metaAdIdParaNumero.set(a.meta_ad_id, a.numero);

    function resolverNumero(al: Alerta): number | null {
      if (al.ads_numero != null) return al.ads_numero;
      return al.meta_ad_id ? metaAdIdParaNumero.get(al.meta_ad_id) ?? null : null;
    }
    for (const al of [...alertasPendentes, ...alertasResolvidos14d]) (al as any).ads_numero = resolverNumero(al);

    const numerosAtivosSet = new Set(numerosAtivos);
    const pendentesRelevantes = alertasPendentes.filter((a) => a.ads_numero != null && numerosAtivosSet.has(a.ads_numero));
    const pendentesOrfaosCount = alertasPendentes.length - pendentesRelevantes.length;

    /* ───────────── Resumo por produto + radar + funil + fadiga/escala + lifecycle ───────────── */
    type Resumo = { ativos: number; gastoTotal: number; vendas5d: number; gastoTotalAtivos: number; vendasTotalAtivos: number; pertoDePausar: any[] };
    const resumo = new Map<string, Resumo>();
    const funilRows: any[] = [];
    const fadiga: any[] = [];
    const escala: any[] = [];
    const lifecycleAntigos: any[] = [];
    const quaseDisparando: any[] = [];

    for (const ad of adsAtivos) {
      const produto = ad.produto || "MCV";
      const p = params[produto] || params.MCV;
      if (!resumo.has(produto)) resumo.set(produto, { ativos: 0, gastoTotal: 0, vendas5d: 0, gastoTotalAtivos: 0, vendasTotalAtivos: 0, pertoDePausar: [] });
      const r = resumo.get(produto)!;
      r.ativos += 1;
      r.gastoTotal += num(ad.gasto_5d);
      r.vendas5d += Number(ad.vendas_5d || 0);
      r.gastoTotalAtivos += num(ad.gasto_total);
      r.vendasTotalAtivos += Number(ad.vendas_total || 0);

      const gasto5d = num(ad.gasto_5d);
      const vendas5d = Number(ad.vendas_5d || 0);
      const cpaLimite = p.cpa_limite;
      let statusRegra = "saudavel";
      let motivo: string | null = null;
      if (vendas5d === 0 && gasto5d >= p.ticket * 0.7) {
        statusRegra = "risco_g1";
        motivo = `Gastou R$${gasto5d.toFixed(2)} em 5 dias sem nenhuma venda (G1 dispara a R$${p.ticket.toFixed(2)}).`;
      } else if (ad.cpa_3d != null && ad.cpa_5d != null && num(ad.cpa_3d) >= cpaLimite && num(ad.cpa_5d) >= cpaLimite) {
        statusRegra = "risco_g5";
        motivo = `CPA 3d (R$${num(ad.cpa_3d).toFixed(2)}) e 5d (R$${num(ad.cpa_5d).toFixed(2)}) já acima do limite R$${cpaLimite.toFixed(2)}, G5 deve pausar no próximo ciclo.`;
      } else if (ad.cpa_3d != null && num(ad.cpa_3d) >= cpaLimite * 0.85) {
        statusRegra = "atencao";
        motivo = `CPA 3d (R$${num(ad.cpa_3d).toFixed(2)}) chegando perto do limite R$${cpaLimite.toFixed(2)}.`;
      }
      const item = { numero: ad.numero, titulo: ad.titulo, produto, gasto_5d: gasto5d, vendas_5d: vendas5d, cpa_3d: ad.cpa_3d, cpa_5d: ad.cpa_5d, motivo };
      if (statusRegra === "risco_g1" || statusRegra === "risco_g5") { r.pertoDePausar.push(item); quaseDisparando.push(item); }
      else if (statusRegra === "atencao") { quaseDisparando.push(item); }

      const insPorPeriodo = insightsIdx.get(ad.meta_ad_id || "") || new Map<string, Insight>();
      const p7 = insPorPeriodo.get("7d");
      const p30 = insPorPeriodo.get("30d");
      const pmax = insPorPeriodo.get("maximum");
      const diag = diagnosticoFunil(p7, p30);
      funilRows.push({
        numero: ad.numero, titulo: ad.titulo, produto,
        roas_7d: p7?.roas ?? null, cpa_7d: p7?.cpa ?? null, ctr_7d: p7?.ctr_unico ?? null,
        ctr_30d: p30?.ctr_unico ?? null, leitura_vtsd: diag.leitura,
        connect_rate_7d: p7?.connect_rate ?? null, checkout_rate_7d: p7?.checkout_rate ?? null,
        gargalo: diag.gargalo, gargalo_detalhe: diag.detalhe,
      });

      const freq7 = p7 ? num(p7.frequencia) : 0;
      const ctr7 = p7 ? num(p7.ctr_unico) : 0;
      const ctr30 = p30 ? num(p30.ctr_unico) : 0;
      if (freq7 >= 2.5 && ctr30 && ctr7 < ctr30 * 0.7) {
        fadiga.push({ numero: ad.numero, titulo: ad.titulo, produto, frequencia_7d: freq7, ctr_7d: ctr7, ctr_30d: ctr30 });
      }
      const cpaHist = ad.cpa_historico;
      if (cpaHist != null && num(cpaHist) > 0 && num(cpaHist) < cpaLimite * 0.75 && Number(ad.vendas_total || 0) >= 3 && freq7 < 2.0) {
        escala.push({ numero: ad.numero, titulo: ad.titulo, produto, cpa_historico: cpaHist, vendas_total: ad.vendas_total, frequencia_7d: freq7 });
      }

      // Idade do ad_id ATUAL (insights_cache periodo=maximum), nunca ads.created_at:
      // um lote inteiro de cards teve created_at idêntico até o milissegundo
      // (11/06/2026, prova de importação em massa no banco), sem relação com a
      // idade real do criativo no Meta.
      const diasAdAtual = diasDoPeriodo(pmax);
      if (pmax && diasAdAtual >= 45) {
        lifecycleAntigos.push({ numero: ad.numero, titulo: ad.titulo, produto, dias_rodando: diasAdAtual });
      }
    }

    const campeoes = adsCampeoes.map((a) => ({ numero: a.numero, titulo: a.titulo, produto: a.produto || "MCV", cpa_historico: a.cpa_historico, vendas_total: a.vendas_total }));
    const reativaveis = adsArquivados
      .filter((a) => a.tag === "Ótimo" || a.tag === "Mediano")
      .map((a) => ({ numero: a.numero, titulo: a.titulo, produto: a.produto || "MCV", tag: a.tag, cpa_historico: a.cpa_historico, vendas_total: a.vendas_total, updated_at: a.updated_at }));

    /* ───────────── Orçamento & receita real ───────────── */
    const receitaJanela = new Map<string, number>();
    const nVendasJanela = new Map<string, number>();
    for (const v of vendas30d) {
      const prod = v.ads_numero != null ? numeroProduto.get(v.ads_numero) : undefined;
      const chave = prod || "sem_atribuicao";
      receitaJanela.set(chave, (receitaJanela.get(chave) || 0) + num(v.valor_liquido));
      nVendasJanela.set(chave, (nVendasJanela.get(chave) || 0) + 1);
    }
    const receitaVidaAtivos = new Map<string, number>();
    const nVendasVidaAtivos = new Map<string, number>();
    for (const v of vendasVidaAtivos) {
      const prod = (v.ads_numero != null ? numeroProduto.get(v.ads_numero) : undefined) || "MCV";
      receitaVidaAtivos.set(prod, (receitaVidaAtivos.get(prod) || 0) + num(v.valor_liquido));
      nVendasVidaAtivos.set(prod, (nVendasVidaAtivos.get(prod) || 0) + 1);
    }

    const hojeBR = new Date(agora.toLocaleString("en-US", { timeZone: BR_TZ }));
    const diasNoMes = new Date(hojeBR.getFullYear(), hojeBR.getMonth() + 1, 0).getDate();
    const diasRestantes = diasNoMes - hojeBR.getDate();

    const produtosConhecidos = Array.from(new Set([...Object.keys(params), ...resumo.keys(), ...receitaJanela.keys()]))
      .filter((p) => p !== "sem_atribuicao").sort();

    const porProduto: Record<string, any> = {};
    for (const produto of produtosConhecidos) {
      const r = resumo.get(produto) || { ativos: 0, gastoTotal: 0, vendas5d: 0, gastoTotalAtivos: 0, vendasTotalAtivos: 0, pertoDePausar: [] };
      const mediaDiaria5d = r.gastoTotal ? r.gastoTotal / 5 : 0;
      const gastoVidaAtivos = r.gastoTotalAtivos;
      const receitaVida = receitaVidaAtivos.get(produto) || 0;
      porProduto[produto] = {
        ativos_hoje: r.ativos,
        media_diaria_5d: Math.round(mediaDiaria5d * 100) / 100,
        projecao_resto_do_mes: Math.round(mediaDiaria5d * diasRestantes * 100) / 100,
        receita_liquida_janela: Math.round((receitaJanela.get(produto) || 0) * 100) / 100,
        n_vendas_janela: nVendasJanela.get(produto) || 0,
        gasto_estimado_mesma_janela: Math.round(mediaDiaria5d * 30 * 100) / 100,
        aviso_gasto_estimado: r.ativos
          ? "Estimativa a partir do ritmo dos últimos 5 dias (gasto_5d, confiável, por número do card), não é soma de gasto real dos últimos 30 dias, esse dado não existe com precisão no Tracker hoje."
          : "Nenhum anúncio ativo hoje, sem ritmo pra projetar.",
        gasto_vida_ativos: Math.round(gastoVidaAtivos * 100) / 100,
        receita_vida_ativos: Math.round(receitaVida * 100) / 100,
        n_vendas_vida_ativos_hotmart: nVendasVidaAtivos.get(produto) || 0,
        vendas_total_vida_ativos_meta: r.vendasTotalAtivos,
        roas_vida_ativos: gastoVidaAtivos ? Math.round((receitaVida / gastoVidaAtivos) * 100) / 100 : null,
      };
    }

    /* ───────────── Honestidade de datas + leitura VTSD consolidada ───────────── */
    function janelaDeclarada(periodo: string) {
      const pares: [string, string][] = [];
      for (const porPeriodo of insightsIdx.values()) {
        const row = porPeriodo.get(periodo);
        if (row?.data_inicio && row?.data_fim) pares.push([row.data_inicio, row.data_fim]);
      }
      if (pares.length === 0) return { inicio: null, fim: null, homogenea: true, n_anuncios: 0 };
      const contagem = new Map<string, number>();
      for (const [i, f] of pares) contagem.set(`${i}|${f}`, (contagem.get(`${i}|${f}`) || 0) + 1);
      const [chaveMaisComum] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
      const [ini, fim] = chaveMaisComum.split("|");
      return { inicio: fmtBrData(ini), fim: fmtBrData(fim), homogenea: contagem.size === 1, n_anuncios: pares.length };
    }
    const janelas = { "7d": janelaDeclarada("7d"), "30d": janelaDeclarada("30d"), maximum: janelaDeclarada("maximum") };

    const timestampsSync = insightsCache.map((r) => r.atualizado_em).filter((x): x is string => !!x);
    let frescor: any = { ultimo_sync: null, horas_desde_sync: null, pode_estar_desatualizado: null };
    if (timestampsSync.length > 0) {
      const ultimoSync = new Date(timestampsSync.sort().at(-1)!);
      const horas = (agora.getTime() - ultimoSync.getTime()) / 3600000;
      frescor = {
        ultimo_sync: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: BR_TZ }).format(ultimoSync),
        horas_desde_sync: Math.round(horas * 10) / 10,
        pode_estar_desatualizado: horas > 9,
      };
    }

    const contagemLeitura = { esgotou: 0, nunca_decolou: 0, sem_comparacao_confiavel: 0 };
    for (const f of funilRows) if (f.leitura_vtsd && f.leitura_vtsd in contagemLeitura) (contagemLeitura as any)[f.leitura_vtsd]++;

    const resultado = {
      gerado_em: agora.toISOString(),
      gerado_em_brasilia: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: BR_TZ }).format(agora),
      janelas_declaradas: janelas,
      frescor_dos_dados: frescor,
      leitura_vtsd: {
        ...contagemLeitura,
        aviso_hot_cold: "O Tracker não sincroniza o público/segmentação de cada conjunto (HOT/COLD/SUPERCOLD), só métrica agregada do anúncio. Não é possível classificar temperatura de público com este dado, só o funil e a fadiga do criativo.",
      },
      parametros_por_produto: params,
      resumo_por_produto: Object.fromEntries(
        [...resumo.entries()].map(([k, v]) => [k, {
          ativos: v.ativos, gasto_5d: Math.round(v.gastoTotal * 100) / 100, vendas_5d: v.vendas5d,
          gasto_total_ativos: Math.round(v.gastoTotalAtivos * 100) / 100, vendas_total_ativos: v.vendasTotalAtivos,
          perto_de_pausar: v.pertoDePausar,
        }])
      ),
      radar_regras: {
        pendentes_em_ads_ativos: pendentesRelevantes,
        pendentes_orfaos_count: pendentesOrfaosCount,
        resolvidos_14d: alertasResolvidos14d,
        quase_disparando: quaseDisparando,
      },
      funil: funilRows,
      fadiga,
      candidatos_escala: escala,
      lifecycle: {
        ativos_rodando_45d_ou_mais: lifecycleAntigos,
        campeoes_atuais: campeoes,
        arquivados_reativaveis: reativaveis,
        cobertura_arquivados: `Varre todo o histórico: ${adsArquivados.length} arquivados.`,
      },
      orcamento_receita: {
        janela_vendas: `${fmtBrData(desde30d)} a ${fmtBrData(agora.toISOString().slice(0, 10))}`,
        receita_sem_atribuicao_na_janela: Math.round((receitaJanela.get("sem_atribuicao") || 0) * 100) / 100,
        por_produto: porProduto,
        dias_restantes_no_mes: diasRestantes,
      },
    };

    return json(resultado);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
