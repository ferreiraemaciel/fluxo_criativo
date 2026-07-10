/**
 * Cloudflare Worker — ads-media
 *
 * Rotas:
 *   POST /upload-thumb   — recebe arquivo otimizado (imagem ou vídeo comprimido)
 *                          salva em R2 ads/thumbs/, retorna { thumbUrl, mediaUrl }
 *   POST /upload-meta    — recebe URL pública do original no R2,
 *                          sobe no Meta Ads (adimages ou advideos),
 *                          retorna { imageHash } ou { videoId }
 *   POST /upload-original — recebe arquivo original,
 *                           salva em R2 ads/originais/ (temporário),
 *                           retorna { origKey, origUrl }
 *   DELETE /original/:key — deleta original do R2 após Meta upload
 *   GET /                 — health check
 *
 * Secrets (wrangler secret put):
 *   FB_ACCESS_TOKEN   — token permanente com ads_management
 *   FB_AD_ACCOUNT_ID  — act_XXXXXXXXX
 *
 * R2 binding: BUCKET → site-fmn
 * URL pública: https://pub-3af414794ad1436281d1d1b3e9feea36.r2.dev
 */

const R2_PUBLIC  = 'https://pub-3af414794ad1436281d1d1b3e9feea36.r2.dev';
const GRAPH      = 'https://graph.facebook.com/v21.0';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ── /upload-thumb ───────────────────────────────────────────────
   Recebe o arquivo JÁ OTIMIZADO pelo browser (imagem ou vídeo comprimido).
   Salva permanentemente em ads/thumbs/.
   Para vídeo, também salva em ads/media/ (para playback no tracker).
   Para imagem, media = thumb (mesma URL).
─────────────────────────────────────────────────────────────────*/
async function handleUploadThumb(request, env) {
  const form     = await request.formData();
  const file     = form.get('file');
  const adNum    = form.get('ad_num') || 'x';
  const fileType = file?.type || '';

  if (!file) return json({ error: 'Arquivo ausente.' }, 400);

  const isVideo = fileType.startsWith('video/');
  const id      = `${adNum}_${uid()}`;

  // Extensão: mantém original (mp4, jpg, png, jpeg…)
  const extRaw  = file.name.split('.').pop().toLowerCase() || (isVideo ? 'mp4' : 'jpg');

  // Para imagem: thumb e media são o mesmo arquivo
  // Para vídeo : thumb é um frame (enviado como thumb_frame), media é o vídeo comprimido
  const thumbFrame = form.get('thumb_frame'); // Blob WebP — apenas para vídeo

  let thumbKey, mediaKey, thumbUrl, mediaUrl;

  if (isVideo) {
    // Salva vídeo comprimido como media
    mediaKey = `ads/media/${id}.${extRaw}`;
    const videoBytes = await file.arrayBuffer();
    await env.BUCKET.put(mediaKey, videoBytes, {
      httpMetadata: { contentType: fileType },
    });
    mediaUrl = `${R2_PUBLIC}/${mediaKey}`;

    // Salva frame como thumb
    if (thumbFrame) {
      thumbKey = `ads/thumbs/${id}.webp`;
      const frameBytes = await thumbFrame.arrayBuffer();
      await env.BUCKET.put(thumbKey, frameBytes, {
        httpMetadata: { contentType: 'image/webp' },
      });
      thumbUrl = `${R2_PUBLIC}/${thumbKey}`;
    } else {
      // Fallback: usa um placeholder
      thumbUrl  = null;
      thumbKey  = null;
    }
  } else {
    // Imagem: thumb e media são o mesmo arquivo
    const contentType = fileType || (extRaw === 'png' ? 'image/png' : 'image/jpeg');
    thumbKey  = `ads/thumbs/${id}.${extRaw}`;
    const imgBytes = await file.arrayBuffer();
    await env.BUCKET.put(thumbKey, imgBytes, {
      httpMetadata: { contentType },
    });
    thumbUrl  = `${R2_PUBLIC}/${thumbKey}`;
    mediaKey  = thumbKey;
    mediaUrl  = thumbUrl;
  }

  return json({ ok: true, thumbKey, thumbUrl, mediaKey, mediaUrl });
}

