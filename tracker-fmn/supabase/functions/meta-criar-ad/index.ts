// Tracker FMN — Criar anúncio no Meta a partir de um criativo do Tracker
// POST /functions/v1/meta-criar-ad   { action: "campaigns" }
// POST /functions/v1/meta-criar-ad   { action: "adsets", campaign_id }
// POST /functions/v1/meta-criar-ad   { action: "create", adset_id, card }

const META_TOKEN    = Deno.env.get("FB_ACCESS_TOKEN_PERMANENTE")!;
const AD_ACCOUNT_ID = Deno.env.get("FB_AD_ACCOUNT_ID")!;
const PAGE_ID       = Deno.env.get("FB_PAGE_ID")!;
const IG_ACTOR_ID   = Deno.env.get("FB_INSTAGRAM_ACTOR_ID");
const PIXEL_ID      = Deno.env.get("FB_PIXEL_ID")!;
const GRAPH         = "https://graph.facebook.com/v25.0";
const CORS          = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function graphGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", META_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString());
  return r.json();
}

async function graphPost(path: string, body: Record<string, unknown>) {
  const url = `${GRAPH}${path}`;
  const form = new URLSearchParams();
  form.set("access_token", META_TOKEN);
  for (const [k, v] of Object.entries(body)) {
    form.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  const r = await fetch(url, { method: "POST", body: form });
  return r.json();
}

// ── Listar campanhas ATIVAS ───────────────────────────────────────────────────
async function listCampaigns() {
  const data = await graphGet(`/act_${AD_ACCOUNT_ID}/campaigns`, {
    fields: "id,name,status,objective",
    effective_status: '["ACTIVE"]',
    limit: "50",
  });
  if (data.error) throw new Error(data.error.message);
  return (data.data || []).map((c: Record<string, string>) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    objective: c.objective,
  }));
}

// ── Criar campanha ────────────────────────────────────────────────────────────
async function createCampaign(name: string, objective: string, dailyBudget: number) {
  const res = await graphPost(`/act_${AD_ACCOUNT_ID}/campaigns`, {
    name,
    objective,
    status: "ACTIVE",
    special_ad_categories: "[]",
    ...(dailyBudget ? { daily_budget: Math.round(dailyBudget * 100) } : {}),
  });
  if (res.error) throw new Error(res.error.message);
  return { id: res.id, name, status: "ACTIVE", objective };
}

// ── Listar conjuntos ATIVOS de uma campanha ───────────────────────────────────
async function listAdsets(campaignId: string) {
  const data = await graphGet(`/${campaignId}/adsets`, {
    fields: "id,name,status,daily_budget,optimization_goal",
    effective_status: '["ACTIVE"]',
    limit: "50",
  });
  if (data.error) throw new Error(data.error.message);
  return (data.data || []).map((a: Record<string, string>) => ({
    id: a.id,
    name: a.name,
    status: a.status,
  }));
}

// ── Criar conjunto de anúncios ────────────────────────────────────────────────
async function createAdset(campaignId: string, name: string, dailyBudget: number) {
  const res = await graphPost(`/act_${AD_ACCOUNT_ID}/adsets`, {
    name,
    campaign_id: campaignId,
    daily_budget: Math.round(dailyBudget * 100),
    billing_event: "IMPRESSIONS",
    optimization_goal: "OFFSITE_CONVERSIONS",
    status: "ACTIVE",
    targeting: JSON.stringify({
      geo_locations: { countries: ["BR"] },
      age_min: 20,
      age_max: 65,
    }),
    promoted_object: JSON.stringify({
      pixel_id: PIXEL_ID,
      custom_event_type: "PURCHASE",
    }),
  });
  if (res.error) throw new Error(res.error.message);
  return { id: res.id, name, status: "ACTIVE" };
}

