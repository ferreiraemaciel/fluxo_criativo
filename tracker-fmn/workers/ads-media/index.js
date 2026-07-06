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
      }
      if (method === 'DELETE' && url.pathname.startsWith('/original/')) {
        const key = decodeURIComponent(url.pathname.replace('/original/', ''));
        return await handleDeleteOriginal(key, env);
      }
      if (method === 'GET') {
        if (url.pathname === '/campaigns')    return await handleListCampaigns(request, env);
        if (url.pathname === '/adsets')       return await handleListAdsets(request, env);
        if (url.pathname === '/video-status') return await handleVideoStatus(request, env);
        return json({ ok: true, service: 'ads-media' });
      }

      return json({ error: 'Rota não encontrada.' }, 404);

    } catch (err) {
      console.error('[ads-media]', err.message, err.stack);
      return json({ ok: false, error: err.message }, 500);
    }
  },
};