/* ── /upload-original ────────────────────────────────────────────
   Recebe o arquivo original (alta resolução / vídeo sem compressão).
   Salva TEMPORARIAMENTE em ads/originais/ para envio ao Meta.
   O caller deve deletar via DELETE /original/:key após Meta confirmar.
─────────────────────────────────────────────────────────────────*/
async function handleUploadOriginal(request, env) {
  const form    = await request.formData();
  const file    = form.get('file');
  const adNum   = form.get('ad_num') || 'x';

  if (!file) return json({ error: 'Arquivo ausente.' }, 400);

  const id     = `${adNum}_${uid()}`;
  const extRaw = file.name.split('.').pop().toLowerCase() || 'bin';
  const origKey = `ads/originais/${id}.${extRaw}`;

  const bytes = await file.arrayBuffer();
  await env.BUCKET.put(origKey, bytes, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  return json({ ok: true, origKey, origUrl: `${R2_PUBLIC}/${origKey}` });
}

/* ── /upload-meta ────────────────────────────────────────────────
   Recebe a URL pública do original no R2 (ou bytes direto via origKey).
   Sobe no Meta Ads e retorna image_hash ou video_id.
   Suporta tipo 'image' e 'video'.
─────────────────────────────────────────────────────────────────*/
async function handleUploadMeta(request, env) {
  const { tipo, origUrl, adAccountId } = await request.json();

  if (!origUrl) return json({ error: 'origUrl ausente.' }, 400);

  const { token, accountId } = metaAcct(env, adAccountId);

  if (tipo === 'video') {
    // Vídeo: POST /advideos com file_url
    const params = new URLSearchParams({
      file_url:     origUrl,
      access_token: token,
    });
    const res  = await fetch(`${GRAPH}/${accountId}/advideos`, { method: 'POST', body: params });
    const data = await res.json();
    if (!data.id) throw new Error(`Meta advideos falhou: ${JSON.stringify(data)}`);
    return json({ ok: true, videoId: data.id });

  } else {
    // Imagem: POST /adimages com url
    const params = new URLSearchParams({
      url:          origUrl,
      access_token: token,
    });
    const res  = await fetch(`${GRAPH}/${accountId}/adimages`, { method: 'POST', body: params });
    const data = await res.json();

    // adimages retorna { images: { filename: { hash, url, ... } } }
    const images = data.images || {};
    const first  = Object.values(images)[0];
    if (!first?.hash) throw new Error(`Meta adimages falhou: ${JSON.stringify(data)}`);
    return json({ ok: true, imageHash: first.hash });
  }
}

/* ── DELETE /original/:key ───────────────────────────────────────*/
async function handleDeleteOriginal(key, env) {
  await env.BUCKET.delete(key);
  return json({ ok: true });
}

/* ================================================================
   PUBLICAÇÃO NO META (campanha → conjunto → criativo → anúncio)
   Todas as entidades são criadas PAUSADAS. A ativação acontece
   depois, em massa, via /activate-ads.
   ================================================================ */

// Objetivos suportados pelo botão "nova campanha" do Tracker.
// Mapeiam para os objetivos ODAX atuais da Marketing API.
const OBJETIVOS = {
  vendas:    { objective: 'OUTCOME_SALES',   optimization_goal: 'OFFSITE_CONVERSIONS' },
  cadastros: { objective: 'OUTCOME_LEADS',   optimization_goal: 'OFFSITE_CONVERSIONS' },
  trafego:   { objective: 'OUTCOME_TRAFFIC', optimization_goal: 'LINK_CLICKS' },
};

function metaAcct(env, adAccountId) {
  const token = env.FB_ACCESS_TOKEN;
  let accountId = adAccountId || env.FB_AD_ACCOUNT_ID || '';
  // Normaliza: a Graph API exige o prefixo act_ no ID da conta.
  if (accountId && !accountId.startsWith('act_')) accountId = `act_${accountId}`;
  return { token, accountId };
}

async function graphGet(path, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res  = await fetch(`${GRAPH}/${path}?${qs}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data;
}

async function graphPost(path, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token });
  const res  = await fetch(`${GRAPH}/${path}`, { method: 'POST', body });
  const data = await res.json();
  if (data.error) {
    const e = data.error;
    const detail = [e.message, e.error_user_title, e.error_user_msg]
      .filter(Boolean).join(' | ');
    throw new Error(`${detail} (code:${e.code}/${e.error_subcode || '-'})`);
  }
  return data;
}

/* ── GET /campaigns → lista campanhas da conta ───────────────────*/
async function handleListCampaigns(request, env) {
  const url = new URL(request.url);
  const { token, accountId } = metaAcct(env, url.searchParams.get('account'));
  const data = await graphGet(`${accountId}/campaigns`, {
    fields: 'id,name,objective,status,effective_status,daily_budget,lifetime_budget',
    limit:  '200',
  }, token);
  return json({ ok: true, campaigns: data.data || [] });
}

/* ── GET /video-status?id=VIDEO_ID → status de processamento ──────
   Vídeo enviado ao Meta processa de forma assíncrona. Retorna
   { ok, ready, status } para o Tracker esperar antes de criar o ad.
─────────────────────────────────────────────────────────────────*/
async function handleVideoStatus(request, env) {
  const url = new URL(request.url);
  const id  = url.searchParams.get('id');
  if (!id) return json({ error: 'id ausente.' }, 400);
  const { token } = metaAcct(env, null);
  const data = await graphGet(id, { fields: 'status' }, token);
  const vs = data?.status?.video_status || 'unknown';
  return json({ ok: true, ready: vs === 'ready', status: vs });
}

/* ── GET /adsets?campaign=ID → lista conjuntos de uma campanha ────*/
async function handleListAdsets(request, env) {
  const url = new URL(request.url);
  const campaignId = url.searchParams.get('campaign');
  const { token, accountId } = metaAcct(env, url.searchParams.get('account'));
  const path = campaignId ? `${campaignId}/adsets` : `${accountId}/adsets`;
  const data = await graphGet(path, {
    fields: 'id,name,status,effective_status,campaign_id,daily_budget',
    limit:  '200',
  }, token);
  return json({ ok: true, adsets: data.data || [] });
}

/* ── POST /create-campaign ───────────────────────────────────────
   body: { nome, objetivo, dailyBudget? (centavos), adAccountId? }
   Se dailyBudget vier → CBO (orçamento na campanha).
   Se não vier → ABO (orçamento fica no conjunto).
─────────────────────────────────────────────────────────────────*/
async function handleCreateCampaign(request, env) {
  const { nome, objetivo, dailyBudget, adAccountId } = await request.json();
  const conf = OBJETIVOS[objetivo];
  if (!conf) return json({ error: `Objetivo inválido: ${objetivo}` }, 400);

  const { token, accountId } = metaAcct(env, adAccountId);
  const params = {
    name:                  nome,
    objective:             conf.objective,
    status:                'PAUSED',
    special_ad_categories: '[]',
  };
  if (dailyBudget) {
    // CBO: orçamento e estratégia de lance na campanha.
    params.daily_budget = String(dailyBudget);
    params.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
  } else {
    // ABO: campanha não gerencia orçamento (conta exige este campo).
    params.is_adset_budget_sharing_enabled = 'false';
  }
  const data = await graphPost(`${accountId}/campaigns`, params, token);
  return json({ ok: true, campaignId: data.id, cbo: !!dailyBudget });
}

/* ── POST /create-adset ──────────────────────────────────────────
   body: {
     nome, campaignId, dailyBudget (centavos, ex "5000" = R$50),
     objetivo, pixelId?, customEventType? (ex 'PURCHASE'),
     countries? (ex ["BR"]), ageMin?, ageMax?, adAccountId?
   }
   Cria conjunto PAUSADO, Advantage+ placements automáticos,
   otimização por conversão (pixel) para vendas/cadastros,
   por cliques para tráfego.
─────────────────────────────────────────────────────────────────*/
async function handleCreateAdset(request, env) {
  const b = await request.json();
  const conf = OBJETIVOS[b.objetivo] || OBJETIVOS.vendas;
  const { token, accountId } = metaAcct(env, b.adAccountId);

  const targeting = {
    geo_locations:            { countries: b.countries && b.countries.length ? b.countries : ['BR'] },
    age_min:                  b.ageMin || 18,
    age_max:                  b.ageMax || 65,
    targeting_automation:     { advantage_audience: 1 },
  };

  const params = {
    name:               b.nome,
    campaign_id:        b.campaignId,
    billing_event:      'IMPRESSIONS',
    optimization_goal:  conf.optimization_goal,
    status:             'PAUSED',
    targeting:          JSON.stringify(targeting),
  };

  // ABO: orçamento e lance no conjunto. CBO: campanha já gerencia, não repetir.
  if (!b.cbo) {
    params.daily_budget = String(b.dailyBudget || 5000);
    params.bid_strategy = 'LOWEST_COST_WITHOUT_CAP';
  }

  // Conversão via pixel (vendas e cadastros)
  if (conf.optimization_goal === 'OFFSITE_CONVERSIONS') {
    const pixelId = b.pixelId || env.FB_PIXEL_ID;
    const evt     = b.customEventType || (b.objetivo === 'cadastros' ? 'LEAD' : 'PURCHASE');
    params.promoted_object = JSON.stringify({ pixel_id: pixelId, custom_event_type: evt });
  }

  const data = await graphPost(`${accountId}/adsets`, params, token);
  return json({ ok: true, adsetId: data.id });
}

/* ── POST /create-ad ─────────────────────────────────────────────
   Monta o criativo (link ad) e cria o anúncio PAUSADO ligado ao conjunto.
   body: {
     nome, adsetId, pageId?, instagramActorId?,
     imageUrl? (URL pública R2, preferido) | imageHash? | videoId?,
     thumbUrl? (obrigatório p/ vídeo),
     mensagem (texto principal), titulo, descricao,
     link, cta (ex 'LEARN_MORE'), adAccountId?
   }
   Obs: usa link_data.picture (URL) em vez de image_hash, porque o App
   do token não tem capacidade para /adimages (erro #3).
─────────────────────────────────────────────────────────────────*/
async function handleCreateAd(request, env) {
  const b = await request.json();
  const { token, accountId } = metaAcct(env, b.adAccountId);
  const pageId = b.pageId || env.FB_PAGE_ID;

  const linkData = {
    message:     b.mensagem || '',
    link:        b.link,
    name:        b.titulo || '',
    description: b.descricao || '',
    call_to_action: { type: b.cta || 'LEARN_MORE', value: { link: b.link } },
  };

  let creativeParams;
  if (b.videoId) {
    // Criativo de vídeo
    const videoData = {
      video_id:       b.videoId,
      message:        b.mensagem || '',
      title:          b.titulo || '',
      link_description: b.descricao || '',
      call_to_action: { type: b.cta || 'LEARN_MORE', value: { link: b.link } },
      image_url:      b.thumbUrl || undefined,
    };
    creativeParams = {
      name:              `Criativo ${b.nome}`,
      object_story_spec: JSON.stringify({
        page_id:           pageId,
        instagram_user_id: b.instagramUserId || env.FB_INSTAGRAM_ACTOR_ID || undefined,
        video_data:        videoData,
      }),
    };
  } else {
    // Criativo de imagem. Preferir picture (URL R2); image_hash como fallback.
    if (b.imageUrl)       linkData.picture = b.imageUrl;
    else if (b.imageHash) linkData.image_hash = b.imageHash;
    creativeParams = {
      name:              `Criativo ${b.nome}`,
      object_story_spec: JSON.stringify({
        page_id:           pageId,
        instagram_user_id: b.instagramUserId || env.FB_INSTAGRAM_ACTOR_ID || undefined,
        link_data:         linkData,
      }),
    };
  }

  // Parâmetros de URL (rastreamento). Campo url_tags do criativo, sem o '?' inicial.
  if (b.urlTags) creativeParams.url_tags = String(b.urlTags).replace(/^\?/, '');

  const creative = await graphPost(`${accountId}/adcreatives`, creativeParams, token);

  const ad = await graphPost(`${accountId}/ads`, {
    name:       b.nome,
    adset_id:   b.adsetId,
    creative:   JSON.stringify({ creative_id: creative.id }),
    status:     'PAUSED',
  }, token);

  return json({
    ok: true,
    adId:       ad.id,
    creativeId: creative.id,
    adUrl:      `https://www.facebook.com/adsmanager/manage/ads?act=${accountId.replace('act_','')}&selected_ad_ids=${ad.id}`,
  });
}