// ── Criar anúncio (imagem) ─────────────────────────────────────────────────────
async function createAdFromImage(adsetId: string, card: Record<string, unknown>, utm: string) {
  const fileId = (card.file_id as string) || "";
  const imageUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  // 1. Fazer upload da imagem para a conta de anúncios
  const uploadRes = await graphPost(`/act_${AD_ACCOUNT_ID}/adimages`, {
    url: imageUrl,
  });
  if (uploadRes.error) throw new Error(`Upload imagem: ${uploadRes.error.message}`);
  const imageHash = Object.values(uploadRes.images as Record<string, {hash: string}>)[0]?.hash;
  if (!imageHash) throw new Error("Hash da imagem não retornado pelo Meta");

  // 2. Criar creative
  const linkData: Record<string, unknown> = {
    image_hash: imageHash,
    link: buildLink(card, utm),
    message: card.texto_principal || card.hook || "",
    call_to_action: { type: "LEARN_MORE" },
  };
  if (card.titulo_ad) linkData.name = card.titulo_ad;
  if (card.descricao_ad) linkData.description = card.descricao_ad;

  const storySpec: Record<string, unknown> = { page_id: PAGE_ID, link_data: linkData };
  // instagram_user_id omitido — requer ID de conta Instagram válido

  const adCreative = await graphPost(`/act_${AD_ACCOUNT_ID}/adcreatives`, {
    name: `ADS ${card.num}`,
    object_story_spec: JSON.stringify(storySpec),
  });
  if (adCreative.error) throw new Error(`Creative: ${adCreative.error.message} | code:${adCreative.error.code} | subcode:${adCreative.error.error_subcode} | user:${adCreative.error.error_user_msg}`);

  // 3. Criar ad
  return createAd(adsetId, card, adCreative.id);
}

