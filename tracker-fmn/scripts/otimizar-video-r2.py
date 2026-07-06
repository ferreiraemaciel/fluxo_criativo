#!/usr/bin/env python3
"""
Otimiza o vídeo original (Drive) de um card de reels e sobe pro R2.

Fluxo:
  1. Lê o file_id do original no Drive (media_files do card)
  2. Baixa o original
  3. ffmpeg two-pass → 1080x1920 (aspecto preservado), teto ~78 MB, H.264 MP4
  4. Captura um frame como thumbnail (webp)
  5. Sobe vídeo (ads/media/) e thumb (ads/thumbs/) direto no R2 (wrangler)
  6. Atualiza thumb_url + media_url na tabela ads

Uso:
    python3 scripts/otimizar-video-r2.py --numero 339
    python3 scripts/otimizar-video-r2.py --todos        # todos reels sem thumb_url
    python3 scripts/otimizar-video-r2.py --numero 339 --dry-run

Requer: google-api-python-client, requests, ffmpeg no PATH (/opt/homebrew/bin)
"""
import argparse, io, json, os, subprocess, sys, tempfile, time, random
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
# Fluxo A — preview leve do card. Baixa resolução, ocupa pouco espaço no R2.
PREVIEW_W    = 540      # largura máx do preview (vertical vira 540x960)
PREVIEW_VBIT = 1000     # bitrate do vídeo do preview, em kbps (leve)


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


def drive_service():
    creds = service_account.Credentials.from_service_account_file(
        str(ROOT / ENV["GOOGLE_CREDENTIALS_PATH"]),
        scopes=["https://www.googleapis.com/auth/drive"])
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def sb_get(query):
    r = requests.get(f"{SB_URL}/rest/v1/ads?{query}",
                     headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"})
    return r.json()


def sb_patch(numero, updates, dry):
    if dry:
        print(f"    [dry-run] PATCH ads numero={numero} → {updates}")
        return
    r = requests.patch(f"{SB_URL}/rest/v1/ads?numero=eq.{numero}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}",
                 "Content-Type": "application/json", "Prefer": "return=minimal"},
        json=updates)
    if r.status_code not in (200, 204):
        print(f"    ERRO Supabase: {r.status_code} {r.text}")


def r2_put(key, path, content_type, dry):
    if dry:
        print(f"    [dry-run] r2 put {BUCKET}/{key}")
        return
    r = subprocess.run(["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{key}",
                        "--file", path, "--content-type", content_type, "--remote"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"R2 put falhou: {r.stderr[-300:]}")


def probe_duration(path):
    out = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    return float(out)


def probe_dims(path):
    out = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0",
        "-show_entries", "stream=width,height,bit_rate", "-of", "json", path],
        capture_output=True, text=True).stdout
    s = json.loads(out)["streams"][0]
    return s.get("width"), s.get("height"), s.get("bit_rate")


def download_drive(drv, file_id, dest):
    req = drv.files().get_media(fileId=file_id)
    with open(dest, "wb") as f:
        dl = MediaIoBaseDownload(f, req)
        done = False
        while not done:
            _, done = dl.next_chunk()


def optimize_preview(src, dst):
    """Fluxo A: preview leve H.264 MP4, 540 de largura máx, bitrate baixo.
    Single-pass (rápido). Aspecto sempre preservado."""
    dur = probe_duration(src)
    scale = f"scale='min({PREVIEW_W},iw)':-2"
    r = subprocess.run(
        [FFMPEG, "-y", "-i", src, "-vf", scale, "-c:v", "libx264",
         "-b:v", f"{PREVIEW_VBIT}k", "-maxrate", f"{int(PREVIEW_VBIT*1.3)}k",
         "-bufsize", f"{PREVIEW_VBIT*2}k", "-preset", "medium",
         "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", dst],
        capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg preview falhou: {r.stderr[-300:]}")
    return dur


def capture_thumb(src, dst):
    r = subprocess.run([FFMPEG, "-y", "-ss", "1", "-i", src, "-frames:v", "1",
                        "-vf", f"scale='min({PREVIEW_W},iw)':-2", "-q:v", "3", dst],
                       capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"thumb falhou: {r.stderr[-300:]}")


def process(numero, drv, dry):
    rows = sb_get(f"numero=eq.{numero}&select=numero,tipo,media_files")
    if not rows:
        print(f"  ADS {numero}: não encontrado"); return
    row = rows[0]
    mf = row.get("media_files") or []
    if isinstance(mf, str):
        mf = json.loads(mf)
    file_ids = [x.get("file_id") for x in mf if x.get("file_id")]
    if not file_ids:
        print(f"  ADS {numero}: sem file_id de vídeo no Drive"); return
    file_id = file_ids[0]

    print(f"\n📹 ADS {numero} — otimizando vídeo (file {file_id[:14]}…)")
    with tempfile.TemporaryDirectory() as wd:
        orig = str(Path(wd) / "orig.mp4")
        opt  = str(Path(wd) / "opt.mp4")
        thmb = str(Path(wd) / "thumb.jpg")
        print("  ⬇ baixando original do Drive…")
        download_drive(drv, file_id, orig)
        omb = os.path.getsize(orig) / 1048576
        ow, oh, obr = probe_dims(orig)
        print(f"  original: {ow}x{oh}, {omb:.1f} MB, bitrate={obr}")

        print("  ⚙ ffmpeg preview (540p)…")
        dur = optimize_preview(orig, opt)
        capture_thumb(opt, thmb)
        nmb = os.path.getsize(opt) / 1048576
        nw, nh, nbr = probe_dims(opt)
        print(f"  preview: {nw}x{nh}, {nmb:.1f} MB, {int(dur)}s")

        uid = f"{numero}_{int(time.time()*1000)}_{random.randint(1000,9999)}"
        media_key = f"ads/media/{uid}.mp4"
        thumb_key = f"ads/thumbs/{uid}.jpg"
        print("  ⬆ subindo no R2…")
        r2_put(media_key, opt, "video/mp4", dry)
        r2_put(thumb_key, thmb, "image/jpeg", dry)

        media_url = f"{R2_PUBLIC}/{media_key}"
        thumb_url = f"{R2_PUBLIC}/{thumb_key}"
        sb_patch(numero, {"media_url": json.dumps([media_url]),
                          "thumb_url": thumb_url, "media_tipo": "video"}, dry)
        print(f"  ✅ ADS {numero} otimizado. media_url={media_url}")
        print(f"##DONE {numero}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--numero", type=int, help="Número do card")
    ap.add_argument("--todos", action="store_true", help="Todos reels sem thumb_url")
    ap.add_argument("--limite", type=int, default=0, help="Processa no máx N por vez (0 = sem limite)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    drv = drive_service()
    if args.todos:
        rows = sb_get("tipo=eq.reels&thumb_url=is.null&media_files=not.is.null&select=numero")
        nums = [r["numero"] for r in rows]
        if args.limite:
            nums = nums[:args.limite]
        print(f"🎬 {len(nums)} reels nesta rodada (pendentes: {len(rows)})")
        print(f"##TOTAL {len(nums)}", flush=True)
        for n in nums:
            try: process(n, drv, args.dry_run)
            except Exception as e: print(f"  ❌ ADS {n}: {e}")
    elif args.numero:
        process(args.numero, drv, args.dry_run)
    else:
        sys.exit("Informe --numero N ou --todos")
    print("\n✅ Concluído.")


if __name__ == "__main__":
    main()
