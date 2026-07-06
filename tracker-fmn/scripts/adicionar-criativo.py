#!/usr/bin/env python3
"""
Adicionar criativo (Fluxo A / preview) — por card.

Pega o material em alta no Drive, otimiza pra PREVIEW leve e joga no R2.
NÃO toca no Meta (isso é o Fluxo B, na publicação).

Tipos:
  - vídeo (1 arquivo de vídeo)        → tipo reels,     540x960, ~1 Mbps
  - 1 imagem                          → tipo imagem,    1080 lado maior, JPEG 82%
  - 2+ imagens                        → tipo carrossel, idem, media_url = array

Origem da pasta no Drive:
  --auto            busca a pasta "ADS <numero>" dentro de "Criativos"
  --pasta <ID|URL>  usa a pasta indicada (modo manual)

Uso:
  python3 scripts/adicionar-criativo.py --numero 314 --auto
  python3 scripts/adicionar-criativo.py --numero 314 --pasta 1AbC...xyz
"""
import argparse, io, json, os, re, subprocess, sys, tempfile, time, random
from pathlib import Path

import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

try:
    from PIL import Image
except ImportError:
    Image = None

ROOT = Path(__file__).resolve().parent.parent
R2_PUBLIC = "https://pub-3af414794ad1436281d1d1b3e9feea36.r2.dev"
BUCKET    = "site-fmn"
FFMPEG    = "/opt/homebrew/bin/ffmpeg"
FFPROBE   = "/opt/homebrew/bin/ffprobe"
PREVIEW_W    = 540    # largura máx do preview de vídeo
PREVIEW_VBIT = 1000   # kbps
IMG_MAX      = 1350   # lado maior do preview de imagem
VIDEO_EXTS = {"mp4","mov","m4v","webm","avi","mkv"}
IMAGE_EXTS = {"jpg","jpeg","png","webp","heic"}


def load_env():
    env = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env

ENV    = load_env()
SB_URL = ENV.get("SUPABASE_URL", "")
SB_KEY = ENV.get("SUPABASE_SERVICE_KEY", "")
CRIATIVOS_FOLDER = ENV.get("GOOGLE_DRIVE_TRACKER_FOLDER", "Criativos")


def drive_service():
    creds = service_account.Credentials.from_service_account_file(
        str(ROOT / ENV["GOOGLE_CREDENTIALS_PATH"]),
        scopes=["https://www.googleapis.com/auth/drive"])
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def sb_get(q):
    return requests.get(f"{SB_URL}/rest/v1/ads?{q}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"}).json()

def sb_patch(numero, updates):
    r = requests.patch(f"{SB_URL}/rest/v1/ads?numero=eq.{numero}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=minimal"},
        json=updates)
    if r.status_code not in (200, 204):
        raise RuntimeError(f"Supabase {r.status_code}: {r.text[:200]}")

def r2_put(key, path, content_type, tentativas=4):
    # O R2 às vezes devolve 500 transitório; tenta de novo com espera.
    last = ""
    for i in range(tentativas):
        r = subprocess.run(["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{key}",
                            "--file", path, "--content-type", content_type, "--remote"],
                           capture_output=True, text=True)
        if r.returncode == 0:
            return
        last = r.stderr[-200:]
        time.sleep(2 * (i + 1))
    raise RuntimeError(f"R2 put falhou após {tentativas} tentativas: {last}")


# ── Drive ──────────────────────────────────────────────────────────
def parse_folder_id(s):
    if not s: return None
    m = re.search(r"[-\w]{25,}", s)   # ID em URL ou puro
    return m.group(0) if m else s

