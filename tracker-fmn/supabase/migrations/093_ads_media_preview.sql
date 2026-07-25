-- Migration 093: coluna pra prévia leve do vídeo do anúncio.
-- A cozinha (khronus/cozinha) já gera 3 arquivos por Reels importado
-- (preview 540p leve, thumb estática, alta 1080p pro Meta), mas o worker
-- ads-media só guardava a URL da versão "alta" -- o preview subia pro R2
-- e ficava orfao, nunca referenciado por nenhum card.
-- Agora o card usa media_preview_url pro player (leve, carrega rapido) e
-- media_url (a "alta") pode ser deletada do R2 assim que o video_id for
-- confirmado no Meta -- depois disso o R2 não faz mais falta pra republicar,
-- o Meta já guarda o video internamente via meta_video_id.

alter table ads add column if not exists media_preview_url text;
