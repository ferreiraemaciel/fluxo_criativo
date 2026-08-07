// Tracker FMN — Público personalizado de compradores no Meta Ads
//
// POST /functions/v1/meta-publicos-sync
//   { action: "preview",  produto? }                    → SÓ LÊ. Não escreve nada no Meta.
//   { action: "listar" }                                → lista os públicos da conta
//   { action: "atualizar", audience_id, produto? }      → manda os compradores pro público existente
//   { action: "criar", nome?, semelhante?, produto? }   → cria público novo (+ semelhante 1%)
//
// Nenhum dado pessoal sai daqui em texto legível: e-mail, telefone, nome, cidade,
// estado e CEP são normalizados no padrão do Meta e criptografados em SHA-256
// antes do envio. O Meta recebe só o código embaralhado, que serve pra casar
// pessoa e mais nada.
//
// Sem alteração de banco: o carimbo da última execução usa a tabela `sync_status`
// que já existe (mesma que as rotinas do Drive e da Hotmart usam).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const META_TOKEN    = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const AD_ACCOUNT_ID = Deno.env.get("FB_AD_ACCOUNT_ID")!;
const GRAPH         = "https://graph.facebook.com/v25.0";

const PRODUTO_ID_MCV = "3400278";
// Transação de teste da Hotmart que ficou no banco. Nunca entra em público.
const PRODUTOS_IGNORADOS = new Set(["123"]);

const LOTE = 5000;          // o Meta aceita até 10.000 por requisição
const PAGINA_SUPABASE = 1000;

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

/* ─────────────────────────── Graph API ─────────────────────────── */

async function graphGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", META_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString());
  return await r.json();
}