/* ── POST /activate-ads ──────────────────────────────────────────
   "Ativar tudo no Meta". Recebe uma lista de entidades e liga
   campanha + conjunto + anúncio de cada uma (ACTIVE).
   body: { itens: [{ campaignId, adsetId, adId }, ...] }
   Retorna por item ok/erro para o Tracker atualizar o status.
─────────────────────────────────────────────────────────────────*/
async function handleActivateAds(request, env) {
  const { itens, adAccountId } = await request.json();
  const { token } = metaAcct(env, adAccountId);
  const resultados = [];

  for (const it of (itens || [])) {
    try {
      // Ativa de cima pra baixo: campanha → conjunto → anúncio.
      if (it.campaignId) await graphPost(it.campaignId, { status: 'ACTIVE' }, token);
      if (it.adsetId)    await graphPost(it.adsetId,    { status: 'ACTIVE' }, token);
      if (it.adId)       await graphPost(it.adId,       { status: 'ACTIVE' }, token);
      resultados.push({ adId: it.adId, ok: true });
    } catch (err) {
      resultados.push({ adId: it.adId, ok: false, error: err.message });
    }
  }
  return json({ ok: true, resultados });
}

/* ── /ads-status ───────────────────────────────────────────────────────────
   Confere no Meta se cada ad_id ainda existe e não foi deletado/arquivado
   manualmente no Gerenciador. Usado antes de listar os "pendentes de ativar",
   pra não mostrar anúncio que já não existe mais do lado do Meta.           */