def find_criativos_folder(drv):
    r = drv.files().list(
        q=f"name='{CRIATIVOS_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id)", supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    fs = r.get("files", [])
    if not fs: raise RuntimeError(f"Pasta '{CRIATIVOS_FOLDER}' não encontrada no Drive")
    return fs[0]["id"]

def find_ads_folder(drv, numero):
    root = find_criativos_folder(drv)
    tok = None
    while True:
        r = drv.files().list(
            q=f"'{root}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="nextPageToken, files(id,name)", pageSize=1000, pageToken=tok,
            supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
        for f in r.get("files", []):
            m = re.match(r"^ADS\s+0*(\d+)", f["name"], re.I)
            if m and int(m.group(1)) == numero:
                return f["id"], f["name"]
        tok = r.get("nextPageToken")
        if not tok: break
    raise RuntimeError(f"Pasta 'ADS {numero}' não encontrada no Drive")

def list_media(drv, folder_id):
    r = drv.files().list(q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id,name,mimeType)", pageSize=1000,
        supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    out = []
    for f in r.get("files", []):
        if f["mimeType"] == "application/vnd.google-apps.folder": continue
        ext = f["name"].split(".")[-1].lower()
        if ext in VIDEO_EXTS or "video" in f["mimeType"]: out.append((f, "video"))
        elif ext in IMAGE_EXTS or "image" in f["mimeType"]: out.append((f, "imagem"))
    out.sort(key=lambda x: x[0]["name"])
    return out

def download(drv, file_id, dest):
    req = drv.files().get_media(fileId=file_id)
    with open(dest, "wb") as f:
        dl = MediaIoBaseDownload(f, req); done = False
        while not done: _, done = dl.next_chunk()


# ── Otimização ─────────────────────────────────────────────────────
def optimize_video(src, dst):
    r = subprocess.run([FFMPEG, "-y", "-i", src, "-vf", f"scale='min({PREVIEW_W},iw)':-2",
        "-c:v", "libx264", "-b:v", f"{PREVIEW_VBIT}k", "-maxrate", f"{int(PREVIEW_VBIT*1.3)}k",
        "-bufsize", f"{PREVIEW_VBIT*2}k", "-preset", "medium", "-c:a", "aac", "-b:a", "96k",
        "-movflags", "+faststart", dst], capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError(f"ffmpeg vídeo: {r.stderr[-200:]}")

def capture_thumb(src, dst):
    r = subprocess.run([FFMPEG, "-y", "-ss", "1", "-i", src, "-frames:v", "1",
        "-vf", f"scale='min({PREVIEW_W},iw)':-2", "-q:v", "3", dst], capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError(f"thumb: {r.stderr[-200:]}")

def optimize_image(src, dst):
    if Image is None: raise RuntimeError("Pillow não instalado (pip install pillow)")
    img = Image.open(src)
    if img.mode in ("RGBA", "P", "LA"): img = img.convert("RGB")
    w, h = img.size
    if max(w, h) > IMG_MAX:
        r = IMG_MAX / max(w, h)
        img = img.resize((round(w*r), round(h*r)), Image.LANCZOS)
    img.save(dst, format="JPEG", quality=82, optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--numero", type=int, required=True)
    ap.add_argument("--auto", action="store_true")
    ap.add_argument("--pasta", help="ID ou URL da pasta no Drive (modo manual)")
    args = ap.parse_args()
    numero = args.numero
    drv = drive_service()

    # localiza a pasta
    if args.pasta:
        folder_id = parse_folder_id(args.pasta); folder_name = "(manual)"
    else:
        folder_id, folder_name = find_ads_folder(drv, numero)
    print(f"📁 ADS {numero} — pasta: {folder_name}")

    media = list_media(drv, folder_id)
    if not media:
        print(f"##ERROR pasta sem mídia"); sys.exit("pasta sem arquivos de mídia")

    videos = [m for m in media if m[1] == "video"]
    images = [m for m in media if m[1] == "imagem"]

    uid_base = f"{numero}_{int(time.time()*1000)}_{random.randint(1000,9999)}"
    with tempfile.TemporaryDirectory() as wd:
        if videos:
            tipo = "reels"; print(f"##TIPO reels")
            f = videos[0][0]
            orig = str(Path(wd)/"o.mp4"); opt = str(Path(wd)/"p.mp4"); th = str(Path(wd)/"t.jpg")
            print("  ⬇ baixando vídeo…"); download(drv, f["id"], orig)
            print("  ⚙ preview 540p…"); optimize_video(orig, opt); capture_thumb(opt, th)
            mk = f"ads/media/{uid_base}.mp4"; tk = f"ads/thumbs/{uid_base}.jpg"
            r2_put(mk, opt, "video/mp4"); r2_put(tk, th, "image/jpeg")
            media_url = json.dumps([f"{R2_PUBLIC}/{mk}"]); thumb_url = f"{R2_PUBLIC}/{tk}"
            sb_patch(numero, {"media_url": media_url, "thumb_url": thumb_url,
                              "media_tipo": "video", "tipo": tipo})
        else:
            tipo = "carrossel" if len(images) > 1 else "imagem"; print(f"##TIPO {tipo}")
            urls = []
            for i, (f, _) in enumerate(images):
                orig = str(Path(wd)/f"o{i}"); opt = str(Path(wd)/f"p{i}.jpg")
                print(f"  ⬇ imagem {i+1}/{len(images)}…"); download(drv, f["id"], orig)
                optimize_image(orig, opt)
                k = f"ads/thumbs/{uid_base}_{i}.jpg"; r2_put(k, opt, "image/jpeg")
                urls.append(f"{R2_PUBLIC}/{k}")
            sb_patch(numero, {"media_url": json.dumps(urls), "thumb_url": urls[0],
                              "media_tipo": "imagem", "tipo": tipo})

        print(f"  ✅ ADS {numero} — preview gerado ({tipo})")
        print(f"##DONE {numero}", flush=True)


if __name__ == "__main__":
    main()