async function graphPost(path: string, body: Record<string, unknown>) {
  const form = new URLSearchParams();
  form.set("access_token", META_TOKEN);
  for (const [k, v] of Object.entries(body)) {
    form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  const r = await fetch(`${GRAPH}${path}`, { method: "POST", body: form });
  return await r.json();
}

/* ──────────────────── Normalização (padrão Meta) ────────────────────
   As regras abaixo são a parte que falha calada: se estiverem erradas o
   Meta aceita o envio, responde "ok", e o público simplesmente não casa
   com ninguém. Cada função aqui tem um porquê explícito.
------------------------------------------------------------------- */

const UF_VALIDAS = new Set([
  "ac","al","ap","am","ba","ce","df","es","go","ma","mt","ms","mg","pa","pb",
  "pr","pe","pi","rj","rn","rs","ro","rr","sc","sp","se","to",
]);

const UF_POR_NOME: Record<string, string> = {
  acre:"ac", alagoas:"al", amapa:"ap", amazonas:"am", bahia:"ba", ceara:"ce",
  "distrito federal":"df", "espirito santo":"es", goias:"go", maranhao:"ma",
  "mato grosso":"mt", "mato grosso do sul":"ms", "minas gerais":"mg", para:"pa",
  paraiba:"pb", parana:"pr", pernambuco:"pe", piaui:"pi", "rio de janeiro":"rj",
  "rio grande do norte":"rn", "rio grande do sul":"rs", rondonia:"ro",
  roraima:"rr", "santa catarina":"sc", "sao paulo":"sp", sergipe:"se",
  tocantins:"to",
};

// Placeholders que a Hotmart devolve quando o campo veio vazio. Se passarem
// adiante viram hash de lixo, que casa com ninguém e ainda suja a contagem.
const VAZIOS = new Set(["", "(none)", "none", "null", "undefined", "-", "n/a", "na"]);

// O range ̀-ͯ são as marcas de acento que o NFD separa da letra.
// Escrito em escape de propósito: acento literal aqui é fácil de mangler num
// copiar e colar, e o estrago seria silencioso (nome com acento nunca casaria).
const ACENTOS = new RegExp("[\\u0300-\\u036f]", "g");

function semAcento(s: string) {
  return s.normalize("NFD").replace(ACENTOS, "");
}

function bruto(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return VAZIOS.has(s.toLowerCase()) ? "" : s;
}

async function sha256(txt: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// E-mail: minúsculo, sem espaço. É o campo de maior taxa de casamento.
function normEmail(v: unknown): string {
  const s = bruto(v).toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? s : "";
}

// Telefone: o Meta exige código do país. O banco guarda 11 dígitos (DDD +
// número), sem o 55. Mandar assim derruba o casamento a quase zero.
function normFone(v: unknown): string {
  let d = bruto(v).replace(/\D/g, "");
  if (!d) return "";
  d = d.replace(/^0+/, "");                        // 0 de operadora
  if (d.length === 10 || d.length === 11) return "55" + d;   // DDD + número
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  if (d.length >= 10 && d.length <= 15) return d;  // estrangeiro já com DDI
  return "";
}

// Nome: minúsculo, sem acento e sem pontuação. O Meta compara letra a letra.
function normNomePedaco(s: string): string {
  return semAcento(s.toLowerCase()).replace(/[^a-z]/g, "");
}

function normNome(v: unknown): { fn: string; ln: string } {
  const partes = bruto(v).split(/\s+/).map(normNomePedaco).filter(Boolean);
  if (partes.length === 0) return { fn: "", ln: "" };
  if (partes.length === 1) return { fn: partes[0], ln: "" };
  return { fn: partes[0], ln: partes[partes.length - 1] };
}

// Cidade: minúsculo, sem acento, sem espaço e sem pontuação ("São Paulo" → "saopaulo").
function normCidade(v: unknown): string {
  return semAcento(bruto(v).toLowerCase()).replace(/[^a-z0-9]/g, "");
}

// Estado: sigla de 2 letras minúscula. Aceita nome por extenso e converte.
function normEstado(v: unknown): string {
  const s = semAcento(bruto(v).toLowerCase()).replace(/[^a-z\s]/g, "").trim();
  if (!s) return "";
  if (s.length === 2) return UF_VALIDAS.has(s) ? s : "";
  return UF_POR_NOME[s.replace(/\s+/g, " ")] || "";
}

// CEP: só dígitos. No Brasil são 8.
function normCep(v: unknown): string {
  const d = bruto(v).replace(/\D/g, "");
  return d.length === 8 ? d : "";
}

// País: código de 2 letras minúsculo. O banco mistura "Brasil" e "BR".
function normPais(v: unknown): string {
  const s = semAcento(bruto(v).toLowerCase()).replace(/[^a-z]/g, "");
  if (!s) return "";
  if (s === "brasil" || s === "brazil" || s === "br") return "br";
  return s.length === 2 ? s : "";
}

/* ─────────────────── Montagem do lote pro Meta ─────────────────── */

const SCHEMA = ["EMAIL", "PHONE", "FN", "LN", "CT", "ST", "ZIP", "COUNTRY"];

type Comprador = {
  comprador_email: string | null;
  comprador_telefone: string | null;
  comprador_nome: string | null;
  comprador_cidade: string | null;
  comprador_estado: string | null;
  comprador_cep: string | null;
  comprador_pais: string | null;
};

type Normalizado = {
  email: string; fone: string; fn: string; ln: string;
  ct: string; st: string; zip: string; country: string;
};

function normalizar(c: Comprador): Normalizado {
  const { fn, ln } = normNome(c.comprador_nome);
  return {
    email:   normEmail(c.comprador_email),
    fone:    normFone(c.comprador_telefone),
    fn, ln,
    ct:      normCidade(c.comprador_cidade),
    st:      normEstado(c.comprador_estado),
    zip:     normCep(c.comprador_cep),
    country: normPais(c.comprador_pais),
  };
}

async function paraLinhaHash(n: Normalizado): Promise<string[]> {
  // Campo ausente vai como string vazia, é o que o Meta espera.
  const h = (v: string) => (v ? sha256(v) : Promise.resolve(""));
  return await Promise.all([
    h(n.email), h(n.fone), h(n.fn), h(n.ln),
    h(n.ct), h(n.st), h(n.zip), h(n.country),
  ]);
}

/* ───────────────── Leitura dos compradores no banco ───────────────── */

function supa() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Busca todos os compradores aprovados, deduplicados por e-mail (fica o registro
// mais recente, que tem mais chance de ter endereço e telefone atualizados).
async function buscarCompradores(produto: "mcv" | "todos") {
  const sb = supa();
  const linhas: (Comprador & { produto_id: string })[] = [];
  let de = 0;

  while (true) {
    let q = sb
      .from("vendas")
      .select(
        "produto_id, comprador_email, comprador_telefone, comprador_nome, comprador_cidade, comprador_estado, comprador_cep, comprador_pais, hotmart_approved_date, created_at",
      )
      .eq("status", "aprovada")
      .order("hotmart_approved_date", { ascending: false, nullsFirst: false })
      .range(de, de + PAGINA_SUPABASE - 1);

    if (produto === "mcv") q = q.eq("produto_id", PRODUTO_ID_MCV);

    const { data, error } = await q;
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data || data.length === 0) break;
    linhas.push(...(data as (Comprador & { produto_id: string })[]));
    if (data.length < PAGINA_SUPABASE) break;
    de += PAGINA_SUPABASE;
  }

  const vistos = new Set<string>();
  const unicos: Comprador[] = [];
  let descartados_teste = 0;
  let descartados_sem_email = 0;

  for (const l of linhas) {
    if (PRODUTOS_IGNORADOS.has(String(l.produto_id))) { descartados_teste++; continue; }
    const email = normEmail(l.comprador_email);
    if (!email) { descartados_sem_email++; continue; }
    if (vistos.has(email)) continue;
    vistos.add(email);
    unicos.push(l);
  }

  return { unicos, total_linhas: linhas.length, descartados_teste, descartados_sem_email };
}

/* ──────────────────── Envio pro público do Meta ──────────────────── */

async function enviarUsuarios(audienceId: string, compradores: Comprador[]) {
  const sessionId = Math.floor(Math.random() * 2_000_000_000);
  const lotes: Comprador[][] = [];
  for (let i = 0; i < compradores.length; i += LOTE) lotes.push(compradores.slice(i, i + LOTE));

  let recebidos = 0;
  let invalidos = 0;
  const respostas: unknown[] = [];

  for (let i = 0; i < lotes.length; i++) {
    const data = await Promise.all(lotes[i].map((c) => paraLinhaHash(normalizar(c))));
    const res = await graphPost(`/${audienceId}/users`, {
      payload: { schema: SCHEMA, data },
      session: {
        session_id: sessionId,
        batch_seq: i + 1,
        last_batch_flag: i === lotes.length - 1,
        estimated_num_total: compradores.length,
      },
    });
    if (res.error) throw new Error(`Meta recusou o lote ${i + 1}: ${res.error.message}`);
    recebidos += Number(res.num_received || 0);
    invalidos += Number(res.num_invalid_entries || 0);
    respostas.push(res);
  }

  return { enviados: compradores.length, recebidos, invalidos, lotes: lotes.length, respostas };
}

// Público alvo padrão. Fica em `app_config` (tabela chave/valor que já existe)
// pra rotina agendada e painel não carregarem o identificador chumbado no
// código. Trocar o público alvo vira um UPDATE, não um deploy.
const CHAVE_CONFIG = "meta_publico_compradores";

async function alvoPadrao(): Promise<{ audience_id: string; produto: "mcv" | "todos" } | null> {
  const { data } = await supa()
    .from("app_config").select("valor").eq("chave", CHAVE_CONFIG).maybeSingle();
  const v = data?.valor as { audience_id?: string; produto?: string } | undefined;
  if (!v?.audience_id) return null;
  return { audience_id: String(v.audience_id), produto: v.produto === "todos" ? "todos" : "mcv" };
}

async function carimbar(status: "ok" | "erro", mensagem: string, segundos: number) {
  try {
    await supa().from("sync_status").upsert({
      script: "meta-publicos-sync",
      last_run: new Date().toISOString(),
      status,
      message: mensagem,
      duration_s: Number(segundos.toFixed(1)),
    }, { onConflict: "script" });
  } catch { /* carimbo é acessório, nunca derruba a operação */ }
}

/* ──────────────────────────── Ações ──────────────────────────── */

// Diagnóstico completo SEM tocar na conta de anúncios.
async function preview(produto: "mcv" | "todos", audienceId?: string) {
  const { unicos, total_linhas, descartados_teste, descartados_sem_email } =
    await buscarCompradores(produto);

  const norm = unicos.map(normalizar);
  const cobertura = {
    email:    norm.filter((n) => n.email).length,
    telefone: norm.filter((n) => n.fone).length,
    nome:     norm.filter((n) => n.fn).length,
    sobrenome:norm.filter((n) => n.ln).length,
    cidade:   norm.filter((n) => n.ct).length,
    estado:   norm.filter((n) => n.st).length,
    cep:      norm.filter((n) => n.zip).length,
    pais:     norm.filter((n) => n.country).length,
  };

  // Quantos campos casáveis cada pessoa leva em média. Quanto maior, melhor a
  // chance de o Meta reconhecer a pessoa.
  const camposPorPessoa = norm.length
    ? norm.reduce((acc, n) =>
        acc + [n.email, n.fone, n.fn, n.ln, n.ct, n.st, n.zip, n.country].filter(Boolean).length, 0) / norm.length
    : 0;

  // Amostra mascarada, só pra conferir que a transformação está certa.
  const amostra = [] as unknown[];
  for (const n of norm.slice(0, 3)) {
    const [he, hf] = await Promise.all([
      n.email ? sha256(n.email) : Promise.resolve(""),
      n.fone ? sha256(n.fone) : Promise.resolve(""),
    ]);
    amostra.push({
      email_mascarado: n.email ? n.email.replace(/^(.).*(@.*)$/, "$1***$2") : "(vazio)",
      email_hash: he ? he.slice(0, 12) + "…" : "(vazio)",
      telefone_normalizado: n.fone ? n.fone.slice(0, 4) + "*****" + n.fone.slice(-2) : "(vazio)",
      telefone_hash: hf ? hf.slice(0, 12) + "…" : "(vazio)",
      cidade: n.ct || "(vazio)", estado: n.st || "(vazio)",
      cep: n.zip ? n.zip.slice(0, 5) + "***" : "(vazio)", pais: n.country || "(vazio)",
    });
  }

  let publico_atual: unknown = null;
  if (audienceId) {
    const a = await graphGet(`/${audienceId}`, {
      fields: "id,name,subtype,approximate_count_lower_bound,time_content_updated,delivery_status,operation_status",
    });
    publico_atual = a.error ? { erro: a.error.message } : a;
  }

  return {
    ok: true,
    escreveu_no_meta: false,
    produto,
    linhas_lidas: total_linhas,
    compradores_unicos: norm.length,
    descartados: { transacao_teste: descartados_teste, sem_email_valido: descartados_sem_email },
    cobertura,
    campos_por_pessoa: Number(camposPorPessoa.toFixed(2)),
    amostra,
    publico_atual,
  };
}

async function listar() {
  const r = await graphGet(`/act_${AD_ACCOUNT_ID}/customaudiences`, {
    // lookalike_spec traz origin[].id, que é o vínculo real do semelhante com a
    // fonte. Casar por nome quebra assim que alguém renomeia um dos dois.
    fields: "id,name,subtype,approximate_count_lower_bound,time_content_updated,delivery_status,lookalike_spec",
    limit: "100",
  });
  if (r.error) throw new Error(r.error.message);
  return { ok: true, publicos: r.data || [] };
}

async function atualizar(audienceId: string, produto: "mcv" | "todos") {
  const t0 = Date.now();
  const alvo = await graphGet(`/${audienceId}`, { fields: "id,name,subtype" });
  if (alvo.error) throw new Error(`Público não encontrado: ${alvo.error.message}`);
  if (alvo.subtype !== "CUSTOM") {
    throw new Error(`"${alvo.name}" é do tipo ${alvo.subtype}. Só dá pra mandar gente pra público do tipo CUSTOM.`);
  }

  const { unicos } = await buscarCompradores(produto);
  if (unicos.length === 0) throw new Error("Nenhum comprador encontrado. Envio cancelado.");

  const r = await enviarUsuarios(audienceId, unicos);
  const seg = (Date.now() - t0) / 1000;
  await carimbar("ok", `${alvo.name}: ${r.recebidos} recebidos, ${r.invalidos} inválidos`, seg);

  return { ok: true, publico: { id: alvo.id, nome: alvo.name }, ...r, duracao_s: Number(seg.toFixed(1)) };
}

async function criar(nome: string, semelhante: boolean, produto: "mcv" | "todos") {
  const t0 = Date.now();
  const { unicos } = await buscarCompradores(produto);
  if (unicos.length === 0) throw new Error("Nenhum comprador encontrado. Criação cancelada.");

  const criado = await graphPost(`/act_${AD_ACCOUNT_ID}/customaudiences`, {
    name: nome,
    subtype: "CUSTOM",
    description: "Compradores vindos do Tracker FMN (atualização automática)",
    customer_file_source: "USER_PROVIDED_ONLY",
  });
  if (criado.error) throw new Error(`Meta recusou criar o público: ${criado.error.message}`);

  const envio = await enviarUsuarios(criado.id, unicos);

  let lookalike: unknown = null;
  if (semelhante) {
    const lk = await graphPost(`/act_${AD_ACCOUNT_ID}/customaudiences`, {
      name: `Semelhante (1%) - ${nome}`,
      subtype: "LOOKALIKE",
      origin_audience_id: criado.id,
      lookalike_spec: { type: "custom_ratio", ratio: 0.01, country: "BR" },
    });
    lookalike = lk.error
      // Acontece quando o Meta ainda não terminou de processar a lista. Não é
      // erro de código: é só cedo demais. Refazer depois resolve.
      ? { criado: false, motivo: lk.error.message,
          dica: "O Meta ainda está processando a lista. Tente criar o semelhante de novo em algumas horas." }
      : { criado: true, id: lk.id, nome: `Semelhante (1%) - ${nome}` };
  }

  const seg = (Date.now() - t0) / 1000;
  await carimbar("ok", `Criado "${nome}": ${envio.recebidos} recebidos`, seg);

  return {
    ok: true,
    publico: { id: criado.id, nome },
    ...envio,
    semelhante: lookalike,
    duracao_s: Number(seg.toFixed(1)),
  };
}

/* ──────────────────────────── Handler ──────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "preview");

    // Sem audience_id/produto no corpo, cai no alvo padrão do app_config. É o
    // que a rotina semanal usa: ela chama com {"action":"atualizar"} e pronto.
    const padrao = await alvoPadrao();
    const audienceId = body.audience_id ? String(body.audience_id) : padrao?.audience_id;
    const produto: "mcv" | "todos" = body.produto
      ? (body.produto === "todos" ? "todos" : "mcv")
      : (padrao?.produto ?? "mcv");

    if (action === "preview")  return json(await preview(produto, audienceId));
    if (action === "listar")   return json(await listar());

    if (action === "atualizar") {
      if (!audienceId) {
        return json({ error: `Nenhum público alvo. Passe audience_id ou configure "${CHAVE_CONFIG}" em app_config.` }, 400);
      }
      return json(await atualizar(audienceId, produto));
    }

    if (action === "criar") {
      const nome = String(body.nome || "").trim();
      if (!nome) return json({ error: "nome é obrigatório" }, 400);
      return json(await criar(nome, body.semelhante !== false, produto));
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await carimbar("erro", msg.slice(0, 300), 0);
    return json({ error: msg }, 500);
  }
});
