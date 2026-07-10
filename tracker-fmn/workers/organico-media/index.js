/**
 * Cloudflare Worker — organico-media
 *
 * Rotas:
 *   POST   /upload          — sobe arquivo original + thumb no R2, retorna URLs
 *   POST   /publish         — posta ou agenda carrossel/imagem no Instagram
 *   DELETE /original/:key   — deleta arquivo original do R2
 *   GET    /                — health check
 *
 * Secrets necessários (wrangler secret put):
 *   FB_ACCESS_TOKEN   — token permanente com instagram_content_publish
 *   IG_USER_ID        — Instagram User ID numérico
 *
 * R2 binding: BUCKET → site-fmn
 * URL pública: https://pub-3af414794ad1436281d1d1b3e9feea36.r2.dev
 */

const R2_PUBLIC = 'https://pub-3af414794ad1436281d1d1b3e9feea36.r2.dev';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Deriva a key do R2 a partir da URL pública, só para arquivos em organico/originais/
// (garante a exclusão automática mesmo quando a imagem não veio do fluxo normal de upload).
function origKeyFromUrl(url) {
  if (!url || !url.startsWith(`${R2_PUBLIC}/organico/originais/`)) return null;
  return url.replace(`${R2_PUBLIC}/`, '');
}

function collectOrigKeys(imageUrls, explicitKeys) {
  const keys = new Set(explicitKeys || []);
  (imageUrls || []).forEach(url => {
    const k = origKeyFromUrl(url);
    if (k) keys.add(k);
  });
  return [...keys];
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/* ── Reels: cria o container de vídeo e espera processar antes de publicar.
   Video processing no Instagram não é instantâneo (diferente de imagem). ── */
async function createReelsContainer(graph, igId, token, videoUrl, caption, comFacebook, thumbUrl) {
  const FB_PAGE_ID = '1738059673077819';
  const params = new URLSearchParams({
    media_type:   'REELS',
    video_url:    videoUrl,
    caption:      caption || '',
    share_to_feed: 'true',
    access_token: token,
  });
  if (thumbUrl) params.set('thumb_offset', '0');
  if (comFacebook) params.set('fb_page_id', FB_PAGE_ID);
  const r = await fetch(`${graph}/${igId}/media`, { method: 'POST', body: params });
  const d = await r.json();
  if (!d.id) throw new Error(`Erro ao criar container REELS: ${JSON.stringify(d)}`);
  return d.id;
}

async function waitReelsReady(graph, containerId, token, tries = 20, delayMs = 3000) {
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`${graph}/${containerId}?fields=status_code&access_token=${token}`);
    const d = await r.json();
    if (d.status_code === 'FINISHED') return true;
    if (d.status_code === 'ERROR' || d.status_code === 'EXPIRED') {
      throw new Error(`Processamento do Reels falhou: ${JSON.stringify(d)}`);
    }
    await new Promise(res => setTimeout(res, delayMs));
  }
  return false;
}

/* ── Upload ──────────────────────────────────────────────────────────────── */
async function handleUpload(request, env) {
  const form = await request.formData();
  const results = [];

  // Suporta múltiplos arquivos: file_0, file_1, ...
  let i = 0;
  while (true) {
    const file = form.get(`file_${i}`);
    if (!file) break;

    const id = `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`;
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';

    // 1. Salva original (para API do Instagram)
    const origKey  = `organico/originais/${id}.${ext}`;
    const origBytes = await file.arrayBuffer();
    await env.BUCKET.put(origKey, origBytes, {
      httpMetadata: { contentType: file.type || 'image/jpeg' },
    });

    // 2. Salva thumb WebP otimizado (fica permanente no card)
    //    A compressão real (WebP + resize) é feita no browser antes do upload.
    //    O Worker apenas armazena o thumb pré-processado enviado como `thumb_N`.
    const thumbFile = form.get(`thumb_${i}`);
    let thumbUrl = null;
    if (thumbFile) {
      const thumbKey   = `organico/thumbs/${id}.webp`;
      const thumbBytes = await thumbFile.arrayBuffer();
      await env.BUCKET.put(thumbKey, thumbBytes, {
        httpMetadata: { contentType: 'image/webp' },
      });
      thumbUrl = `${R2_PUBLIC}/${thumbKey}`;
    }

    results.push({
      id,
      origKey,
      origUrl:  `${R2_PUBLIC}/${origKey}`,
      thumbUrl,
    });

    i++;
  }

  if (!results.length) return json({ error: 'Nenhum arquivo recebido.' }, 400);
  return json({ ok: true, files: results });
}

