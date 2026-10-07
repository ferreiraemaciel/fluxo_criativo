-- Um mesmo vídeo pode estar em mais de um card (Reels e o Shorts do YouTube feito a partir dele).
-- Antes de apagar o original do R2, o worker organico-media pergunta se algum card ainda não
-- publicado usa o arquivo (07/10/2026: os Shorts 270 a 279 ficaram sem vídeo por isso).
create or replace function public.org_midia_em_uso(base text, exceto uuid default null)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from conteudo_organico
    where status <> 'Arquivado' and (exceto is null or id <> exceto)
      and strpos(coalesce(slides::text,'') || coalesce(scheduled_media::text,'') || coalesce(media_files::text,''), base) > 0
  );
$$;
revoke all on function public.org_midia_em_uso(text, uuid) from public, anon, authenticated;
grant execute on function public.org_midia_em_uso(text, uuid) to service_role;