// ── Abrir stream do Drive (dois passos para arquivos grandes) ─────────────────
async function openDriveStream(id: string): Promise<{ response: Response; fileSize: number }> {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

  const firstUrl = `https://drive.google.com/uc?export=download&id=${id}`;
  const firstRes = await fetch(firstUrl, { redirect: "follow", headers: { "User-Agent": ua } });
  const ct = firstRes.headers.get("content-type") || "";

  // Arquivo pequeno — retornou direto
  if (!ct.includes("text/html")) {
    const fileSize = parseInt(firstRes.headers.get("content-length") || "0");
    return { response: firstRes, fileSize };
  }

  // Arquivo grande — página de confirmação de vírus
  const setCookie = firstRes.headers.get("set-cookie") || "";
  const nidM = setCookie.match(/NID=[^;]+/);
  const cookieHeader = nidM ? nidM[0] : "";
  const html = await firstRes.text();
  const uuidM = html.match(/name="uuid"\s+value="([^"]+)"/);
  if (!uuidM) throw new Error(`Drive: UUID não encontrado. Arquivo pode exigir login.`);

  const dlUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t&uuid=${uuidM[1]}`;
  const dlHeaders: Record<string, string> = { "User-Agent": ua };
  if (cookieHeader) dlHeaders["Cookie"] = cookieHeader;

  const r2 = await fetch(dlUrl, { redirect: "follow", headers: dlHeaders });
  const ct2 = r2.headers.get("content-type") || "";
  if (ct2.includes("text/html")) throw new Error(`Drive retornou HTML no download final. ct=${ct2}`);
  const fileSize = parseInt(r2.headers.get("content-length") || "0");
  return { response: r2, fileSize };
}

// ── Upload de vídeo com chunked API do Meta ────────────────────────────────────
// Evita bufferizar o arquivo inteiro e respeita o timeout da Edge Function.
async function uploadVideoChunked(
  bodyStream: ReadableStream<Uint8Array>,
  fileSize: number,
  card: Record<string, unknown>,
): Promise<string> {
  if (fileSize === 0) {
    // Content-Length ausente: buffer completo como fallback (arquivos pequenos)
    const reader = bodyStream.getReader();
    const parts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) parts.push(value);
    }
    const total = parts.reduce((a, c) => a + c.length, 0);
    const buf = new Uint8Array(total);
    let pos = 0;
    for (const p of parts) { buf.set(p, pos); pos += p.length; }
    const form = new FormData();
    form.set("access_token", META_TOKEN);
    form.set("title", `ADS ${card.num}`);
    form.set("source", new Blob([buf], { type: "video/mp4" }), `ads${card.num}.mp4`);
    const r = await fetch(`${GRAPH}/act_${AD_ACCOUNT_ID}/advideos`, { method: "POST", body: form });
    const j = await r.json();
    if (j.error) throw new Error(`Upload vídeo: ${j.error.message}`);
    if (!j.id) throw new Error(`Upload vídeo: sem ID. Resposta: ${JSON.stringify(j)}`);
    return j.id;
  }

  // Fase START — iniciar sessão de upload chunked
  const sessionRes = await graphPost(`/act_${AD_ACCOUNT_ID}/advideos`, {
    upload_phase: "start",
    file_size: fileSize.toString(),
  });
  if (sessionRes.error) throw new Error(`Upload sessão: ${sessionRes.error.message}`);

  const sessionId = sessionRes.upload_session_id as string;
  const videoId   = sessionRes.video_id as string;
  let startOffset = parseInt(sessionRes.start_offset as string);
  let endOffset   = parseInt(sessionRes.end_offset   as string);

  // Buffer streaming: acumula bytes do Drive e libera para Meta chunk por chunk
  const reader = bodyStream.getReader();
  const pending: Uint8Array[] = [];
  let pendingSize = 0;

  async function readMore() {
    const { done, value } = await reader.read();
    if (!done && value) { pending.push(value); pendingSize += value.length; }
    return done;
  }

  function consume(n: number): Uint8Array {
    const out = new Uint8Array(n);
    let pos = 0, rem = n;
    while (rem > 0 && pending.length > 0) {
      const first = pending[0];
      const take = Math.min(first.length, rem);
      out.set(first.subarray(0, take), pos);
      pos += take; rem -= take; pendingSize -= take;
      if (take === first.length) pending.shift();
      else pending[0] = first.subarray(take);
    }
    return out;
  }

  // Fase TRANSFER — enviar chunks
  while (startOffset < fileSize) {
    const need = endOffset - startOffset;
    while (pendingSize < need) {
      const done = await readMore();
      if (done) break;
    }
    const chunkData = consume(Math.min(need, pendingSize));

    const form = new FormData();
    form.set("access_token", META_TOKEN);
    form.set("upload_phase", "transfer");
    form.set("upload_session_id", sessionId);
    form.set("start_offset", startOffset.toString());
    form.set("end_offset", endOffset.toString());
    form.set("video_file_chunk", new Blob([chunkData], { type: "video/mp4" }), "chunk.mp4");

    const r = await fetch(`${GRAPH}/act_${AD_ACCOUNT_ID}/advideos`, { method: "POST", body: form });
    const j = await r.json();
    if (j.error) throw new Error(`Chunk [${startOffset}-${endOffset}]: ${j.error.message} | code:${j.error.code}`);

    startOffset = parseInt(j.start_offset as string);
    endOffset   = parseInt(j.end_offset   as string);
  }

  reader.cancel().catch(() => {});

  // Fase FINISH — finalizar upload e associar título
  const finishRes = await graphPost(`/act_${AD_ACCOUNT_ID}/advideos`, {
    upload_phase: "finish",
    upload_session_id: sessionId,
    title: `ADS ${card.num}`,
  });
  if (finishRes.error) throw new Error(`Upload finish: ${finishRes.error.message}`);

  return videoId;
}

// ── Criar anúncio (vídeo) ──────────────────────────────────────────────────────
async function createAdFromVideo(adsetId: string, card: Record<string, unknown>, utm: string) {
  const fileId = (card.file_id as string) || "";

  // 1. Abrir stream do Drive
  const { response: driveRes, fileSize } = await openDriveStream(fileId);

  // 2. Upload chunked para o Meta (sem bufferizar o arquivo inteiro)
  const videoId = await uploadVideoChunked(driveRes.body!, fileSize, card);

  // 3. Criar creative
  const adCreative = await graphPost(`/act_${AD_ACCOUNT_ID}/adcreatives`, {
    name: `ADS ${card.num}`,
    object_story_spec: JSON.stringify({
      page_id: PAGE_ID,
      video_data: {
        video_id: videoId,
        image_url: `https://drive.google.com/thumbnail?id=${card.file_id}&sz=w1280`,
        title: card.titulo_ad || "",
        message: card.texto_principal || card.hook || "",
        link_description: card.descricao_ad || "",
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: buildLink(card, utm) },
        },
      },
    }),
  });
  if (adCreative.error) throw new Error(`Creative: ${adCreative.error.message} | code:${adCreative.error.code} | user:${adCreative.error.error_user_msg}`);
  if (!adCreative.id) throw new Error(`Creative: sem ID. Resposta: ${JSON.stringify(adCreative)}`);

  // 4. Criar ad
  const adResult = await createAd(adsetId, card, adCreative.id);
  return { ...adResult, _debug: { video_id: videoId, creative_id: adCreative.id } };
}