/* ── Publish ─────────────────────────────────────────────────────────────── */
async function handlePublish(request, env) {
  let body;
  try { body = await request.json(); } catch (e) {
    return json({ error: 'JSON inválido: ' + e.message }, 400);
  }

  const {
    tipo,          // 'imagem' | 'carrossel' | 'reels'
    imageUrls,     // array de URLs públicas das originais (imagem/carrossel)
    videoUrl,      // URL pública do vídeo em alta (reels)
    thumbUrl,      // URL da thumb (reels)
    caption,       // legenda completa
    scheduleAt,    // ISO string ou null (null = postar agora)
    origKeys,      // keys do R2 para deletar depois
    comFacebook,   // bool — cross-post para a Page do Facebook
  } = body;

  const FB_PAGE_ID = '1738059673077819';

  if (tipo === 'reels') {
    if (!videoUrl) return json({ error: 'videoUrl ausente.' }, 400);
  } else if (!imageUrls?.length) {
    return json({ error: 'imageUrls ausente.' }, 400);
  }

  const token  = env.FB_ACCESS_TOKEN;
  const igId   = env.IG_USER_ID;

  if (!token) return json({ error: 'FB_ACCESS_TOKEN não configurado no worker.' }, 500);
  if (!igId)  return json({ error: 'IG_USER_ID não configurado no worker.' }, 500);
  const graph  = 'https://graph.facebook.com/v21.0';

  const scheduleTs = scheduleAt ? Math.floor(new Date(scheduleAt).getTime() / 1000) : null;

  if (tipo === 'reels') {
    /* ── Reels ── */
    const containerId = await createReelsContainer(graph, igId, token, videoUrl, caption, comFacebook, thumbUrl);
    const ready = await waitReelsReady(graph, containerId, token);
    if (!ready) return json({ error: 'Vídeo ainda processando no Instagram — tente publicar de novo em instantes.' }, 202);

    let postId = null;
    if (!scheduleTs) {
      const pubParams = new URLSearchParams({ creation_id: containerId, access_token: token });
      const pubRes  = await fetch(`${graph}/${igId}/media_publish`, { method: 'POST', body: pubParams });
      const pubData = await pubRes.json();
      if (!pubData.id) throw new Error(`Erro ao publicar Reels: ${JSON.stringify(pubData)}`);
      postId = pubData.id;
    }

    // Só apaga a versão em alta depois que o Instagram terminou de processar
    // (FINISHED) e, no caso imediato, depois de publicar de verdade.
    const key = origKeyFromUrl(videoUrl);
    const keysToDelete = collectOrigKeys([], [...(origKeys || []), ...(key ? [key] : [])]);
    if (keysToDelete.length) await Promise.all(keysToDelete.map(k => env.BUCKET.delete(k)));

    return json({ ok: true, scheduled: !!scheduleTs, postId, creationId: containerId });
  }

  let creationId;

  if (tipo === 'carrossel' && imageUrls.length > 1) {
    /* ── Carrossel ── */

    // 1. Cria container para cada imagem
    const childIds = [];
    for (const url of imageUrls) {
      const params = new URLSearchParams({
        image_url:         url,
        is_carousel_item:  'true',
        access_token:      token,
      });
      const r = await fetch(`${graph}/${igId}/media`, { method: 'POST', body: params });
      const d = await r.json();
      if (!d.id) throw new Error(`Erro ao criar item do carrossel: ${JSON.stringify(d)}`);
      childIds.push(d.id);
    }

    // 2. Cria container do carrossel
    const carParams = new URLSearchParams({
      media_type:   'CAROUSEL',
      children:     childIds.join(','),
      caption:      caption || '',
      access_token: token,
    });
    if (comFacebook) carParams.set('fb_page_id', FB_PAGE_ID);
    if (scheduleTs) {
      carParams.set('scheduled_publish_time', String(scheduleTs));
      carParams.set('published', 'false');
    }
    const carRes = await fetch(`${graph}/${igId}/media`, { method: 'POST', body: carParams });
    const carData = await carRes.json();
    if (!carData.id) throw new Error(`Erro ao criar carrossel: ${JSON.stringify(carData)}`);
    creationId = carData.id;

  } else {
    /* ── Imagem única ── */
    const params = new URLSearchParams({
      image_url:    imageUrls[0],
      caption:      caption || '',
      access_token: token,
    });
    if (comFacebook) params.set('fb_page_id', FB_PAGE_ID);
    if (scheduleTs) {
      params.set('scheduled_publish_time', String(scheduleTs));
      params.set('published', 'false');
    }
    const r = await fetch(`${graph}/${igId}/media`, { method: 'POST', body: params });
    const d = await r.json();
    if (!d.id) throw new Error(`Erro ao criar mídia: ${JSON.stringify(d)}`);
    creationId = d.id;
  }

  let postId = null;
  if (!scheduleTs) {
    // Publica imediatamente
    const pubParams = new URLSearchParams({ creation_id: creationId, access_token: token });
    const pubRes  = await fetch(`${graph}/${igId}/media_publish`, { method: 'POST', body: pubParams });
    const pubData = await pubRes.json();
    if (!pubData.id) throw new Error(`Erro ao publicar: ${JSON.stringify(pubData)}`);
    postId = pubData.id;
  }

  // Deleta originais do R2 (após publicar ou agendar com sucesso)
  const keysToDelete = collectOrigKeys(imageUrls, origKeys);
  if (keysToDelete.length) {
    await Promise.all(keysToDelete.map(key => env.BUCKET.delete(key)));
  }

  return json({
    ok:         true,
    scheduled:  !!scheduleTs,
    postId,
    creationId,
  });
}

