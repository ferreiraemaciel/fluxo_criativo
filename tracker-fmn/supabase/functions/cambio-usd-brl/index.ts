// Tracker FMN — cotação oficial do dólar (PTAX, Banco Central do Brasil).
// GET ?ate=YYYY-MM-DD (opcional, padrão hoje). Retorna a cotação de venda
// mais recente até essa data (BCB não fecha PTAX em fim de semana/feriado,
// por isso busca numa janela de 7 dias pra trás e pega a última disponível).
function paraMMDDYYYY(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${mes}-${dia}-${ano}`;
}

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const url = new URL(req.url);
    const ateIso = url.searchParams.get("ate") || new Date().toISOString().slice(0, 10);
    const ateDate = new Date(`${ateIso}T12:00:00Z`);
    const desdeDate = new Date(ateDate.getTime() - 7 * 86400000);
    const desde = paraMMDDYYYY(desdeDate.toISOString().slice(0, 10));
    const ate   = paraMMDDYYYY(ateIso);

    const r = await fetch(
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)` +
      `?@dataInicial='${desde}'&@dataFinalCotacao='${ate}'&$format=json&$top=1&$orderby=dataHoraCotacao%20desc`
    );
    const d = await r.json();
    const cotacao = d.value?.[0];
    if (!cotacao) return new Response(JSON.stringify({ error: "sem cotação disponível nessa janela" }), { status: 404, headers: { ...CORS, "content-type": "application/json" } });

    return new Response(JSON.stringify({
      usdBrl: cotacao.cotacaoVenda,
      dataCotacao: cotacao.dataHoraCotacao,
      fonte: "PTAX / Banco Central do Brasil",
    }), { headers: { ...CORS, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...CORS, "content-type": "application/json" } });
  }
});
