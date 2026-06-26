// ai-diagnostic — analisa os dados do dashboard com Claude (Anthropic)
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function respJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return respJson({ erro: "Método não permitido" }, 405);

  if (!ANTHROPIC_API_KEY) return respJson({ erro: "ANTHROPIC_API_KEY não configurada" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return respJson({ erro: "Payload inválido" }, 400); }

  const {
    fat = 0, lucro = 0, gasto = 0, margem = 0,
    totalVendas = 0, cpaMedio = null, reimb = 0,
    period = "7d", adsRanking = [], funnelSteps = null, salesBySource = [],
  } = body;

  const cpaLimit = 207.90;
  const topAds = (adsRanking as any[]).slice(0, 5)
    .map((a: any) => `AD #${a.numero} (${a.tipo || "—"}): gasto R$${Number(a.gasto).toFixed(2)}, ${a.vendas} vendas, CPA ${a.cpa ? "R$" + Number(a.cpa).toFixed(2) : "sem CPA"}`)
    .join("\n");
  const funnelStr = funnelSteps
    ? (funnelSteps as any[]).map((s: any) => `${s.label}: ${s.value} (${s.pct}%)`).join(" → ")
    : "Sem dados de funil";
  const srcStr = (salesBySource as any[]).slice(0, 5)
    .map((s: any) => `${s.name}: ${s.sales} vendas (${s.pct.toFixed(1)}%)`).join(", ");

  const prompt = `Você é um especialista em tráfego pago e marketing de infoprodutos. Analise os dados abaixo do painel de vendas e dê um diagnóstico direto e acionável em português do Brasil.

PERÍODO: ${period}

FINANCEIRO:
- Faturamento bruto: R$${Number(fat).toFixed(2)}
- Lucro real: R$${Number(lucro).toFixed(2)} (margem ${Number(margem).toFixed(1)}%)
- Gasto Meta Ads: R$${Number(gasto).toFixed(2)}
- Reembolsos: R$${Number(reimb).toFixed(2)} (${fat > 0 ? ((reimb/fat)*100).toFixed(1) : 0}% do faturamento)
- Total de vendas aprovadas: ${totalVendas}

PERFORMANCE DE ADS:
- CPA médio: ${cpaMedio ? "R$" + Number(cpaMedio).toFixed(2) : "sem dados"}
- Limite de CPA saudável: R$${cpaLimit.toFixed(2)}
Top ADs:
${topAds || "Sem ADs com gasto"}

FUNIL: ${funnelStr}
ORIGENS: ${srcStr || "Sem dados"}

Dê um diagnóstico em 3 a 5 parágrafos curtos. Seja direto e use os números. Identifique: (1) o que está indo bem, (2) o maior problema ou risco, (3) a ação mais importante agora. Sem introdução genérica. Use parágrafos corridos de 1 a 2 linhas, sem bullet points.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return respJson({ erro: `Anthropic API erro ${res.status}: ${err}` }, 500);
  }

  const json = await res.json();
  const text = json.content?.[0]?.text || "";

  return respJson({ diagnostico: text, model: "claude-haiku-4-5" });
});