/* ── Schedule: salva agendamento no Supabase (sem chamar a API do Instagram) */
async function handleSchedule(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'JSON inválido.' }, 400); }

  const { itemId, scheduleAt, imageUrls, videoUrl, thumbUrl, origKeys, caption, tipo, comFacebook } = body;
  if (!itemId || !scheduleAt) {
    return json({ error: 'itemId e scheduleAt são obrigatórios.' }, 400);
  }
  if (tipo === 'reels' ? !videoUrl : !imageUrls?.length) {
    return json({ error: tipo === 'reels' ? 'videoUrl ausente.' : 'imageUrls ausente.' }, 400);
  }

  const sbUrl = env.SUPABASE_URL;
  const sbKey = env.SUPABASE_SERVICE_KEY;
  if (!sbUrl || !sbKey) return json({ error: 'Supabase não configurado no worker.' }, 500);

  const res = await fetch(`${sbUrl}/rest/v1/conteudo_organico?id=eq.${itemId}`, {
    method: 'PATCH',
    headers: {
      'apikey': sbKey,
      'Authorization': `Bearer ${sbKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({
      status: 'Agendado',
      scheduled_at: scheduleAt,
      data_prevista: scheduleAt.slice(0, 10), // YYYY-MM-DD para o calendário
      scheduled_media: { imageUrls, videoUrl, thumbUrl, origKeys: origKeys || [], caption, tipo, comFacebook: !!comFacebook },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'Erro ao salvar no Supabase: ' + err }, 500);
  }

  return json({ ok: true, scheduled: true });
}

/* ── Cron: publica posts agendados cujo horário chegou ──────────────────── */
async function runScheduledPublish(env) {
  // Janela permitida: 06:00–23:00 horário de Brasília (UTC-3)
  const hourBrasilia = (new Date().getUTCHours() - 3 + 24) % 24;
  if (hourBrasilia < 6 || hourBrasilia >= 23) {
    console.log(`[cron] Fora da janela (${hourBrasilia}h Brasília). Nenhuma publicação.`);
    return;
  }

  const sbUrl = env.SUPABASE_URL;
  const sbKey = env.SUPABASE_SERVICE_KEY;
  const token = env.FB_ACCESS_TOKEN;
  const igId  = env.IG_USER_ID;

  if (!sbUrl || !sbKey || !token || !igId) {
    console.error('[cron] Variáveis de ambiente ausentes.');
    return;
  }

  // Busca posts agendados que já passaram do horário
  const res = await fetch(
    `${sbUrl}/rest/v1/conteudo_organico?status=eq.Agendado&scheduled_at=lte.${new Date().toISOString()}&select=id,scheduled_at,scheduled_media`,
    { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` } }
  );
  const posts = await res.json();
  if (!Array.isArray(posts) || !posts.length) {
    console.log('[cron] Nenhum post agendado para publicar agora.');
    return;
  }

  const graph = 'https://graph.facebook.com/v21.0';
  const FB_PAGE_ID = '1738059673077819';

  for (const post of posts) {
    const m = post.scheduled_media || {};
    const { imageUrls = [], videoUrl = null, thumbUrl = null, origKeys = [], caption = '', tipo = 'imagem', comFacebook = false } = m;

    try {
      let creationId;

      if (tipo === 'reels') {
        creationId = await createReelsContainer(graph, igId, token, videoUrl, caption, comFacebook, thumbUrl);
        const ready = await waitReelsReady(graph, creationId, token);
        if (!ready) throw new Error('Vídeo não terminou de processar a tempo — tenta de novo no próximo ciclo.');

        const pubP = new URLSearchParams({ creation_id: creationId, access_token: token });
        const pubR = await fetch(`${graph}/${igId}/media_publish`, { method: 'POST', body: pubP });
        const pubD = await pubR.json();
        if (!pubD.id) throw new Error(`Erro ao publicar Reels: ${JSON.stringify(pubD)}`);

        const key = origKeyFromUrl(videoUrl);
        const keysToDelete = collectOrigKeys([], [...origKeys, ...(key ? [key] : [])]);
        if (keysToDelete.length) await Promise.all(keysToDelete.map(k => env.BUCKET.delete(k)));

        await fetch(`${sbUrl}/rest/v1/conteudo_organico?id=eq.${post.id}`, {
          method: 'PATCH',
          headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            status: 'Feito', published_at: post.scheduled_at || new Date().toISOString(),
            scheduled_at: null, scheduled_media: null, meta_media_id: pubD.id,
          }),
        });
        console.log(`[cron] Reels publicado: ${post.id} → ${pubD.id}`);
        continue;
      }

      if (tipo === 'carrossel' && imageUrls.length > 1) {
        const childIds = [];
        for (const url of imageUrls) {
          const p = new URLSearchParams({ image_url: url, is_carousel_item: 'true', access_token: token });
          const r = await fetch(`${graph}/${igId}/media`, { method: 'POST', body: p });
          const d = await r.json();
          if (!d.id) throw new Error(`Erro item carrossel: ${JSON.stringify(d)}`);
          childIds.push(d.id);
        }
        const p = new URLSearchParams({ media_type: 'CAROUSEL', children: childIds.join(','), caption, access_token: token });
        if (comFacebook) p.set('fb_page_id', FB_PAGE_ID);
        const r = await fetch(`${graph}/${igId}/media`, { method: 'POST', body: p });
        const d = await r.json();
        if (!d.id) throw new Error(`Erro carrossel: ${JSON.stringify(d)}`);
        creationId = d.id;
      } else {
        const p = new URLSearchParams({ image_url: imageUrls[0], caption, access_token: token });
        if (comFacebook) p.set('fb_page_id', FB_PAGE_ID);
        const r = await fetch(`${graph}/${igId}/media`, { method: 'POST', body: p });
        const d = await r.json();
        if (!d.id) throw new Error(`Erro mídia: ${JSON.stringify(d)}`);
        creationId = d.id;
      }

      // Publica
      const pubP = new URLSearchParams({ creation_id: creationId, access_token: token });
      const pubR = await fetch(`${graph}/${igId}/media_publish`, { method: 'POST', body: pubP });
      const pubD = await pubR.json();
      if (!pubD.id) throw new Error(`Erro ao publicar: ${JSON.stringify(pubD)}`);

      // Deleta originais do R2 (deriva a key da URL também, cobre imagens inseridas fora do fluxo normal)
      const keysToDelete = collectOrigKeys(imageUrls, origKeys);
      if (keysToDelete.length) {
        await Promise.all(keysToDelete.map(k => env.BUCKET.delete(k)));
      }

      // Atualiza status no Supabase
      await fetch(`${sbUrl}/rest/v1/conteudo_organico?id=eq.${post.id}`, {
        method: 'PATCH',
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          status: 'Feito',
          published_at: post.scheduled_at || new Date().toISOString(),
          scheduled_at: null,
          scheduled_media: null,
          // Guarda o id do post no Meta pra casar com as métricas orgânicas depois.
          meta_media_id: pubD.id,
        }),
      });

      console.log(`[cron] Publicado: ${post.id} → ${pubD.id}`);

    } catch (err) {
      console.error(`[cron] Erro ao publicar ${post.id}:`, err.message);
      // Volta para Postagem para o usuário tentar manualmente
      await fetch(`${sbUrl}/rest/v1/conteudo_organico?id=eq.${post.id}`, {
        method: 'PATCH',
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'Postagem', scheduled_at: null, scheduled_media: null }),
      });
    }
  }
}

