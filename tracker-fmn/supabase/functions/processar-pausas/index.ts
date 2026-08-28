// Tracker FMN — Executa pausas automáticas pendentes no Meta (nuvem)
// Endpoint: POST /functions/v1/processar-pausas
// Porta para a nuvem o que era processar_pausas_pendentes() em
// scripts/sync_insights.py no Mac (2026-07-05). Roda com frequência alta
// (é reação a alerta já computado, ex.: regra G5 de CPA) — protege orçamento.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classificarAd } from "../_shared/classificar.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const FB_TOKEN = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Método não permitido", { status: 405 });
  }

  const { data: pendentes } = await supabase
    .from("alertas")
    .select("id, meta_ad_id, ads_numero, regra_codigo")
    .eq("acao_pendente", "pausar")
    .eq("resolvido", false);

  if (!pendentes || pendentes.length === 0) {
    return new Response(JSON.stringify({ ok: true, processados: 0 }),
      { headers: { "Content-Type": "application/json" } });
  }

  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  let processados = 0;
  const erros: any[] = [];

  for (const row of pendentes) {
    const adId = row.meta_ad_id;
    const adsNum = row.ads_numero;
    const alertaId = row.id;
    const regra = row.regra_codigo || "?";

    if (!adId) {
      erros.push({ ads_numero: adsNum, erro: "sem meta_ad_id" });
      continue;
    }

    try {
      // 1. Pausa o anúncio no Meta
      const pauseUrl = `https://graph.facebook.com/v25.0/${adId}?access_token=${FB_TOKEN}`;
      const pauseRes = await fetch(pauseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ status: "PAUSED" }),
      });
      const pauseResult = await pauseRes.json();
      if (!pauseResult.success) {
        erros.push({ ads_numero: adsNum, erro: pauseResult });
        continue;
      }

      // 2. Busca métricas para classificar o criativo (insights_cache periodo=maximum)
      const { data: insightsRows } = await supabase
        .from("insights_cache")
        .select("compras, cpa, gasto")
        .eq("meta_ad_id", adId)
        .eq("periodo", "maximum")
        .limit(1);
      const ins = insightsRows?.[0] || {};
      const vendas = ins.compras || 0;
      const cpa = ins.cpa ?? null;
      const gasto = ins.gasto || 0;
      const classificacao = classificarAd(vendas, cpa, gasto);

      // 3. Monta nota de pausa automática, sem sobrescrever observações atuais
      const notaPausa = `[Pausado automaticamente — ${regra} em ${hoje}. Classificação: ${classificacao}]`;
      const { data: adRow } = await supabase.from("ads").select("observacoes").eq("numero", adsNum).single();
      const obsAtual = adRow?.observacoes || "";
      const obsNova = `${obsAtual}\n${notaPausa}`.trim();

      // 4. Determina coluna destino no Kanban pela classificação
      // "Testar novamente" não é coluna própria (removida em 2026-07-10) —
      // é etiqueta que vive dentro de Arquivados junto com Mediano/Ruim.
      const colDestino: Record<string, string> = {
        "Ótimo": "campeoes",
        "Testar novamente": "arquivado",
        "Mediano": "arquivado",
        "Ruim": "arquivado",
      };

      // NUNCA sobrescrever gasto_total/vendas_total/cpa_historico aqui.
      //
      // Bug real, achado em 2026-08-27: esses três campos são o agregado de
      // VIDA INTEIRA do card, somando TODO ad_id que já usou aquele "ADS N"
      // (é o kanban-sync que calcula isso, agrupando por número do nome). Aqui
      // a métrica vem do `insights_cache` de UM ad_id só, o que está sendo
      // pausado agora — então gravar isso no card trocava o total da vida
      // inteira pelo número de um relançamento sozinho.
      //
      // Estrago que isso causou: o ADS 22 tem 40 vendas na vida inteira, mas o
      // ad_id pausado tinha 3. Como o G5 re-alertava o mesmo ADS a cada 6h
      // (outro bug, corrigido em 2026-08-25), esta função reescrevia o total a
      // cada ciclo. O card acabou mostrando 1 venda e CPA de R$7.912 num
      // criativo cujo CPA real é R$197, e o mesmo aconteceu com outros 37
      // anúncios, escondendo 144 vendas no total.
      //
      // A classificação continua usando a métrica do ad_id (é ela que diz se
      // ESTE criativo merece ser pausado), só a gravação dos agregados saiu.
      const adsPatch: Record<string, unknown> = {
        status: colDestino[classificacao] || "arquivado",
        tag: classificacao,
        observacoes: obsNova,
      };

      await supabase.from("ads").update(adsPatch).eq("numero", adsNum);

      // 5. Marca alerta como resolvido
      await supabase.from("alertas").update({ resolvido: true, acao_pendente: null }).eq("id", alertaId);

      processados++;
    } catch (err) {
      erros.push({ ads_numero: adsNum, erro: String(err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, processados, erros: erros.length, detalhe_erros: erros }),
    { headers: { "Content-Type": "application/json" } });
});