async function handleAdsStatus(request, env, url) {
  const idsParam = url.searchParams.get('ids') || '';
  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return json({ ok: true, status: {} });

  const { token } = metaAcct(env);
  const pares = await Promise.all(ids.map(async id => {
    try {
      const r = await fetch(`${GRAPH}/${id}?fields=effective_status&access_token=${token}`);
      const d = await r.json();
      if (d.error) return [id, { existe: false, motivo: d.error.message }];
      const sumiu = ['DELETED', 'ARCHIVED'].includes(d.effective_status);
      return [id, { existe: !sumiu, effective_status: d.effective_status }];
    } catch (e) {
      return [id, { existe: false, motivo: e.message }];
    }
  }));
  return json({ ok: true, status: Object.fromEntries(pares) });
}

/* ── Importação do Drive (cozinha) — TRÁFEGO ────────────────────────────────
   Mesmo motor do orgânico, mas mapeando o resultado pro formato do ANÚNCIO:
   media_url (array de URLs), thumb_url, media_tipo. A tabela `ads` tem `numero`
   real, então direto/geral usam ele. Protegido por IMPORT_TOKEN.             */
const COZINHA_URL = 'https://cozinha-296334646934.us-central1.run.app';
const TRACKER_TRAFEGO_ROOT = '1jskuzz85CD-OCDj-ckA4jCRhwgoUVT7J';

