#!/usr/bin/env python3
"""
Re-otimiza arquivos PNG já enviados ao R2 (ads/thumbs/).
- PNG sem transparência → JPEG 82% (redução significativa de tamanho)
- PNG com transparência → mantém PNG (não perde alpha)
- Atualiza media_url e thumb_url na tabela ads do Supabase
- Remove o PNG antigo do R2 após confirmar o JPEG novo

Uso:
    python3 scripts/reotimizar-midia-r2.py [--dry-run]

Requer:
    pip install pillow requests
"""

import argparse
import io
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
    import requests
except ImportError:
    sys.exit("Instale as dependências: pip install pillow requests")


def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            env = {}
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
            return env
        cur = cur.parent
    sys.exit(".env não encontrado")


def has_transparency(img: Image.Image) -> bool:
    if img.mode not in ("RGBA", "LA", "PA"):
        return False
    alpha = img.split()[-1]
    return min(alpha.getdata()) < 255


def compress_image(data: bytes):
    """Retorna (bytes_otimizados, mime_type). PNG opaco → JPEG 82%."""
    img = Image.open(io.BytesIO(data))
    w, h = img.size
    if max(w, h) > 1920:
        ratio = 1920 / max(w, h)
        img = img.resize((round(w * ratio), round(h * ratio)), Image.LANCZOS)

    if img.format == "PNG" and not has_transparency(img):
        out = io.BytesIO()
        img.convert("RGB").save(out, format="JPEG", quality=82, optimize=True)
        return out.getvalue(), "image/jpeg"
    else:
        out = io.BytesIO()
        img.save(out, format="PNG", optimize=True)
        return out.getvalue(), "image/png"


def r2_put(bucket: str, key: str, file_path: str, content_type: str, dry_run: bool) -> bool:
    if dry_run:
        print(f"    [dry-run] wrangler r2 object put {bucket}/{key}")
        return True
    result = subprocess.run(
        ["npx", "wrangler", "r2", "object", "put", f"{bucket}/{key}",
         "--file", file_path, "--content-type", content_type],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"    ERRO ao fazer upload: {result.stderr}")
        return False
    return True


def r2_delete(bucket: str, key: str, dry_run: bool):
    if dry_run:
        print(f"    [dry-run] wrangler r2 object delete {bucket}/{key}")
        return
    subprocess.run(
        ["npx", "wrangler", "r2", "object", "delete", f"{bucket}/{key}"],
        capture_output=True
    )


def supabase_update(url: str, key: str, ad_id: str, updates: dict, dry_run: bool):
    if dry_run:
        print(f"    [dry-run] PATCH ads id={ad_id} → {updates}")
        return
    resp = requests.patch(
        f"{url}/rest/v1/ads?id=eq.{ad_id}",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=updates,
    )
    if resp.status_code not in (200, 204):
        print(f"    ERRO Supabase: {resp.status_code} {resp.text}")


R2_PUBLIC = "https://pub-3af414794ad1436281d1d1b3e9feea36.r2.dev"
BUCKET    = "site-fmn"


def process_url(url: str):
    """Retorna (r2_key, new_url) se URL for PNG no R2, senão None."""
    if R2_PUBLIC not in url or not url.endswith(".png"):
        return None
    key = url.replace(f"{R2_PUBLIC}/", "")
    return key, url


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Mostra o que seria feito sem executar")
    args = parser.parse_args()

    env = load_env()
    sb_url = env.get("SUPABASE_URL", "https://wntzzzuqoqmfcjebmzul.supabase.co")
    sb_key = env.get("SUPABASE_SERVICE_KEY", "")

    print("🔍 Buscando ads com PNG no R2...")
    resp = requests.get(
        f"{sb_url}/rest/v1/ads?select=id,numero,titulo,media_url,thumb_url&media_url=like.*\\.png*",
        headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"},
    )
    ads = resp.json()
    print(f"   {len(ads)} ad(s) encontrado(s)")

    for ad in ads:
        ad_id   = ad["id"]
        num     = ad["numero"]
        titulo  = ad["titulo"][:55]
        print(f"\n📦 ADS {num}: {titulo}...")

        media_urls = json.loads(ad["media_url"]) if ad.get("media_url") else []
        thumb_url  = ad.get("thumb_url", "")

        new_media_urls = []
        updates = {}
        changed = False

        all_urls = list(dict.fromkeys(media_urls + ([thumb_url] if thumb_url else [])))

        url_remap = {}  # old_url → new_url

        for url in all_urls:
            parsed = process_url(url)
            if not parsed:
                continue
            old_key, _ = parsed

            print(f"  ⬇ Baixando {old_key.split('/')[-1]}...")
            dl = requests.get(f"{R2_PUBLIC}/{old_key}")
            if dl.status_code != 200:
                print(f"    ERRO ao baixar: {dl.status_code}")
                continue

            original_size = len(dl.content)
            new_data, new_mime = compress_image(dl.content)
            new_size = len(new_data)
            savings  = (1 - new_size / original_size) * 100

            ext = "jpg" if new_mime == "image/jpeg" else "png"
            new_key = old_key.rsplit(".", 1)[0] + f".{ext}"
            new_url = f"{R2_PUBLIC}/{new_key}"

            print(f"    {original_size/1024:.0f} KB → {new_size/1024:.0f} KB ({savings:.0f}% menor) [{ext}]")

            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
                tmp.write(new_data)
                tmp_path = tmp.name

            try:
                ok = r2_put(BUCKET, new_key, tmp_path, new_mime, args.dry_run)
                if ok and new_key != old_key:
                    r2_delete(BUCKET, old_key, args.dry_run)
                    changed = True
                url_remap[url] = new_url
            finally:
                os.unlink(tmp_path)

        # Reconstrói media_url e thumb_url com novos caminhos
        new_media_list = [url_remap.get(u, u) for u in media_urls]
        new_thumb      = url_remap.get(thumb_url, thumb_url)

        if url_remap:
            updates["media_url"] = json.dumps(new_media_list)
            updates["thumb_url"] = new_thumb

        if updates:
            print(f"  📝 Atualizando Supabase...")
            supabase_update(sb_url, sb_key, ad_id, updates, args.dry_run)
            print(f"  ✅ ADS {num} re-otimizado")
        else:
            print(f"  — Nenhuma mudança necessária")

    print("\n✅ Concluído.")


if __name__ == "__main__":
    main()
