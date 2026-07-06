#!/usr/bin/env python3
"""
Fluxo B — prepara o criativo de VÍDEO na biblioteca do Meta.

Só roda quando o card ainda NÃO tem meta_video_id. Passos:
  1. Pega o original em alta no Drive (file_id do card)
  2. ffmpeg two-pass → 1080x1920, teto ~78 MB, H.264 MP4
  3. Sobe TEMPORARIAMENTE no R2 (ads/temp-meta/)
  4. Envia ao Meta (/advideos por file_url) → recebe video_id
  5. Espera o vídeo ficar "ready" na biblioteca do Meta
  6. Salva meta_video_id no card
  7. APAGA o arquivo temporário do R2 (não precisa mais)

Imprime "##VIDEOID <id>" no fim (o serve.py lê isso).

Uso:
    python3 scripts/preparar-criativo-meta.py --numero 339
"""
import argparse, json, os, subprocess, sys, tempfile, time, random
from pathlib import Path

import requests
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

ROOT = Path(__file__).resolve().parent.parent
R2_PUBLIC = "https://pub-3af414794ad1436281d1d1b3e9feea36.r2.dev"
BUCKET    = "site-fmn"
FFMPEG    = "/opt/homebrew/bin/ffmpeg"
FFPROBE   = "/opt/homebrew/bin/ffprobe"
GRAPH     = "https://graph.facebook.com/v21.0"
TARGET_MB  = 78
MAX_VBIT_K = 16000


def load_env():
    env = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV     = load_env()
SB_URL  = ENV.get("SUPABASE_URL", "")
SB_KEY  = ENV.get("SUPABASE_SERVICE_KEY", "")
TOKEN   = ENV.get("FB_ACCESS_TOKEN_PERMANENTE", "")
ACCOUNT = ENV.get("FB_AD_ACCOUNT_ID", "")
if ACCOUNT and not ACCOUNT.startswith("act_"):
    ACCOUNT = f"act_{ACCOUNT}"


def drive_service():
    creds = service_account.Credentials.from_service_account_file(
        str(ROOT / ENV["GOOGLE_CREDENTIALS_PATH"]),
        scopes=["https://www.googleapis.com/auth/drive"])
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def sb_get(query):
    r = requests.get(f"{SB_URL}/rest/v1/ads?{query}",
                     headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    return r.json()


def sb_patch(numero, updates):
    r = requests.patch(f"{SB_URL}/rest/v1/ads?numero=eq.{numero}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=minimal"},
        json=updates)
    if r.status_code not in (200, 204):
        print(f"    ERRO Supabase: {r.status_code} {r.text}")


def r2_put(key, path):
    r = subprocess.run(["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{key}",
                        "--file", path, "--content-type", "video/mp4", "--remote"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"R2 put falhou: {r.stderr[-300:]}")


def r2_delete(key):
    subprocess.run(["npx", "wrangler", "r2", "object", "delete", f"{BUCKET}/{key}", "--remote"],
                   capture_output=True)


def probe_duration(path):
    out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    return float(out)


def download_drive(drv, file_id, dest):
    req = drv.files().get_media(fileId=file_id)
    with open(dest, "wb") as f:
        dl = MediaIoBaseDownload(f, req)
        done = False
        while not done:
            _, done = dl.next_chunk()


def optimize_high(src, dst, workdir):
    """Two-pass H.264, 1080 de largura máx (aspecto preservado), teto ~78 MB."""
    dur = probe_duration(src)
    vbit_k = int(TARGET_MB * 1024 * 1024 * 8 / dur / 1000) - 128
    vbit_k = max(500, min(vbit_k, MAX_VBIT_K))
    scale = "scale='min(1080,iw)':-2"
    passlog = str(Path(workdir) / "pass")
    common = [FFMPEG, "-y", "-i", src, "-vf", scale, "-c:v", "libx264",
              "-b:v", f"{vbit_k}k", "-preset", "medium", "-passlogfile", passlog]
    subprocess.run(common + ["-pass", "1", "-an", "-f", "mp4", os.devnull],
                   capture_output=True, check=True)
    subprocess.run(common + ["-pass", "2", "-c:a", "aac", "-b:a", "128k",
                   "-movflags", "+faststart", dst], capture_output=True, check=True)


def meta_upload_video(file_url):
    r = requests.post(f"{GRAPH}/{ACCOUNT}/advideos",
                      data={"file_url": file_url, "access_token": TOKEN})
    d = r.json()
    if "id" not in d:
        raise RuntimeError(f"Meta /advideos falhou: {d}")
    return d["id"]


def meta_wait_ready(video_id, tries=40):
    for _ in range(tries):
        r = requests.get(f"{GRAPH}/{video_id}",
                         params={"fields": "status", "access_token": TOKEN})
        vs = (r.json().get("status") or {}).get("video_status")
        if vs == "ready":
            return True
        time.sleep(3)
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--numero", type=int, required=True)
    args = ap.parse_args()
    numero = args.numero

    rows = sb_get(f"numero=eq.{numero}&select=numero,tipo,media_files,meta_video_id")
    if not rows:
        sys.exit(f"ADS {numero} não encontrado")
    row = rows[0]

    if row.get("meta_video_id"):
        print(f"ADS {numero} já tem criativo no Meta.")
        print(f"##VIDEOID {row['meta_video_id']}", flush=True)
        return

    mf = row.get("media_files") or []
    if isinstance(mf, str):
        mf = json.loads(mf)
    file_ids = [x.get("file_id") for x in mf if x.get("file_id")]
    if not file_ids:
        sys.exit(f"ADS {numero}: sem file_id de vídeo no Drive")
    file_id = file_ids[0]

    drv = drive_service()
    print(f"📹 ADS {numero} — preparando criativo pro Meta…")
    with tempfile.TemporaryDirectory() as wd:
        orig = str(Path(wd) / "orig.mp4")
        high = str(Path(wd) / "high.mp4")
        print("  ⬇ baixando original do Drive…")
        download_drive(drv, file_id, orig)
        print("  ⚙ ffmpeg 2-pass (1080x1920, ≤80 MB)…")
        optimize_high(orig, high, wd)
        mb = os.path.getsize(high) / 1048576
        print(f"  gerado: {mb:.1f} MB")

        uid = f"{numero}_{int(time.time()*1000)}_{random.randint(1000,9999)}"
        temp_key = f"ads/temp-meta/{uid}.mp4"
        print("  ⬆ subindo temporário no R2…")
        r2_put(temp_key, high)
        temp_url = f"{R2_PUBLIC}/{temp_key}"

        try:
            print("  ☁ enviando ao Meta (/advideos)…")
            video_id = meta_upload_video(temp_url)
            print(f"  video_id={video_id}, aguardando processar…")
            if not meta_wait_ready(video_id):
                raise RuntimeError("vídeo não ficou 'ready' a tempo")
        finally:
            print("  🧹 apagando temporário do R2…")
            r2_delete(temp_key)

        sb_patch(numero, {"meta_video_id": video_id})
        print(f"  ✅ ADS {numero} pronto no Meta. video_id={video_id}")
        print(f"##VIDEOID {video_id}", flush=True)


if __name__ == "__main__":
    main()
