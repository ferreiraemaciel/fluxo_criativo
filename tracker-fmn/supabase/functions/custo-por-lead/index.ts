// Custo por lead do quiz, por funil, num intervalo qualquer e nas últimas 8 semanas.
//
// Lead aqui é quem deixou WhatsApp E e-mail no quiz (quiz_leads), sem os
// importados do inLead. Gasto vem direto do Meta, insights por campanha, e não
// do insights_cache: o cache só tem janelas fixas (hoje, 3d, 5d, 7d, 14d, 30d) e
// o gasto_diario soma a conta inteira sem separar campanha, então nenhum dos
// dois responde "quanto o MCV gastou de 12/08 a 03/09".
//
// Campanha vira funil pelo prefixo do nome, que é a convenção da conta:
// "MCV ..." manda pro quiz Fotógrafo Protegido, "BLI ..." pro quiz do Blindagem.
// Conferido no Meta em 10/09/2026, anúncio por anúncio, em todas as campanhas
// com gasto. Post impulsionado ("Post do Instagram: ...") fica de fora, não leva
// pro quiz.
//
// Só responde pra quem está logado no Tracker.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const META_TOKEN    = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const AD_ACCOUNT_ID = (Deno.env.get("FB_AD_ACCOUNT_ID") || "").replace(/^act_/, "");
const GRAPH = "https://graph.facebook.com/v25.0";

// Antes disso o quiz rodava no inLead e o lead não caía em quiz_leads com a
// campanha certa. Qualquer período que comece antes é cortado aqui.
const INICIO_QUIZ_PROPRIO = "2026-07-06";

const FUNIS = [
  { slug: "fotografo-protegido", prefixo: "MCV" },
  { slug: "blindagem",           prefixo: "BLI" },
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const hojeBrt  = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const somaDias = (d: string, n: number) => {
  const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10);
};
const r2 = (n: number) => Math.round(n * 100) / 100;

async function gastoPorCampanha(since: string, until: string, incremento?: number) {
  const linhas: any[] = [];
  let url = `${GRAPH}/act_${AD_ACCOUNT_ID}/insights?` + new URLSearchParams({
    level: "campaign",
    fields: "campaign_name,spend",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    access_token: META_TOKEN,
    ...(incremento ? { time_increment: String(incremento) } : {}),
  });
  while (url) {
    const j = await (await fetch(url)).json();
    if (j.error) throw new Error("Meta: " + j.error.message);
    linhas.push(...(j.data || []));
    url = j.paging?.next || "";
  }
  return linhas;
}

const funilDaCampanha = (nome: string) =>
  FUNIS.find((f) => (nome || "").trim().toUpperCase().startsWith(f.prefixo))?.slug || null;

async function contarLeads(slug: string, since: string, until: string) {
  const { count, error } = await sb.from("quiz_leads").select("id", { count: "exact", head: true })
    .eq("funnel_slug", slug)
    .gte("created_at", `${since}T03:00:00Z`)
    .lt("created_at", `${somaDias(until, 1)}T03:00:00Z`)
    .not("whatsapp", "is", null).neq("whatsapp", "")
    .not("email", "is", null).neq("email", "")
    .or("origem.is.null,origem.neq.inlead_import");
  if (error) throw new Error(error.message);
  return count || 0;
}

const vazio = () => Object.fromEntries(FUNIS.map((f) => [f.slug, { gasto: 0, leads: 0, cpl: null as number | null }]));
const fechar = (g: Record<string, any>) => {
  for (const v of Object.values(g)) { v.gasto = r2(v.gasto); v.cpl = v.leads ? r2(v.gasto / v.leads) : null; }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(token);
    if (!u?.user) return json({ error: "Faça login no Tracker pra ver o custo por lead." }, 401);

    const body  = await req.json().catch(() => ({}));
    const hoje  = hojeBrt();
    let since   = body.since || INICIO_QUIZ_PROPRIO;
    let until   = body.until || hoje;
    if (since < INICIO_QUIZ_PROPRIO) since = INICIO_QUIZ_PROPRIO;
    if (until > hoje) until = hoje;

    // 8 semanas de segunda a domingo, a última é a semana corrente (parcial).
    const diaSemana     = (new Date(hoje + "T00:00:00Z").getUTCDay() + 6) % 7;
    const inicioSemanas = somaDias(somaDias(hoje, -diaSemana), -49);

    const [gPeriodo, gSemanas] = await Promise.all([
      gastoPorCampanha(since, until),
      gastoPorCampanha(inicioSemanas, hoje, 7),
    ]);

    const periodo = vazio();
    for (const l of gPeriodo) { const s = funilDaCampanha(l.campaign_name); if (s) periodo[s].gasto += Number(l.spend || 0); }

    const semanas = Array.from({ length: 8 }, (_, i) => {
      const inicio = somaDias(inicioSemanas, i * 7);
      return { inicio, fim: i === 7 ? hoje : somaDias(inicio, 6), funis: vazio() };
    });
    for (const l of gSemanas) {
      const slug = funilDaCampanha(l.campaign_name);
      const s = semanas.find((x) => x.inicio === l.date_start);
      if (slug && s) s.funis[slug].gasto += Number(l.spend || 0);
    }

    await Promise.all([
      ...FUNIS.map(async (f) => { periodo[f.slug].leads = await contarLeads(f.slug, since, until); }),
      ...semanas.flatMap((s) => FUNIS.map(async (f) => { s.funis[f.slug].leads = await contarLeads(f.slug, s.inicio, s.fim); })),
    ]);
    fechar(periodo);
    semanas.forEach((s) => fechar(s.funis));

    return json({ periodo: { since, until }, funis: periodo, semanas, gerado_em: new Date().toISOString() });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
