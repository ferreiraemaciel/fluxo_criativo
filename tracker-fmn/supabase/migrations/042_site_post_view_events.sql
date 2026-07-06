-- Eventos individuais de visualização — permite filtrar por período
CREATE TABLE IF NOT EXISTS site_post_view_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug         text        NOT NULL,
  titulo       text,
  viewed_at    timestamptz NOT NULL DEFAULT now(),
  referrer     text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  device       text        -- 'mobile' | 'desktop'
);

ALTER TABLE site_post_view_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read site_post_view_events"
  ON site_post_view_events FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_spve_slug      ON site_post_view_events(slug);
CREATE INDEX IF NOT EXISTS idx_spve_viewed_at ON site_post_view_events(viewed_at DESC);

-- RPC atualizada: grava agregado + evento individual
CREATE OR REPLACE FUNCTION increment_post_view(
  p_slug       text,
  p_titulo     text    DEFAULT NULL,
  p_referrer   text    DEFAULT NULL,
  p_utm_source text    DEFAULT NULL,
  p_utm_medium text    DEFAULT NULL,
  p_utm_camp   text    DEFAULT NULL,
  p_device     text    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO site_post_views (slug, titulo, views, last_view_at)
  VALUES (p_slug, p_titulo, 1, now())
  ON CONFLICT (slug) DO UPDATE
    SET views        = site_post_views.views + 1,
        last_view_at = now(),
        titulo       = COALESCE(EXCLUDED.titulo, site_post_views.titulo);

  INSERT INTO site_post_view_events
    (slug, titulo, referrer, utm_source, utm_medium, utm_campaign, device)
  VALUES
    (p_slug, p_titulo, p_referrer, p_utm_source, p_utm_medium, p_utm_camp, p_device);
END;
$$;

GRANT EXECUTE ON FUNCTION increment_post_view(text,text,text,text,text,text,text) TO anon;
