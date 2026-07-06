-- capa_url na tabela agregada
ALTER TABLE site_post_views
  ADD COLUMN IF NOT EXISTS capa_url text;

-- session + read time nos eventos
ALTER TABLE site_post_view_events
  ADD COLUMN IF NOT EXISTS session_id  text,
  ADD COLUMN IF NOT EXISTS read_time_s integer;

CREATE INDEX IF NOT EXISTS idx_spve_session ON site_post_view_events(session_id);

-- Remove versão antiga da RPC (7 params, void)
DROP FUNCTION IF EXISTS increment_post_view(text,text,text,text,text,text,text);

-- Nova RPC: 9 params, retorna o event id
CREATE OR REPLACE FUNCTION increment_post_view(
  p_slug       text,
  p_titulo     text    DEFAULT NULL,
  p_referrer   text    DEFAULT NULL,
  p_utm_source text    DEFAULT NULL,
  p_utm_medium text    DEFAULT NULL,
  p_utm_camp   text    DEFAULT NULL,
  p_device     text    DEFAULT NULL,
  p_capa_url   text    DEFAULT NULL,
  p_session_id text    DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO site_post_views (slug, titulo, views, last_view_at, capa_url)
  VALUES (p_slug, p_titulo, 1, now(), p_capa_url)
  ON CONFLICT (slug) DO UPDATE
    SET views        = site_post_views.views + 1,
        last_view_at = now(),
        titulo       = COALESCE(EXCLUDED.titulo,    site_post_views.titulo),
        capa_url     = COALESCE(EXCLUDED.capa_url,  site_post_views.capa_url);

  INSERT INTO site_post_view_events
    (slug, titulo, referrer, utm_source, utm_medium, utm_campaign, device, session_id)
  VALUES
    (p_slug, p_titulo, p_referrer, p_utm_source, p_utm_medium, p_utm_camp, p_device, p_session_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_post_view(text,text,text,text,text,text,text,text,text) TO anon;

-- RPC para registrar tempo de leitura (chamada via sendBeacon no unload)
CREATE OR REPLACE FUNCTION update_post_view_time(p_id bigint, p_read_time_s integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE site_post_view_events
  SET read_time_s = p_read_time_s
  WHERE id = p_id AND read_time_s IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION update_post_view_time(bigint, integer) TO anon;
