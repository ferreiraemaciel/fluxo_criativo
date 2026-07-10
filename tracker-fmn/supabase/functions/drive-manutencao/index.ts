// Tracker FMN — Manutenção de pastas do Drive (nuvem)
// Endpoint: POST /functions/v1/drive-manutencao
// Porta pra nuvem o que era scripts/drive_sync_pastas.py + scripts/drive_organizar.py
// (rodavam só no Mac, dentro do botão "Sincronizar" — descontinuado, 2026-07-10).
//
// O que faz:
//   1. Cria no Drive uma pasta "ADS {numero:03d} - {titulo}" pra cada anúncio
//      cadastrado no Supabase que ainda não tem pasta (idempotente).
//   2. Move pra a subpasta certa qualquer arquivo solto direto na raiz da pasta
//      "Criativos" (detecta o número pelo nome do arquivo, ex: "ADS 303 - x.mp4").
//
// Não mexe em conteúdo do anúncio (media_files, tipo, status) — isso é
// responsabilidade do kanban-sync e do fluxo de importação (cozinha).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CRIATIVOS_ID = "1jskuzz85CD-OCDj-ckA4jCRhwgoUVT7J"; // raiz "Criativos" (Anúncios/Tráfego)
const ADS_PATTERN = /ADS\s*0*(\d+)/i;
const DRIVE_API = "https://www.googleapis.com/drive/v3";

// ── Autenticação Google (JWT assinado com a service account) ────────────────
function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const pem = (sa.private_key as string)
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der.buffer as ArrayBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error("Falha ao obter token Google: " + JSON.stringify(data));
  return data.access_token;
}

// ── Drive helpers ─────────────────────────────────────────────────────────
async function driveList(token: string, q: string): Promise<any[]> {
  const items: any[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({
      q, fields: "nextPageToken,files(id,name,mimeType)", pageSize: "500",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`${DRIVE_API}/files?${qs}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data.error) throw new Error("Drive list falhou: " + JSON.stringify(data.error));
    items.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return items;
}

async function driveCreateFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files?fields=id,name`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  const data = await res.json();
  if (data.error) throw new Error("Drive create folder falhou: " + JSON.stringify(data.error));
  return data.id;
}

async function driveMakePublic(token: string, fileId: string): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

async function driveMoveFile(token: string, fileId: string, destId: string, fromId: string): Promise<void> {
  const qs = new URLSearchParams({ addParents: destId, removeParents: fromId, fields: "id,parents" });
  await fetch(`${DRIVE_API}/files/${fileId}?${qs}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
  });
}

function slugTitulo(titulo: string | null, numero: number): string {
  let t = (titulo || "").replace(new RegExp(`^ADS\\s+0*${numero}\\s*[-–]?\\s*`, "i"), "").trim();
  t = t.replace(/[\\/:*?"<>|]/g, "");
  return t.slice(0, 60).trim();
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Método não permitido", { status: 405 });
  }

  const token = await getAccessToken();

  // ── 1. Cria pasta pra cada anúncio que ainda não tem ───────────────────────
  const { data: ads } = await supabase.from("ads").select("numero, titulo").limit(2000);

  const subpastas = await driveList(
    token,
    `'${CRIATIVOS_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const pastaPorNumero = new Map<number, string>();
  for (const p of subpastas) {
    const m = ADS_PATTERN.exec(p.name || "");
    if (m) pastaPorNumero.set(parseInt(m[1], 10), p.id);
  }

  let criadas = 0;
  const faltando = (ads || []).filter((a) => !pastaPorNumero.has(a.numero));
  for (const a of faltando) {
    const titulo = slugTitulo(a.titulo, a.numero);
    const nome = `ADS ${String(a.numero).padStart(3, "0")}` + (titulo ? ` - ${titulo}` : "");
    const folderId = await driveCreateFolder(token, nome, CRIATIVOS_ID);
    await driveMakePublic(token, folderId);
    pastaPorNumero.set(a.numero, folderId);
    criadas++;
  }

  // ── 2. Organiza arquivo solto direto na raiz de Criativos ──────────────────
  const arquivosSoltos = await driveList(
    token,
    `'${CRIATIVOS_ID}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`
  );

  let movidos = 0, semPasta = 0, semNumero = 0;
  for (const arq of arquivosSoltos) {
    const m = ADS_PATTERN.exec(arq.name || "");
    if (!m) { semNumero++; continue; }
    const num = parseInt(m[1], 10);
    const destId = pastaPorNumero.get(num);
    if (!destId) { semPasta++; continue; }
    await driveMoveFile(token, arq.id, destId, CRIATIVOS_ID);
    movidos++;
  }

  return new Response(JSON.stringify({
    ok: true, pastas_criadas: criadas, arquivos_movidos: movidos,
    sem_pasta: semPasta, sem_numero: semNumero,
  }), { headers: { "Content-Type": "application/json" } });
});
