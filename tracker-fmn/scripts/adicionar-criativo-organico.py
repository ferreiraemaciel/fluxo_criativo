#!/usr/bin/env python3
"""
Adicionar criativo do ORGÂNICO (Fluxo A / preview) — por card.

Mesmo modelo do tráfego, mas:
  - pasta raiz do Drive = "Orgânico", subpasta "ORG <n>"
  - número ORG = índice por created_at (igual a UI)
  - regra por plataforma: Story → 1920px, resto → 1350px (JPEG 82%)
  - R2 em organico/media/, atualiza conteudo_organico.slides

Vídeo (Reels): gera DUAS versões.
  - Preview leve (540p) → organico/media/ (permanente, pro card/lightbox).
  - Alta (1080x1920, ≤78MB) → organico/originais/ (o worker organico-media
    já apaga tudo desse prefixo sozinho depois de publicar/agendar).
  Salva em conteudo_organico.media_files: [{"tipo":"video","url_alta":...,"thumb_url":...}]

Uso:
  python3 scripts/adicionar-criativo-organico.py --numero 3 --auto
  python3 scripts/adicionar-criativo-organico.py --numero 3 --pasta <ID|URL>
  python3 scripts/adicionar-criativo-organico.py --todos      # todos os ORG com pasta cheia
"""
import argparse, json, os, re, subprocess, sys, tempfile, time, random
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
# Pasta raiz do orgânico no Drive (compartilhada por link → acesso por ID).
ORGANICO_FOLDER_ID = "1h3cPqEoOnXld-6Sqh3IjsYcsb2bh_PLp"
IMAGE_EXTS = {"jpg","jpeg","png","webp","heic"}
VIDEO_EXTS = {"mp4","mov","m4v","webm"}
PREVIEW_W    = 540
PREVIEW_VBIT = 1000   # kbps
TARGET_MB    = 78
MAX_VBIT_K   = 16000

def load_env():
    env = {}
    for line in (ROOT/".env").read_text(encoding="utf-8").splitlines():
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,v=line.split("=",1); env[k.strip()]=v.strip().strip('"').strip("'")
    return env
ENV=load_env(); SB=ENV["SUPABASE_URL"]; KEY=ENV["SUPABASE_SERVICE_KEY"]
H={"apikey":KEY,"Authorization":f"Bearer {KEY}"}

def drive_service():
    creds=service_account.Credentials.from_service_account_file(
        str(ROOT/ENV["GOOGLE_CREDENTIALS_PATH"]), scopes=["https://www.googleapis.com/auth/drive"])
    return build("drive","v3",credentials=creds,cache_discovery=False)

def sb_patch(cid, updates):
    r=requests.patch(f"{SB}/rest/v1/conteudo_organico?id=eq.{cid}",
        headers={**H,"Content-Type":"application/json","Prefer":"return=minimal"}, json=updates)
    if r.status_code not in (200,204): raise RuntimeError(f"Supabase {r.status_code}: {r.text[:200]}")

def r2_put(key, path, content_type="image/jpeg", tentativas=4):
    last=""
    for i in range(tentativas):
        r=subprocess.run(["npx","wrangler","r2","object","put",f"{BUCKET}/{key}",
            "--file",path,"--content-type",content_type,"--remote"], capture_output=True, text=True)
        if r.returncode==0: return
        last=r.stderr[-200:]; time.sleep(2*(i+1))
    raise RuntimeError(f"R2 put falhou após {tentativas}x: {last}")

def parse_folder_id(s):
    if not s: return None
    m=re.search(r"[-\w]{25,}", s); return m.group(0) if m else s

def cards_por_numero():
    """Replica a UI: ordena por created_at asc, numero = idx+1."""
    rows=requests.get(f"{SB}/rest/v1/conteudo_organico?select=id,tema,plataforma,created_at&order=created_at.asc&limit=2000",headers=H).json()
    return {i+1: r for i,r in enumerate(rows)}