/* ── Auth: troca código OAuth por token de longa duração ────────────────── */
async function handleAuthExchange(request, env) {
  const url  = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return json({ ok: false, error: 'code ausente.' }, 400);

  const APP_ID     = '851080791403307';
  const APP_SECRET = env.FB_APP_SECRET;
  const REDIRECT   = 'https://tracker.fotografiaeomeunegocio.com.br/auth/callback';
  const GRAPH      = 'https://graph.facebook.com/v21.0';

  if (!APP_SECRET) return json({ ok: false, error: 'FB_APP_SECRET não configurado.' }, 500);

  // 1. Troca código por token de curta duração
  const shortRes = await fetch(
    `${GRAPH}/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT)}&client_secret=${APP_SECRET}&code=${encodeURIComponent(code)}`
  );
  const shortData = await shortRes.json();
  if (!shortData.access_token) return json({ ok: false, error: 'Erro token curto: ' + JSON.stringify(shortData) }, 400);

  // 2. Troca por token de longa duração (60 dias)
  const longRes = await fetch(
    `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${encodeURIComponent(shortData.access_token)}`
  );
  const longData = await longRes.json();
  if (!longData.access_token) return json({ ok: false, error: 'Erro token longo: ' + JSON.stringify(longData) }, 400);

  return json({ ok: true, token: longData.access_token, expires_in: longData.expires_in });
}

