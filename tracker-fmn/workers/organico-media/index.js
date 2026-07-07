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
      if (method === 'GET'  && url.pathname === '/auth/exchange') return await handleAuthExchange(request, env);
      if (method === 'POST' && url.pathname === '/schedule') return await handleSchedule(request, env);
      if (method === 'POST' && url.pathname === '/upload')  return await handleUpload(request, env);
      if (method === 'POST' && url.pathname === '/publish') return await handlePublish(request, env);
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