def find_org_folder(drv, numero):
    root=ORGANICO_FOLDER_ID; tok=None
    while True:
        rr=drv.files().list(q=f"'{root}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="nextPageToken, files(id,name)", pageSize=1000, pageToken=tok,
            supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
        for f in rr.get("files",[]):
            m=re.match(r"^ORG\s+0*(\d+)", f["name"], re.I)
            if m and int(m.group(1))==numero: return f["id"], f["name"]
        tok=rr.get("nextPageToken")
        if not tok: break
    raise RuntimeError(f"Pasta 'ORG {numero}' não encontrada")

def list_media(drv, folder_id):
    r=drv.files().list(q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id,name,mimeType)", pageSize=1000, supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    files=[f for f in r.get("files",[]) if f["mimeType"]!="application/vnd.google-apps.folder"]
    imgs=[f for f in files if f["name"].split(".")[-1].lower() in IMAGE_EXTS or "image" in f["mimeType"]]
    vids=[f for f in files if f["name"].split(".")[-1].lower() in VIDEO_EXTS or "video" in f["mimeType"]]
    imgs.sort(key=lambda x:x["name"]); vids.sort(key=lambda x:x["name"])
    return imgs, vids

def download(drv, fid, dest):
    req=drv.files().get_media(fileId=fid)
    with open(dest,"wb") as f:
        dl=MediaIoBaseDownload(f,req); done=False
        while not done: _,done=dl.next_chunk()

def optimize_image(src, dst, maxpx):
    if Image is None: raise RuntimeError("Pillow não instalado")
    img=Image.open(src)
    if img.mode in ("RGBA","P","LA"): img=img.convert("RGB")
    w,h=img.size
    if max(w,h)>maxpx:
        r=maxpx/max(w,h); img=img.resize((round(w*r),round(h*r)), Image.LANCZOS)
    img.save(dst, format="JPEG", quality=82, optimize=True)

def probe_duration(path):
    out=subprocess.run([FFPROBE,"-v","error","-show_entries","format=duration",
                        "-of","csv=p=0",path], capture_output=True, text=True).stdout.strip()
    return float(out)

def optimize_preview_video(src, dst):
    """Preview leve (540p), single-pass, pro card/lightbox."""
    scale=f"scale='min({PREVIEW_W},iw)':-2"
    r=subprocess.run([FFMPEG,"-y","-i",src,"-vf",scale,"-c:v","libx264",
        "-b:v",f"{PREVIEW_VBIT}k","-maxrate",f"{int(PREVIEW_VBIT*1.3)}k",
        "-bufsize",f"{PREVIEW_VBIT*2}k","-preset","medium",
        "-c:a","aac","-b:a","96k","-movflags","+faststart",dst],
        capture_output=True, text=True)
    if r.returncode!=0: raise RuntimeError(f"ffmpeg preview falhou: {r.stderr[-300:]}")

def optimize_high_video(src, dst, workdir):
    """Alta qualidade (1080 de largura máx, aspecto preservado), teto ~78MB,
    two-pass — a mesma qualidade que sobe pro Meta Ads, boa o suficiente pro Reels."""
    dur=probe_duration(src)
    vbit_k=int(TARGET_MB*1024*1024*8/dur/1000)-128
    vbit_k=max(500, min(vbit_k, MAX_VBIT_K))
    scale="scale='min(1080,iw)':-2"
    passlog=str(Path(workdir)/"pass")
    common=[FFMPEG,"-y","-i",src,"-vf",scale,"-c:v","libx264",
            "-b:v",f"{vbit_k}k","-preset","medium","-passlogfile",passlog]
    subprocess.run(common+["-pass","1","-an","-f","mp4",os.devnull], capture_output=True, check=True)
    subprocess.run(common+["-pass","2","-c:a","aac","-b:a","128k",
                   "-movflags","+faststart",dst], capture_output=True, check=True)

def capture_thumb(src, dst):
    r=subprocess.run([FFMPEG,"-y","-ss","1","-i",src,"-frames:v","1",
                      "-vf",f"scale='min({PREVIEW_W},iw)':-2","-q:v","3",dst],
                     capture_output=True, text=True)
    if r.returncode!=0: raise RuntimeError(f"thumb falhou: {r.stderr[-300:]}")

def process_video(numero, cid, drv, vid_file, uid):
    print(f"  📹 vídeo: {vid_file['name']}")
    with tempfile.TemporaryDirectory() as wd:
        orig=str(Path(wd)/"orig.mp4"); prev=str(Path(wd)/"preview.mp4")
        high=str(Path(wd)/"high.mp4"); thmb=str(Path(wd)/"thumb.jpg")
        print("  ⬇ baixando original do Drive…"); download(drv, vid_file["id"], orig)
        print("  ⚙ preview (540p)…"); optimize_preview_video(orig, prev)
        capture_thumb(prev, thmb)
        print("  ⚙ alta qualidade (1080p, ≤78MB, two-pass)…"); optimize_high_video(orig, high, wd)

        prev_key=f"organico/media/{uid}_preview.mp4"
        thumb_key=f"organico/media/{uid}_thumb.jpg"
        # organico/originais/ é o prefixo que o worker organico-media já
        # sabe apagar sozinho depois de publicar (mesma convenção das imagens).
        high_key=f"organico/originais/{uid}.mp4"
        print("  ⬆ subindo preview + thumb + alta no R2…")
        r2_put(prev_key, prev, "video/mp4")
        r2_put(thumb_key, thmb, "image/jpeg")
        r2_put(high_key, high, "video/mp4")

        preview_url=f"{R2_PUBLIC}/{prev_key}"; thumb_url=f"{R2_PUBLIC}/{thumb_key}"; high_url=f"{R2_PUBLIC}/{high_key}"
        slides=json.dumps([{"image_url":preview_url}])
        media_files=json.dumps([{"tipo":"video","url_alta":high_url,"thumb_url":thumb_url}])
        sb_patch(cid, {"slides":slides, "media_files":media_files})
        print(f"  ✅ ORG {numero} — vídeo pronto (preview + alta no R2)")
        print(f"##DONE {numero}", flush=True)

def process(numero, drv, mapa, pasta=None):
    card=mapa.get(numero)
    if not card: print(f"  ORG {numero}: card não encontrado"); return
    cid=card["id"]; plataforma=(card.get("plataforma") or "").lower()
    maxpx=1920 if plataforma=="stories" or plataforma=="story" else 1350
    folder_id, folder_name = (parse_folder_id(pasta),"(manual)") if pasta else find_org_folder(drv,numero)
    print(f"📁 ORG {numero} — {folder_name} | plataforma={card.get('plataforma')} | max={maxpx}px")
    imgs, vids = list_media(drv, folder_id)
    uid=f"{cid[:8]}_{int(time.time()*1000)}_{random.randint(1000,9999)}"

    if vids:
        # Reels: um vídeo por card (usa o primeiro se houver mais de um na pasta).
        process_video(numero, cid, drv, vids[0], uid)
        return

    if not imgs: print(f"  ⏭️ pasta vazia"); print(f"##SKIP {numero}", flush=True); return
    urls=[]
    with tempfile.TemporaryDirectory() as wd:
        for i,f in enumerate(imgs):
            o=str(Path(wd)/f"o{i}"); p=str(Path(wd)/f"p{i}.jpg")
            print(f"  ⬇ imagem {i+1}/{len(imgs)}…"); download(drv,f["id"],o); optimize_image(o,p,maxpx)
            k=f"organico/media/{uid}_{i}.jpg"; r2_put(k,p); urls.append(f"{R2_PUBLIC}/{k}")
    slides=json.dumps([{"image_url":u} for u in urls])
    sb_patch(cid, {"slides":slides})
    print(f"  ✅ ORG {numero} — {len(urls)} imagem(ns) no R2")
    print(f"##DONE {numero}", flush=True)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--numero", type=int)
    ap.add_argument("--auto", action="store_true")
    ap.add_argument("--pasta")
    ap.add_argument("--todos", action="store_true")
    args=ap.parse_args()
    drv=drive_service(); mapa=cards_por_numero()
    if args.todos:
        nums=sorted(mapa.keys())
        print(f"##TOTAL {len(nums)}", flush=True)
        for n in nums:
            try: process(n, drv, mapa)
            except Exception as e: print(f"  ❌ ORG {n}: {e}")
    elif args.numero:
        process(args.numero, drv, mapa, args.pasta)
    else:
        sys.exit("--numero N ou --todos")
    print("\n✅ Concluído.")

if __name__=="__main__": main()