/* ── Delete original ─────────────────────────────────────────────────────── */
async function handleDeleteOriginal(key, env) {
  await env.BUCKET.delete(key);
  return json({ ok: true });
}

/* ── Put ──────────────────────────────────────────────────────────────────
   Usado pela "cozinha" (Cloud Run) para gravar imagens já otimizadas no R2,
   sob prefixo persistente (organico/media/...), sem token S3. Protegido por
   IMPORT_TOKEN. Body = bytes crus.                                           */
async function handlePut(request, env, url) {
  if (request.headers.get('X-Token') !== env.IMPORT_TOKEN) {
    return json({ error: 'não autorizado' }, 401);
  }
  const key = url.searchParams.get('key');
  const ct  = url.searchParams.get('ct') || 'application/octet-stream';
  if (!key) return json({ error: 'key ausente' }, 400);
  const body = await request.arrayBuffer();
  await env.BUCKET.put(key, body, { httpMetadata: { contentType: ct } });
  return json({ ok: true, url: `${R2_PUBLIC}/${key}` });
}

/* ── Card slides ───────────────────────────────────────────────────────────
   A cozinha chama aqui pra atualizar os slides (e plataforma) de um card do
   Tracker (tabela conteudo_organico), usando a chave do Supabase do worker.  */
async function handleCardSlides(request, env) {
  if (request.headers.get('X-Token') !== env.IMPORT_TOKEN) {
    return json({ error: 'não autorizado' }, 401);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { card_id, slides, media_files, plataforma } = body;
  if (!card_id || slides === undefined) return json({ error: 'card_id e slides são obrigatórios' }, 400);

  const patch = { slides: typeof slides === 'string' ? slides : JSON.stringify(slides) };
  if (media_files !== undefined) patch.media_files = typeof media_files === 'string' ? media_files : JSON.stringify(media_files);
  if (plataforma) patch.plataforma = plataforma;

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/conteudo_organico?id=eq.${card_id}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return json({ error: 'Supabase ' + res.status + ': ' + (await res.text()).slice(0, 200) }, 500);

  // Card que estava em "Fazer" e recebeu mídia avança sozinho pra "Produção".
  // Filtro condicional: só afeta a linha se ainda estiver em 'Fazer' (idempotente).
  await fetch(`${env.SUPABASE_URL}/rest/v1/conteudo_organico?id=eq.${card_id}&status=eq.Fazer`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ status: 'Produção' }),
  }).catch(() => {});

  return json({ ok: true });
}

