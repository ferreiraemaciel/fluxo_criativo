-- Card de plataforma Youtube guarda o ID do vídeo publicado (14/09/2026).
-- Gravado pelo worker organico-media na rota /youtube-publicar.
alter table public.conteudo_organico add column if not exists youtube_video_id text;
comment on column public.conteudo_organico.youtube_video_id is 'ID do vídeo no YouTube, gravado pelo worker organico-media ao publicar um card de plataforma Youtube.';
