// Tracker FMN — cálculo de custo por mensagem. Preços vêm da tabela
// custo_precos (editável sem redeploy). Valores são estimativas públicas de
// mercado, ajuste em custo_precos se a Meta ou a Anthropic mudarem o preço.
let cache: Record<string, number> | null = null;
let cacheEm = 0;

async function precos(supabase: any): Promise<Record<string, number>> {
  if (cache && Date.now() - cacheEm < 5 * 60 * 1000) return cache;
  const { data } = await supabase.from("custo_precos").select("chave, valor");
  cache = Object.fromEntries((data || []).map((r: any) => [r.chave, Number(r.valor)]));
  cacheEm = Date.now();
  return cache;
}

export async function custoTemplateUsd(supabase: any, categoria: "utility" | "marketing" = "utility"): Promise<number> {
  const p = await precos(supabase);
  return categoria === "marketing" ? (p.whatsapp_template_marketing_usd || 0) : (p.whatsapp_template_utility_usd || 0);
}

export async function custoAnthropicUsd(supabase: any, tokensEntrada: number, tokensSaida: number): Promise<number> {
  const p = await precos(supabase);
  const inPorMtok  = p.anthropic_haiku_input_por_mtok  || 0;
  const outPorMtok = p.anthropic_haiku_output_por_mtok || 0;
  return (tokensEntrada / 1_000_000) * inPorMtok + (tokensSaida / 1_000_000) * outPorMtok;
}