function buildLink(card: Record<string, unknown>, utm: string) {
  const base = "https://fotografiaemeunegocio.com/mcv";
  return utm ? `${base}?${utm}` : base;
}

async function createAd(adsetId: string, card: Record<string, unknown>, creativeId: string) {
  const res = await graphPost(`/act_${AD_ACCOUNT_ID}/ads`, {
    name: `ADS ${card.num} — ${card.titulo || card.hook || ""}`,
    adset_id: adsetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: "PAUSED",
  });
  if (res.error) throw new Error(`Criar ad: ${res.error.message} | code:${res.error.code} | user:${res.error.error_user_msg}`);
  if (!res.id) throw new Error(`Criar ad: sem ID retornado. Resposta: ${JSON.stringify(res)}`);
  return { ad_id: res.id };
}

// ── Handler principal ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Payload inválido" }, 400); }

  try {
    const action = body.action as string;

    if (action === "campaigns") {
      const campaigns = await listCampaigns();
      return json({ campaigns });
    }

    if (action === "adsets") {
      const adsets = await listAdsets(body.campaign_id as string);
      return json({ adsets });
    }

    if (action === "create") {
      const { adset_id, card, utm } = body as {
        adset_id: string;
        card: Record<string, unknown>;
        utm: string;
      };
      if (!adset_id || !card) return json({ error: "adset_id e card são obrigatórios" }, 400);

      const mediaType = (card.media_tipo as string) || "";
      const isVideo   = ["reels", "video"].includes(mediaType);

      let result;
      if (isVideo) {
        result = await createAdFromVideo(adset_id, card, utm);
      } else {
        result = await createAdFromImage(adset_id, card, utm);
      }
      return json({ ok: true, ...result });
    }

    if (action === "pause_ad") {
      const { ad_id } = body as { ad_id: string };
      if (!ad_id) return json({ error: "ad_id é obrigatório" }, 400);
      const res = await graphPost(`/${ad_id}`, { status: "PAUSED" });
      if (res.error) return json({ error: res.error.message }, 500);
      return json({ ok: true, success: res.success ?? true });
    }

    if (action === "create_campaign") {
      const { name, objective, daily_budget } = body as { name: string; objective: string; daily_budget: number };
      if (!name || !objective) return json({ error: "name e objective são obrigatórios" }, 400);
      const campaign = await createCampaign(name, objective, daily_budget || 0);
      return json({ campaign });
    }

    if (action === "create_adset") {
      const { campaign_id, name, daily_budget } = body as {
        campaign_id: string; name: string; daily_budget: number;
      };
      if (!campaign_id || !name || !daily_budget) return json({ error: "campaign_id, name e daily_budget são obrigatórios" }, 400);
      const adset = await createAdset(campaign_id, name, daily_budget);
      return json({ adset });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: msg }, 500);
  }
});