function parseFolderId(s) { const m = String(s || '').match(/[-\w]{25,}/); return m ? m[0] : null; }

async function handlePut(request, env, url) {
  if (request.headers.get('X-Token') !== env.IMPORT_TOKEN) return json({ error: 'não autorizado' }, 401);
  const key = url.searchParams.get('key');
  const ct  = url.searchParams.get('ct') || 'application/octet-stream';
  if (!key) return json({ error: 'key ausente' }, 400);
  const body = await request.arrayBuffer();
  await env.BUCKET.put(key, body, { httpMetadata: { contentType: ct } });
  return json({ ok: true, url: `${R2_PUBLIC}/${key}` });
}

/* Recebe o formato genérico da cozinha (slides + media_files) e grava no
   formato do anúncio (media_url array, thumb_url, media_tipo, tipo).          */
async function handleCardSlides(request, env) {
  if (request.headers.get('X-Token') !== env.IMPORT_TOKEN) return json({ error: 'não autorizado' }, 401);
  let body; try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { card_id } = body;
  if (!card_id) return json({ error: 'card_id é obrigatório' }, 400);
  const slides = typeof body.slides === 'string' ? JSON.parse(body.slides || '[]') : (body.slides || []);
  const mfiles = typeof body.media_files === 'string' ? JSON.parse(body.media_files || '[]') : (body.media_files || []);

  let media_tipo, media_url, thumb_url, tipo;
  if (mfiles.length && mfiles[0].tipo === 'video') {
    media_tipo = 'video';
    media_url  = JSON.stringify([mfiles[0].url_alta]);   // anúncio publica a versão alta
    thumb_url  = mfiles[0].thumb_url;
    tipo = 'reels';
  } else {
    const urls = slides.map(s => s.image_url);
    media_tipo = 'imagem';
    media_url  = JSON.stringify(urls);
    thumb_url  = urls[0] || null;
    tipo = urls.length > 1 ? 'carrossel' : 'imagem';
  }
  const patch = { media_url, thumb_url, media_tipo, tipo, media_files: JSON.stringify(mfiles) };

  // A tabela `ads` é operada por numero (não pelo uuid). card_id aqui = numero.
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/ads?numero=eq.${card_id}`, {
    method: 'PATCH',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return json({ error: 'Supabase ' + res.status + ': ' + (await res.text()).slice(0, 200) }, 500);

  // Card que estava em "Fazer" e recebeu mídia avança sozinho pra "Fazendo".
  // Filtro condicional: só afeta a linha se ainda estiver em 'fazer' (idempotente).
  await fetch(`${env.SUPABASE_URL}/rest/v1/ads?numero=eq.${card_id}&status=eq.fazer`, {
    method: 'PATCH',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'fazendo' }),
  }).catch(() => {});

  return json({ ok: true });
}

async function cozinhaTrafego(env, payload) {
  let r;
  try {
    r = await fetch(`${COZINHA_URL}/importar`, {
      method: 'POST', headers: { 'X-Token': env.IMPORT_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: 'tracker_trafego', ...payload }),
    });
  } catch {
    // subrequest estourou a janela (~100s): a cozinha continua e grava o card
    return { ok: true, processando: true };
  }
  // Vídeo pesado pode devolver 524, mas a cozinha (gunicorn timeout 600s)
  // termina e grava o card mesmo assim. Tratamos como "processando".
  if (r.status === 524 || r.status === 522 || r.status === 504) {
    return { ok: true, processando: true };
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error || `cozinha ${r.status}`);
  return d;
}

/* Repassa o andamento do trabalho da cozinha (barra de progresso). */
async function handleProgresso(request, env, url) {
  const jobId = url.searchParams.get('job');
  if (!jobId) return json({ error: 'job ausente' }, 400);
  try {
    const r = await fetch(`${COZINHA_URL}/progresso/${jobId}`, { headers: { 'X-Token': env.IMPORT_TOKEN } });
    const d = await r.json().catch(() => ({}));
    return json(d, r.ok ? 200 : r.status);
  } catch { return json({ etapa: 'Processando', pct: 0, done: false, erro: null }); }
}

async function handleImportLink(request, env) {
  let body; try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { numero, drive_url, job_id } = body;
  if (numero == null || !drive_url) return json({ error: 'numero e drive_url são obrigatórios' }, 400);
  const folderId = parseFolderId(drive_url);
  if (!folderId) return json({ error: 'link inválido' }, 400);
  // guarda o link no card p/ direto/geral
  await fetch(`${env.SUPABASE_URL}/rest/v1/ads?numero=eq.${numero}`, {
    method: 'PATCH', headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ media_drive_url: drive_url }) });
  try { const d = await cozinhaTrafego(env, { drive_folder_id: folderId, card_id: numero, job_id }); return json({ ok: true, processando: d.processando, imagens: d.imagens, videos: d.videos }); }
  catch (e) { return json({ error: e.message }, 500); }
}

async function handleImportDireto(request, env) {
  let body; try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { numero, job_id } = body;
  if (numero == null) return json({ error: 'numero é obrigatório' }, 400);
  try { const d = await cozinhaTrafego(env, { root_folder_id: TRACKER_TRAFEGO_ROOT, numero, card_id: numero, job_id }); return json({ ok: true, processando: d.processando, imagens: d.imagens, videos: d.videos }); }
  catch (e) { return json({ error: e.message }, 500); }
}

async function handleImportGeral(request, env) {
  let body; try { body = await request.json(); } catch { body = {}; }
  const job_id = body.job_id;
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/ads?select=numero&order=numero.asc`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  const ads = await res.json().catch(() => []);
  let ok = 0, fail = 0; const erros = [];
  for (const a of ads) {
    if (a.numero == null) continue;
    try { await cozinhaTrafego(env, { root_folder_id: TRACKER_TRAFEGO_ROOT, numero: a.numero, card_id: a.numero, job_id }); ok++; }
    catch (e) { if (/não encontrada/.test(e.message)) continue; fail++; erros.push({ numero: a.numero, erro: e.message }); }
  }
  return json({ ok: true, total: ads.length, importados: ok, falhas: fail, erros });
}

