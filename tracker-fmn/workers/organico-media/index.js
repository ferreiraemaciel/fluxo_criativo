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

/* Parse tolerante: a coluna `slides` guarda JSON stringificado, mas pode vir
   null, string vazia ou já como array. Nunca lança. */
function safeParse(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return null; }
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

/* ── Publicar um container já criado ──────────────────────────────────────
   Publicar logo depois de criar o container falha de vez em quando com
   "Media ID is not available" (código 9007): o Instagram ainda está baixando
   o arquivo do R2. Acontecia com IMAGEM e CARROSSEL, que publicavam na hora,
   sem esperar nada — foi o que derrubou o ORG 029 no agendamento das 18:00 de
   2026-08-10. Agora todo tipo passa por aqui: espera o container ficar pronto
   e, se mesmo assim vier o erro transitório, tenta de novo em vez de desistir.

   Só erro transitório é repetido. Legenda grande demais, conta sem permissão
   ou imagem fora de proporção falham na primeira e param aqui mesmo: insistir
   não muda o resultado e só atrasaria o aviso.                              */
async function publicarContainer(graph, igId, token, creationId, rotulo = 'a publicação') {
  await waitReelsReady(graph, creationId, token, 20, 3000);

  let ultimo = null;
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    const params = new URLSearchParams({ creation_id: creationId, access_token: token });
    const res  = await fetch(`${graph}/${igId}/media_publish`, { method: 'POST', body: params });
    const data = await res.json();
    if (data.id) return data.id;

    ultimo = data;
    const err = data.error || {};
    const transitorio = err.code === 9007 || err.is_transient === true;
    if (!transitorio) break;
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`Erro ao publicar ${rotulo}: ${JSON.stringify(ultimo)}`);
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

/* ── Listagem do bucket, só leitura ───────────────────────────────────────
   O wrangler não tem `r2 object list`, então sem isto não há como auditar o
   que está guardado. Serve pra cruzar o conteúdo do bucket com o que os cards
   referenciam de fato e achar arquivo órfão (imagem trocada que ficou pra
   trás). Protegida por token: expõe nomes de arquivo do bucket inteiro.      */
async function handleListar(request, env, url) {
  if (request.headers.get('X-Token') !== env.IMPORT_TOKEN) {
    return json({ error: 'não autorizado' }, 401);
  }
  const prefix = url.searchParams.get('prefix') || 'organico/';
  const objetos = [];
  let cursor;
  do {
    const lote = await env.BUCKET.list({ prefix, cursor, limit: 1000 });
    for (const o of lote.objects) {
      objetos.push({ key: o.key, size: o.size, uploaded: o.uploaded });
    }
    cursor = lote.truncated ? lote.cursor : undefined;
  } while (cursor);
  return json({ ok: true, prefix, total: objetos.length, objetos });
}

/* ── Troca de imagem do slide, direto do modal ────────────────────────────
   Antes, o botão "Trocar imagem" só guardava o arquivo na memória do browser
   e o upload acontecia lá na publicação. Isso dava dois problemas: trocar a
   imagem e só salvar o card perdia a troca (o slide continuava apontando pra
   URL antiga), e a imagem substituída ficava órfã pra sempre no R2, porque
   cada upload gera uma key nova e nada apagava a anterior.

   Esta rota resolve os dois: grava na hora e apaga a antiga.

   Escreve em `organico/media/`, o mesmo prefixo que o import do Drive usa, e
   não em `organico/originais/`. É de propósito: `originais/` é apagado
   automaticamente depois de publicar (ver collectOrigKeys), e o card ficaria
   sem imagem. `media/` é permanente.                                        */
