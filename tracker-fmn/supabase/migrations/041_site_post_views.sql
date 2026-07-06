-- Contagem de visualizações de posts do site FMN (fotografiaeomeunegocio.com.br)
CREATE TABLE IF NOT EXISTS site_post_views (
  slug         text PRIMARY KEY,
  titulo       text,
  views        integer NOT NULL DEFAULT 0,
  last_view_at timestamptz DEFAULT now()
);

ALTER TABLE site_post_views ENABLE ROW LEVEL SECURITY;

-- Leitura pública (anon pode ler contagens)
CREATE POLICY "public read site_post_views"
  ON site_post_views FOR SELECT USING (true);

-- Incremento via RPC com SECURITY DEFINER (anon não edita direto)
CREATE OR REPLACE FUNCTION increment_post_view(p_slug text, p_titulo text DEFAULT NULL)
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
END;
$$;

GRANT EXECUTE ON FUNCTION increment_post_view(text, text) TO anon;