/* ── Router ──────────────────────────────────────────────────────*/
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    try {
      if (method === 'POST') {
        if (url.pathname === '/upload-thumb')    return await handleUploadThumb(request, env);
        if (url.pathname === '/upload-original') return await handleUploadOriginal(request, env);
        if (url.pathname === '/upload-meta')     return await handleUploadMeta(request, env);
        if (url.pathname === '/create-campaign') return await handleCreateCampaign(request, env);
        if (url.pathname === '/create-adset')    return await handleCreateAdset(request, env);
        if (url.pathname === '/create-ad')       return await handleCreateAd(request, env);
        if (url.pathname === '/activate-ads')    return await handleActivateAds(request, env);
        if (url.pathname === '/put')             return await handlePut(request, env, url);
        if (url.pathname === '/card-slides')     return await handleCardSlides(request, env);
        if (url.pathname === '/import-link')     return await handleImportLink(request, env);
        if (url.pathname === '/import-direto')   return await handleImportDireto(request, env);
        if (url.pathname === '/import-geral')    return await handleImportGeral(request, env);
      }
      if (method === 'DELETE' && url.pathname.startsWith('/original/')) {
        const key = decodeURIComponent(url.pathname.replace('/original/', ''));
        return await handleDeleteOriginal(key, env);
      }
      if (method === 'GET') {
        if (url.pathname === '/campaigns')    return await handleListCampaigns(request, env);
        if (url.pathname === '/adsets')       return await handleListAdsets(request, env);
        if (url.pathname === '/video-status') return await handleVideoStatus(request, env);
        if (url.pathname === '/progresso')    return await handleProgresso(request, env, url);
        if (url.pathname === '/ads-status')    return await handleAdsStatus(request, env, url);
        return json({ ok: true, service: 'ads-media' });
      }

      return json({ error: 'Rota não encontrada.' }, 404);

    } catch (err) {
      console.error('[ads-media]', err.message, err.stack);
      return json({ ok: false, error: err.message }, 500);
    }
  },
};
