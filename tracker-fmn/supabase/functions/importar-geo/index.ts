// importar-geo — lê CSV da pasta Google Drive via service account e atualiza comprador_estado/cidade
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── JWT / Drive Auth ─────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado");
  const sa = JSON.parse(raw);

  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const payload = btoa(JSON.stringify(claims))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const toSign = `${header}.${payload}`;

  // Importar chave privada PEM
  const pem = sa.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const keyDer = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", keyDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const enc = new TextEncoder();
  const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(toSign));
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  const jwt = `${toSign}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Falha ao obter token Google: ${err}`);
  }
  const { access_token } = await tokenRes.json();
  return access_token;
}

// ── Drive helpers ────────────────────────────────────────────────────────────

function extrairIdDrive(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m) return m[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m2) return m2[1];
  // URL de pasta: /drive/folders/ID
  const m3 = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m3) return m3[1];
  return null;
}

async function listarCSVsNaPasta(folderId: string, token: string): Promise<{id:string;name:string}[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and mimeType='text/csv' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime+desc`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Erro ao listar pasta: ${err}`);
  }
  const data = await res.json();
  return data.files || [];
}

async function baixarArquivo(fileId: string, token: string): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Erro ao baixar arquivo: ${res.status}`);
  return await res.text();
}

// ── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(texto: string): Record<string, string>[] {
  const linhas = texto.split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) return [];
  const sep = linhas[0].includes(";") ? ";" : ",";

  function splitLinha(linha: string): string[] {
    const cols: string[] = [];
    let dentro = false;
    let atual = "";
    for (const ch of linha) {
      if (ch === '"') { dentro = !dentro; }
      else if (ch === sep && !dentro) { cols.push(atual.trim()); atual = ""; }
      else { atual += ch; }
    }
    cols.push(atual.trim());
    return cols;
  }

  const cabecalho = splitLinha(linhas[0]).map(h => h.replace(/^"|"$/g, "").trim());
  return linhas.slice(1).map(linha => {
    const vals = splitLinha(linha);
    const obj: Record<string, string> = {};
    cabecalho.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^"|"$/g, "").trim(); });
    return obj;
  });
}

function col(row: Record<string, string>, ...nomes: string[]): string {
  for (const n of nomes) {
    if (row[n]) return row[n];
    const lower = Object.keys(row).find(k => k.toLowerCase() === n.toLowerCase());
    if (lower && row[lower]) return row[lower];
  }
  return "";
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") return respJson({ erro: "Método não permitido" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return respJson({ erro: "Payload inválido" }, 400); }

  const driveUrl: string = body?.driveUrl || "";
  if (!driveUrl) return respJson({ erro: "driveUrl ausente" }, 400);

  const folderId = extrairIdDrive(driveUrl);
  if (!folderId) return respJson({ erro: "Não foi possível extrair o ID da pasta do link fornecido." }, 400);

  let token: string;
  try { token = await getAccessToken(); }
  catch (e: any) { return respJson({ erro: `Autenticação Google falhou: ${e.message}` }, 500); }

  let arquivos: {id:string;name:string}[];
  try { arquivos = await listarCSVsNaPasta(folderId, token); }
  catch (e: any) { return respJson({ erro: e.message }, 500); }

  if (arquivos.length === 0) {
    return respJson({ erro: "Nenhum arquivo CSV encontrado na pasta. Certifique-se de que o arquivo foi exportado no formato CSV." }, 400);
  }

  // Usa o CSV mais recente (já ordenado por modifiedTime desc)
  const arquivo = arquivos[0];
  let csvTexto: string;
  try { csvTexto = await baixarArquivo(arquivo.id, token); }
  catch (e: any) { return respJson({ erro: e.message }, 500); }

  const rows = parseCSV(csvTexto);
  if (rows.length === 0) return respJson({ erro: "CSV sem linhas após o cabeçalho." }, 400);

  let atualizados = 0;
  let ignorados = 0;

  for (const row of rows) {
    const transaction = col(row,
      "Código da Transação", "Transação", "transaction", "Transaction Code",
      "Codigo da Transacao", "cod_transacao", "Cód. Transação"
    );
    if (!transaction) { ignorados++; continue; }

    const estado  = col(row, "Estado / Província", "Estado", "UF", "State") || null;
    const cidade  = col(row, "Cidade", "City") || null;

    // Telefone — Hotmart exporta em várias colunas dependendo da versão do relatório
    const telefoneCsv = col(row,
      "Telefone do Comprador", "Telefone", "Celular", "Phone", "Mobile",
      "Telefone do comprador", "telefone", "celular"
    ) || null;

    let telefone: string | null = null;
    if (telefoneCsv) {
      const digits = telefoneCsv.replace(/[^\d+]/g, "");
      if (digits.length >= 8) telefone = digits;
    }

    // Método de pagamento — Hotmart exporta como "Método de pagamento"
    const metodoCsv = col(row,
      "Método de pagamento", "Forma de Pagamento", "Tipo de Pagamento", "Payment Type"
    ) || null;

    // Normalizar para o mesmo padrão do webhook
    let metodo: string | null = null;
    if (metodoCsv) {
      const m = metodoCsv.toLowerCase();
      if (m.includes("pix"))                                   metodo = "pix";
      else if (m.includes("cart") || (m.includes("cr") && m.includes("dit"))) metodo = "credit_card";
      else if (m.includes("billet") || m.includes("boleto"))  metodo = "billet";
      else if (m.includes("paypal"))                           metodo = "paypal";
      else                                                     metodo = metodoCsv;
    }

    // Parcelas — "Quantidade total de parcelas"
    const parcelasCsv = col(row,
      "Quantidade total de parcelas", "Parcelas", "Número de Parcelas", "installments"
    );
    const parcelas = parcelasCsv ? (parseInt(parcelasCsv, 10) || null) : null;

    // Só atualiza campos que ainda estão nulos — não sobrescreve dado de webhook
    const update: Record<string, unknown> = {};
    if (estado) update.comprador_estado = estado;
    if (cidade) update.comprador_cidade = cidade;
    if (metodo) update.metodo_pagamento = metodo;
    if (parcelas) update.parcelas = parcelas;
    if (telefone) update.comprador_telefone = telefone;

    if (Object.keys(update).length === 0) { ignorados++; continue; }

    // Buscar estado atual dos campos para não sobrescrever dado de webhook
    const { data: atual } = await supabase
      .from("vendas")
      .select("comprador_estado, metodo_pagamento, parcelas, comprador_telefone")
      .eq("hotmart_transaction_id", transaction)
      .single();

    if (!atual) { ignorados++; continue; }

    const patch: Record<string, unknown> = {};
    if (!atual.comprador_estado && estado)     patch.comprador_estado    = estado;
    if (!atual.comprador_estado && cidade)     patch.comprador_cidade    = cidade;
    if (!atual.metodo_pagamento && metodo)     patch.metodo_pagamento    = metodo;
    if (!atual.parcelas && parcelas)           patch.parcelas            = parcelas;
    if (!atual.comprador_telefone && telefone) patch.comprador_telefone  = telefone;

    if (Object.keys(patch).length === 0) { ignorados++; continue; }

    const { error } = await supabase
      .from("vendas")
      .update(patch)
      .eq("hotmart_transaction_id", transaction);

    if (!error) atualizados++;
    else ignorados++;
  }

  return respJson({ ok: true, arquivo: arquivo.name, atualizados, ignorados, total: rows.length });
});

function respJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