async function handleSlideImage(request, env) {
  const form = await request.formData();
  const file = form.get('file');
  const oldUrl = form.get('old_url') || '';
  if (!file) return json({ error: 'arquivo ausente' }, 400);

  const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
  const key = `organico/media/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });
  const url = `${R2_PUBLIC}/${key}`;

  // Só apaga o que é nosso e o que é imagem de card. Nunca aceita key
  // arbitrária vinda do cliente: se a URL antiga não casar com um dos
  // prefixos conhecidos, ignora em silêncio em vez de arriscar apagar
  // outra coisa. Também não apaga a que acabou de subir.
  let apagada = null;
  const prefixos = ['organico/media/', 'organico/originais/', 'organico/thumbs/'];
  if (oldUrl.startsWith(`${R2_PUBLIC}/`)) {
    const oldKey = oldUrl.replace(`${R2_PUBLIC}/`, '').split('?')[0];
    if (oldKey !== key && prefixos.some(p => oldKey.startsWith(p))) {
      await env.BUCKET.delete(oldKey).then(() => { apagada = oldKey; }).catch(() => {});
    }
  }

  return json({ ok: true, url, apagada });
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
      postId = await publicarContainer(graph, igId, token, containerId, 'o Reels');
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
    postId = await publicarContainer(graph, igId, token, creationId);
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
      erro_publicacao: null,
      erro_publicacao_em: null,
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

/* ── Agendados que o robô não consegue publicar ──────────────────────────
   Card em "Agendado" sem `scheduled_at` (ou sem `scheduled_media`) nunca
   aparece na busca do cron: ele fica parado na coluna pra sempre, e no quadro
   parece que está tudo certo. Foi assim que o ORG 039 passou do domingo sem
   ninguém perceber. Aqui o card é marcado com erro, e o aviso vermelho no
   quadro faz o problema aparecer no mesmo dia.                             */
async function sinalizarAgendadosOrfaos(env, sbUrl, sbKey) {
  try {
    const res = await fetch(
      `${sbUrl}/rest/v1/conteudo_organico?status=eq.Agendado&or=(scheduled_at.is.null,scheduled_media.is.null)&erro_publicacao=is.null&select=id,numero`,
      { headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}` } }
    );
    const orfaos = await res.json();
    if (!Array.isArray(orfaos) || !orfaos.length) return;

    for (const card of orfaos) {
      console.log(`[cron] ORG ${card.numero} está em Agendado sem horário/mídia — marcando erro.`);
      await fetch(`${sbUrl}/rest/v1/conteudo_organico?id=eq.${card.id}`, {
        method: 'PATCH',
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`,
                   'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          erro_publicacao: 'Card em Agendado sem data e hora marcadas. Abra o card e use Publicar > Agendar.',
          erro_publicacao_em: new Date().toISOString(),
        }),
      });
    }
  } catch (e) {
    console.log('[cron] Falha ao checar agendados órfãos:', e && e.message);
  }
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

  await sinalizarAgendadosOrfaos(env, sbUrl, sbKey);

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

        await publicarContainer(graph, igId, token, creationId, 'o Reels');

        const key = origKeyFromUrl(videoUrl);
        const keysToDelete = collectOrigKeys([], [...origKeys, ...(key ? [key] : [])]);
        if (keysToDelete.length) await Promise.all(keysToDelete.map(k => env.BUCKET.delete(k)));

        await fetch(`${sbUrl}/rest/v1/conteudo_organico?id=eq.${post.id}`, {
          method: 'PATCH',
          headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({
            status: 'Arquivado', published_at: post.scheduled_at || new Date().toISOString(),
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
      await publicarContainer(graph, igId, token, creationId);

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
          status: 'Arquivado',
          published_at: post.scheduled_at || new Date().toISOString(),
          scheduled_at: null,
          scheduled_media: null,
          // Publicou: some com o erro da tentativa anterior, se houver.
          erro_publicacao: null,
          erro_publicacao_em: null,
          // Guarda o id do post no Meta pra casar com as métricas orgânicas depois.
          meta_media_id: pubD.id,
        }),
      });

      console.log(`[cron] Publicado: ${post.id} → ${pubD.id}`);

    } catch (err) {
      console.error(`[cron] Erro ao publicar ${post.id}:`, err.message);
      // Volta para Feito e GRAVA O MOTIVO no card. Antes o erro só ia pro log
      // do servidor (que nem era guardado) e o card voltava limpo, virando
      // indistinguível de um card que nunca foi agendado — foi o que aconteceu
      // com o ORG 039 em 2026-08-09 e impediu descobrir a causa depois.
      await fetch(`${sbUrl}/rest/v1/conteudo_organico?id=eq.${post.id}`, {
        method: 'PATCH',
        headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          status: 'Feito', scheduled_at: null, scheduled_media: null,
          erro_publicacao: String(err && err.message || err).slice(0, 500),
          erro_publicacao_em: new Date().toISOString(),
        }),
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
// Aceita só chave sob os prefixos deste módulo. Antes apagava qualquer chave
// que chegasse, sem token e sem validação: bastava conhecer a URL do worker
// pra remover qualquer objeto do bucket, inclusive imagem de anúncio ou do
// site. A rota é chamada pelo frontend sem token (a limpeza acontece no
// browser, ao apagar card), então a trava tem que ser por prefixo.
// `organico/` inteiro, e não só media/originais/thumbs: existem esquemas de
// nomeação antigos (organico/org-001/slide-01.png) e a pasta de referências,
// que também precisam poder ser limpos. O que não pode é sair de `organico/`
// e alcançar `ads/` ou as imagens do site.
async function handleDeleteOriginal(key, env) {
  if (!key || key.includes('..') || !key.startsWith('organico/')) {
    return json({ error: 'chave fora do escopo do organico-media' }, 400);
  }
  await env.BUCKET.delete(key);
  return json({ ok: true, key });
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

  // Importar mídia NUNCA pode apagar o texto do slide (roteiro, estética visual,
  // prompt). Regra em CAMPOS-COPY-CRIATIVOS.md, quebrada até 2026-08-07 porque
  // aqui a coluna `slides` era sobrescrita inteira: a importação manda só as
  // URLs das imagens, então todo o texto ia junto. Aconteceu de verdade no
  // ORG 042, que perdeu roteiro e direção visual dos 8 slides.
  //
  // Agora mescla por índice: parte do que já está gravado e sobrepõe só as
  // chaves que vierem preenchidas. Assim mídia nova entra, texto antigo fica, e
  // um caller que mande slide completo continua funcionando como antes.
  const slidesRecebidos = typeof slides === 'string' ? safeParse(slides) : slides;
  let slidesFinais = slidesRecebidos;

  if (Array.isArray(slidesRecebidos)) {
    const atuais = await fetch(
      `${env.SUPABASE_URL}/rest/v1/conteudo_organico?id=eq.${card_id}&select=slides`,
      { headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } },
    ).then(r => (r.ok ? r.json() : [])).catch(() => []);

    const antigos = safeParse(atuais?.[0]?.slides) || [];
    if (Array.isArray(antigos) && antigos.length) {
      const total = Math.max(antigos.length, slidesRecebidos.length);
      slidesFinais = Array.from({ length: total }, (_, i) => {
        const base = (antigos[i] && typeof antigos[i] === 'object') ? { ...antigos[i] } : {};
        const novo = (slidesRecebidos[i] && typeof slidesRecebidos[i] === 'object') ? slidesRecebidos[i] : {};
        for (const [k, v] of Object.entries(novo)) {
          if (v !== undefined && v !== null && v !== '') base[k] = v;
        }
        return base;
      });
    }
  }

  const patch = { slides: JSON.stringify(slidesFinais) };
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
  // Filtro condicional: só afeta a linha se ainda estiver em 'Fazendo' (idempotente).
  await fetch(`${env.SUPABASE_URL}/rest/v1/conteudo_organico?id=eq.${card_id}&status=eq.Fazendo`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ status: 'Feito', etapa: null }),
  }).catch(() => {});

  // Não existe mais avanço automático depois de "Feito": a coluna "Postagem"
  // foi removida em 2026-08-07 por ser indistinguível de "Feito" na prática.
  // De Feito o card só sai por decisão do usuário (agendar ou publicar).

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

// O número do card é FIXO e vive na coluna `numero` — nunca mais calculado por
// posição. Calcular por posição parecia funcionar, mas apagar qualquer card
// renumerava todos os seguintes, enquanto os nomes das pastas no Drive ficavam
// congelados. Em 2026-08-07 a lista inteira estava 4 números adiantada: o card
// que a tela chamava de ORG 033 procurava a pasta "ORG 033" e a pasta dele era
// a "ORG 037". Resultado: importava a mídia do card errado, ou nenhuma.
async function cardsComNumero(env) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/conteudo_organico?select=id,numero`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  return await res.json().catch(() => []);
}

async function numeroDoCard(env, cardId) {
  const linhas = await cardsComNumero(env);
  const alvo = linhas.find(r => r.id === cardId);
  return alvo && alvo.numero != null ? alvo.numero : null;
}

/* Cria a pasta do card na raiz do Orgânico no Drive (ex: "ORG 021 Nome").
   Chamado quando um card novo é criado, pra o usuário não ter que criar a
   pasta na mão nem acertar o nome que a importação espera.
   body: { card_id }  — o número vem da posição do card, mesma regra do resto. */
async function handleCriarPasta(request, env) {
  let body; try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { card_id } = body;
  if (!card_id) return json({ error: 'card_id é obrigatório' }, 400);

  // Número e nome vêm do banco, não do cliente: o número é posicional e o
  // nome precisa ser o que está gravado de verdade no card.
  const numero = await numeroDoCard(env, card_id);
  if (numero == null) return json({ error: 'card não encontrado ou sem número' }, 404);

  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/conteudo_organico?id=eq.${card_id}&select=tema`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` } });
  const row = (await res.json().catch(() => []))[0] || {};

  const r = await fetch(`${COZINHA_URL}/criar-pasta`, {
    method: 'POST', headers: { 'X-Token': env.IMPORT_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ root_folder_id: TRACKER_ORGANICO_ROOT, numero, nome: row.tema || '', prefixo: 'ORG' }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) return json({ error: d.error || `cozinha ${r.status}` }, 500);

  // Já deixa o link da pasta gravado no card: a importação com link passa a
  // funcionar sem o usuário ir buscar a URL no Drive.
  if (d.url) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/conteudo_organico?id=eq.${card_id}`, {
      method: 'PATCH',
      headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ drive_folder_url: d.url }),
    }).catch(() => {});
  }
  return json({ ok: true, ...d, numero });
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
  const numero = await numeroDoCard(env, card_id);
  if (numero == null) return json({ error: 'card não encontrado ou sem número' }, 404);
  try { const d = await cozinha(env, { root_folder_id: TRACKER_ORGANICO_ROOT, numero, card_id, plataforma, job_id }); return json({ ok: true, processando: d.processando, imagens: d.imagens, videos: d.videos }); }
  catch (e) { return json({ error: e.message }, 500); }
}

async function handleImportGeral(request, env) {
  let body; try { body = await request.json(); } catch { body = {}; }
  const job_id = body.job_id;
  const linhas = (await cardsComNumero(env)).filter(r => r.numero != null);
  let ok = 0, fail = 0; const erros = [];
  for (const r of linhas) {
    try { await cozinha(env, { root_folder_id: TRACKER_ORGANICO_ROOT, numero: r.numero, card_id: r.id, job_id }); ok++; }
    catch (e) { if (/não encontrada/.test(e.message)) continue; fail++; erros.push({ card: r.id, erro: e.message }); }
  }
  return json({ ok: true, total: linhas.length, importados: ok, falhas: fail, erros });
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
      if (method === 'GET'  && url.pathname === '/listar')      return await handleListar(request, env, url);
      if (method === 'POST' && url.pathname === '/slide-image') return await handleSlideImage(request, env);
      if (method === 'POST' && url.pathname === '/card-slides') return await handleCardSlides(request, env);
      if (method === 'POST' && url.pathname === '/criar-pasta')  return await handleCriarPasta(request, env);
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