/* ── Import via cozinha (relay p/ o app) ─────────────────────────────────────
   Orgânico do Tracker: "ORG N" é por POSIÇÃO (a Nª carta criada, ordem por
   created_at) — mesma lógica do script local. O worker resolve a posição e
   manda pra cozinha, que acha a pasta "ORG N".                               */
const COZINHA_URL = 'https://cozinha-296334646934.us-central1.run.app';
const TRACKER_ORGANICO_ROOT = '1h3cPqEoOnXld-6Sqh3IjsYcsb2bh_PLp';

function parseFolderId(s) { const m = String(s || '').match(/[-\w]{25,}/); return m ? m[0] : null; }

async function cozinha(env, payload) {
  let r;
  try {
    r = await fetch(`${COZINHA_URL}/importar`, {
      method: 'POST', headers: { 'X-Token': env.IMPORT_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant: 'tracker', ...payload }),
    });
  } catch {
    // subrequest estourou a janela (~100s): a cozinha continua e grava o card
    return { ok: true, processando: true };
  }
  if (r.status === 524 || r.status === 522 || r.status === 504) return { ok: true, processando: true };
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

async function ordemCards(env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/conteudo_organico?select=id&order=created_at.asc`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  return (await res.json().catch(() => [])).map(r => r.id);
}

async function handleImportLink(request, env) {
  let body; try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { card_id, drive_url, plataforma, job_id } = body;
  if (!card_id || !drive_url) return json({ error: 'card_id e drive_url são obrigatórios' }, 400);
  const folderId = parseFolderId(drive_url);
  if (!folderId) return json({ error: 'link de pasta inválido' }, 400);
  try { const d = await cozinha(env, { drive_folder_id: folderId, card_id, plataforma, job_id }); return json({ ok: true, processando: d.processando, imagens: d.imagens, videos: d.videos }); }
  catch (e) { return json({ error: e.message }, 500); }
}

async function handleImportDireto(request, env) {
  let body; try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { card_id, plataforma, job_id } = body;
  if (!card_id) return json({ error: 'card_id é obrigatório' }, 400);
  const ids = await ordemCards(env);
  const idx = ids.indexOf(card_id);
  if (idx < 0) return json({ error: 'card não encontrado' }, 404);
  try { const d = await cozinha(env, { root_folder_id: TRACKER_ORGANICO_ROOT, numero: idx + 1, card_id, plataforma, job_id }); return json({ ok: true, processando: d.processando, imagens: d.imagens, videos: d.videos }); }
  catch (e) { return json({ error: e.message }, 500); }
}

async function handleImportGeral(request, env) {
  let body; try { body = await request.json(); } catch { body = {}; }
  const job_id = body.job_id;
  const ids = await ordemCards(env);
  let ok = 0, fail = 0; const erros = [];
  for (let i = 0; i < ids.length; i++) {
    try { await cozinha(env, { root_folder_id: TRACKER_ORGANICO_ROOT, numero: i + 1, card_id: ids[i], job_id }); ok++; }
    catch (e) { if (/não encontrada/.test(e.message)) continue; fail++; erros.push({ card: ids[i], erro: e.message }); }
  }
  return json({ ok: true, total: ids.length, importados: ok, falhas: fail, erros });
}

/* ── Router ──────────────────────────────────────────────────────────────── */
export default {
  async scheduled(event, env) {
    await runScheduledPublish(env);
  },

  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method.toUpperCase();

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    try {
      if (method === 'GET'  && url.pathname === '/progresso') return await handleProgresso(request, env, url);
      if (method === 'GET'  && url.pathname === '/auth/exchange') return await handleAuthExchange(request, env);
      if (method === 'POST' && url.pathname === '/schedule') return await handleSchedule(request, env);
      if (method === 'POST' && url.pathname === '/upload')  return await handleUpload(request, env);
      if (method === 'POST' && url.pathname === '/publish') return await handlePublish(request, env);
      if (method === 'POST' && url.pathname === '/put')     return await handlePut(request, env, url);
      if (method === 'POST' && url.pathname === '/card-slides') return await handleCardSlides(request, env);
      if (method === 'POST' && url.pathname === '/import-link')   return await handleImportLink(request, env);
      if (method === 'POST' && url.pathname === '/import-direto') return await handleImportDireto(request, env);
      if (method === 'POST' && url.pathname === '/import-geral')  return await handleImportGeral(request, env);
      if (method === 'DELETE' && url.pathname.startsWith('/original/')) {
        const key = decodeURIComponent(url.pathname.replace('/original/', ''));
        return await handleDeleteOriginal(key, env);
      }
      // Serve arquivos do R2: GET /media/organico/org-001/slide-01.png
      if (method === 'GET' && url.pathname.startsWith('/media/')) {
        const key = decodeURIComponent(url.pathname.replace('/media/', ''));
        const obj = await env.BUCKET.get(key);
        if (!obj) return new Response('Not found', { status: 404, headers: CORS });
        const ct = obj.httpMetadata?.contentType || 'application/octet-stream';
        return new Response(obj.body, {
          status: 200,
          headers: {
            'Content-Type': ct,
            'Cache-Control': 'public, max-age=31536000, immutable',
            ...CORS,
          },
        });
      }
      if (method === 'GET')  return json({ ok: true, service: 'organico-media' });
      return json({ error: 'Rota não encontrada.' }, 404);

    } catch (err) {
      console.error('[organico-media]', err.message, err.stack);
      return json({ ok: false, error: err.message }, 500);
    }
  },
};
