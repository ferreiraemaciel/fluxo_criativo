// Tracker FMN — custos de infraestrutura do Blindagem/Khronus/Kairós (03/10/2026).
// Roda 1x por dia (pg_cron) e grava em custos_infra uma estimativa do custo do dia
// por serviço, a partir do uso medido. Pedido em docs/PEDIDO-CUSTOS-INFRAESTRUTURA.md.
//
// Supabase: uso lido pela função uso_infra() no projeto do Blindagem.
// Cloudflare (R2 e Workers): só mede se existir o segredo CF_ANALYTICS_TOKEN
// (token só de leitura de análise, criado pelo Felipe). Sem ele, grava só o fixo.
// Preços oficiais de 03/10/2026; plano e máquina do Supabase vêm de app_config.infra_config.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { portao } from "../_shared/portao.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const blindagem = createClient(Deno.env.get("KHRONUS_SUPABASE_URL")!, Deno.env.get("KHRONUS_SERVICE_ROLE_KEY")!);
const CF_TOKEN = Deno.env.get("CF_ANALYTICS_TOKEN") || "";
const CF_CONTA = "e1d71fcefbf0ea8d14a39bd2a1b36ba3";
const GB = 1024 ** 3;
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const hojeBrt = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const diasNoMes = (d: string) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7), 0)).getUTCDate();

async function cotacao(): Promise<number> {
  try {
    const r = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/cambio-usd-brl`);
    const d = await r.json();
    if (d.usdBrl) return Number(d.usdBrl);
  } catch { /* cai no padrão */ }
  return 5.5;
}

async function cloudflare(dia: string) {
  if (!CF_TOKEN) return null;
  const q = `{ viewer { accounts(filter:{accountTag:"${CF_CONTA}"}) {
    r2StorageAdaptiveGroups(limit:100, filter:{date:"${dia}"}) { max { payloadSize metadataSize } dimensions { bucketName } }
    r2OperationsAdaptiveGroups(limit:1000, filter:{date:"${dia}"}) { sum { requests } dimensions { actionType } }
    workersInvocationsAdaptive(limit:1000, filter:{date:"${dia}"}) { sum { requests } }
  } } }`;
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST", headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  const d = await r.json();
  const a = d?.data?.viewer?.accounts?.[0];
  if (!a) throw new Error("Cloudflare: " + JSON.stringify(d?.errors || d).slice(0, 200));
  // Gravações (classe A) e leituras (classe B), pela tabela oficial do R2.
  const CLASSE_A = new Set(["PutObject","CopyObject","CompleteMultipartUpload","CreateMultipartUpload","UploadPart","UploadPartCopy","ListObjects","ListObjectsV2","ListBuckets","ListMultipartUploads","ListParts","PutBucket","DeleteBucket"]);
  let a1 = 0, b1 = 0;
  for (const g of a.r2OperationsAdaptiveGroups) {
    const t = g.dimensions.actionType;
    if (t === "DeleteObject" || t === "DeleteObjects" || t === "AbortMultipartUpload") continue; // grátis
    if (CLASSE_A.has(t)) a1 += g.sum.requests; else b1 += g.sum.requests;
  }
  const bytes = a.r2StorageAdaptiveGroups.reduce((t: number, g: any) => t + (g.max.payloadSize || 0) + (g.max.metadataSize || 0), 0);
  const pedidos = a.workersInvocationsAdaptive.reduce((t: number, g: any) => t + g.sum.requests, 0);
  return { bytes, a1, b1, pedidos };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const recusa = await portao(req, { usuario: true, cabecalhos: cors }); if (recusa) return recusa;
  try {
    const url = new URL(req.url);
    const dia = url.searchParams.get("dia") || hojeBrt();
    const n = diasNoMes(dia);
    const brl = await cotacao();
    const { data: cfgRow } = await db.from("app_config").select("valor").eq("chave", "infra_config").maybeSingle();
    const cfg = cfgRow?.valor || {};

    const { data: uso, error } = await blindagem.rpc("uso_infra");
    if (error) throw new Error("Blindagem: " + error.message);
    const gbBanco = Number(uso.bytes_banco) / GB, gbArq = Number(uso.bytes_storage) / GB;

    const linhas: any[] = [];
    const add = (servico: string, usd: number, quantidade: number | null, unidade: string | null, detalhe: unknown) =>
      linhas.push({ dia, servico, quantidade, unidade, valor_usd: +usd.toFixed(4), valor_brl: +(usd * brl).toFixed(2), fonte: "medido", detalhe });

    // Supabase: plano + máquina (menos o crédito) + excedentes de banco (8 GB) e arquivos (100 GB).
    add("Supabase plano", (cfg.supabase_plano_usd ?? 25) / n, null, null, { plano: "Pro" });
    add("Supabase máquina", Math.max(0, (cfg.supabase_maquina_usd ?? 10) - (cfg.supabase_credito_maquina_usd ?? 10)) / n,
      null, null, { maquina: cfg.supabase_maquina || "Micro" });
    add("Supabase extras", (Math.max(0, gbBanco - 8) * 0.125 + Math.max(0, gbArq - 100) * 0.021) / n,
      +(gbBanco + gbArq).toFixed(2), "GB", { gb_banco: +gbBanco.toFixed(2), gb_arquivos: +gbArq.toFixed(2), arquivos: uso.arquivos, conexoes: uso.conexoes, estudios: uso.estudios });

    // Cloudflare: Workers Paid é fixo; o resto depende do token de análise.
    const cf = await cloudflare(dia).catch((e) => ({ erro: String(e) } as any));
    if (cf && !cf.erro) {
      const gbR2 = cf.bytes / GB;
      // Franquias mensais rateadas por dia.
      add("Cloudflare R2", Math.max(0, gbR2 - 10) * 0.015 / n + Math.max(0, cf.a1 - 1e6 / n) * 4.5 / 1e6 + Math.max(0, cf.b1 - 1e7 / n) * 0.36 / 1e6,
        +gbR2.toFixed(2), "GB", { gravacoes: cf.a1, leituras: cf.b1 });
      add("Cloudflare Workers", (cfg.workers_plano_usd ?? 5) / n + Math.max(0, cf.pedidos - 1e7 / n) * 0.3 / 1e6, cf.pedidos, "pedidos", null);
    } else {
      add("Cloudflare Workers", (cfg.workers_plano_usd ?? 5) / n, null, null, { aviso: cf?.erro || "sem token de análise da Cloudflare, R2 não medido" });
    }

    const { error: e2 } = await db.from("custos_infra").upsert(linhas, { onConflict: "dia,servico,fonte" });
    if (e2) throw new Error(e2.message);
    return json({ ok: true, dia, cotacao: brl, linhas: linhas.length, cloudflare_medido: !!(cf && !cf.erro) });
  } catch (e) {
    return json({ erro: String((e as Error)?.message || e) }, 500);
  }
});
