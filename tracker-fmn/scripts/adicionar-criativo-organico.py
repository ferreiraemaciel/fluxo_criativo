#!/usr/bin/env python3
"""
Adicionar criativo do ORGÂNICO (Fluxo A / preview) — por card.

Mesmo modelo do tráfego, mas:
  - pasta raiz do Drive = "Orgânico", subpasta "ORG <n>"
  - número ORG = índice por created_at (igual a UI)
  - regra por plataforma: Story → 1920px, resto → 1350px (JPEG 82%)
  - R2 em organico/media/, atualiza conteudo_organico.slides

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
# Pasta raiz do orgânico no Drive (compartilhada por link → acesso por ID).
ORGANICO_FOLDER_ID = "1h3cPqEoOnXld-6Sqh3IjsYcsb2bh_PLp"
IMAGE_EXTS = {"jpg","jpeg","png","webp","heic"}

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

def r2_put(key, path, tentativas=4):
    last=""
    for i in range(tentativas):
        r=subprocess.run(["npx","wrangler","r2","object","put",f"{BUCKET}/{key}",
            "--file",path,"--content-type","image/jpeg","--remote"], capture_output=True, text=True)
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

def list_images(drv, folder_id):
    r=drv.files().list(q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id,name,mimeType)", pageSize=1000, supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
    out=[f for f in r.get("files",[]) if f["mimeType"]!="application/vnd.google-apps.folder"
         and (f["name"].split(".")[-1].lower() in IMAGE_EXTS or "image" in f["mimeType"])]
    out.sort(key=lambda x:x["name"]); return out

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

def process(numero, drv, mapa, pasta=None):
    card=mapa.get(numero)
    if not card: print(f"  ORG {numero}: card não encontrado"); return
    cid=card["id"]; plataforma=(card.get("plataforma") or "").lower()
    maxpx=1920 if plataforma=="stories" or plataforma=="story" else 1350
    folder_id, folder_name = (parse_folder_id(pasta),"(manual)") if pasta else find_org_folder(drv,numero)
    print(f"📁 ORG {numero} — {folder_name} | plataforma={card.get('plataforma')} | max={maxpx}px")
    imgs=list_images(drv, folder_id)
    if not imgs: print(f"  ⏭️ pasta vazia"); print(f"##SKIP {numero}", flush=True); return
    uid=f"{cid[:8]}_{int(time.time()*1000)}_{random.randint(1000,9999)}"
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
