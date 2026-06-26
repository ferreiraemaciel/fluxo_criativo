#!/usr/bin/env python3
"""
Sincroniza mídias do Google Drive com a tabela `ads` no Supabase.

Lógica:
- Varre a pasta "Tracker" no Drive
- Detecta subpastas cujo nome começa com "ADS " seguido de número (ex: "ADS 042 Hook Forte")
- Para cada pasta, lista os arquivos de mídia (vídeos e imagens)
- Atualiza media_files (JSON array) e media_drive_url (primeiro arquivo) no Supabase

Uso: python3 scripts/sync_drive.py [--dry-run]
"""

import os
import re
import sys
import json
import argparse
import urllib.request
import urllib.parse
from pathlib import Path

# ── Carregar .env ─────────────────────────────────────────────────────────────

def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, val = line.partition("=")
                os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))
            return
        cur = cur.parent

load_env()

SUPABASE_URL      = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
CREDENTIALS_PATH  = os.environ.get("GOOGLE_CREDENTIALS_PATH", "google-credentials.json")
FOLDER_NAME       = os.environ.get("GOOGLE_DRIVE_TRACKER_FOLDER", "Tracker")

# Resolve caminho das credenciais relativo ao projeto
_root = Path(__file__).resolve().parent.parent
_creds_path = _root / CREDENTIALS_PATH
if not _creds_path.exists():
    sys.exit(f"Credenciais não encontradas em: {_creds_path}")

# ── Google Drive API ──────────────────────────────────────────────────────────

from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive"]

def build_drive_service():
    creds = service_account.Credentials.from_service_account_file(
        str(_creds_path), scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)

# ── Extensões aceitas ─────────────────────────────────────────────────────────

VIDEO_EXTS  = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
IMAGE_EXTS  = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic"}

def mime_to_tipo(mime, name):
    ext = Path(name).suffix.lower()
    if ext in VIDEO_EXTS or "video" in mime:
        return "video"
    if ext in IMAGE_EXTS or "image" in mime:
        return "imagem"
    return None

def drive_preview_url(file_id, tipo):
    if tipo == "video":
        return f"https://drive.google.com/file/d/{file_id}/preview"
    return f"https://drive.google.com/thumbnail?id={file_id}&sz=w800"

def drive_view_url(file_id):
    return f"https://drive.google.com/file/d/{file_id}/view"

# ── Pasta local de thumbnails ─────────────────────────────────────────────────

THUMB_DIR = _root / "frontend" / "thumbnails"
THUMB_DIR.mkdir(exist_ok=True)

def _get_auth_token(service):
    from google.auth.transport.requests import Request as _GReq
    creds = service._http.credentials
    if not creds.valid:
        creds.refresh(_GReq())
    return creds.token

def _fetch_url_authed(url, token, timeout=15):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()

def download_thumbnail(service, file_id, numero):
    """Baixa o thumbnail do Drive via API autenticada e salva localmente."""
    try:
        token = _get_auth_token(service)

        # Tenta 1: thumbnailLink da API (disponível quando Drive já processou o vídeo)
        meta = service.files().get(fileId=file_id, fields="thumbnailLink").execute()
        thumb_link = meta.get("thumbnailLink")
        if thumb_link:
            thumb_link = re.sub(r'=s\d+$', '=s400', thumb_link)
            data = _fetch_url_authed(thumb_link, token)
            if data:
                (THUMB_DIR / f"{numero}.jpg").write_bytes(data)
                return True

        # Tenta 2: URL de thumbnail direto do Drive com auth (funciona para muitos vídeos)
        fallback = f"https://drive.google.com/thumbnail?id={file_id}&sz=w400"
        data = _fetch_url_authed(fallback, token)
        if data and len(data) > 1000:  # ignora respostas de erro (muito pequenas)
            (THUMB_DIR / f"{numero}.jpg").write_bytes(data)
            return True

    except Exception as e:
        print(f"    Aviso thumbnail AD{numero}: {e}")
    return False

# ── Listar arquivos de uma pasta ──────────────────────────────────────────────

def list_files_in_folder(service, folder_id):
    results = []
    page_token = None
    while True:
        params = {
            "q": f"'{folder_id}' in parents and trashed=false",
            "fields": "nextPageToken, files(id, name, mimeType, size)",
            "pageSize": 200,
        }
        if page_token:
            params["pageToken"] = page_token
        resp = service.files().list(**params).execute()
        results.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return results

# ── Encontrar pasta raiz "Tracker" ───────────────────────────────────────────

def find_tracker_folder(service):
    resp = service.files().list(
        q=f"name='{FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)",
        pageSize=10,
    ).execute()
    folders = resp.get("files", [])
    if not folders:
        sys.exit(f"Pasta '{FOLDER_NAME}' não encontrada no Drive. Verifique se foi compartilhada com a service account.")
    if len(folders) > 1:
        print(f"  Atenção: {len(folders)} pastas com nome '{FOLDER_NAME}' encontradas. Usando a primeira.")
    return folders[0]["id"]

# ── Listar subpastas ADS XXX ──────────────────────────────────────────────────

ADS_PATTERN = re.compile(r"^ADS\s+(\d+)", re.IGNORECASE)

def list_ads_folders(service, tracker_folder_id):
    resp = service.files().list(
        q=f"'{tracker_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id, name)",
        pageSize=500,
    ).execute()
    folders = resp.get("files", [])
    ads = []
    for f in folders:
        m = ADS_PATTERN.match(f["name"])
        if m:
            ads.append({
                "numero": int(m.group(1)),
                "nome_pasta": f["name"],
                "folder_id": f["id"],
            })
    ads.sort(key=lambda x: x["numero"])
    return ads

# ── Supabase: atualizar ads ───────────────────────────────────────────────────

def detectar_tipo(media_files):
    """Reels = tem vídeo. Imagem = 1 imagem. Carrossel = 2+ imagens. None = sem mídia."""
    videos = [f for f in media_files if f["tipo"] == "video"]
    images = [f for f in media_files if f["tipo"] == "imagem"]
    if videos:
        return "reels"
    if len(images) == 1:
        return "imagem"
    if len(images) > 1:
        return "carrossel"
    return None


def get_status_atual(numero):
    """Lê o status atual do AD no Supabase."""
    url = f"{SUPABASE_URL}/rest/v1/ads?numero=eq.{numero}&select=status"
    req = urllib.request.Request(url, headers={
        "apikey":        SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data[0]["status"] if data else None
    except Exception:
        return None


def update_supabase(numero, media_files, dry_run=False):
    if not media_files:
        return

    primeiro = media_files[0]
    auto_tipo = detectar_tipo(media_files)
    payload = {
        "media_files":     media_files,
        "media_drive_url": primeiro["url_view"],
        "media_tipo":      primeiro["tipo"],
    }
    if auto_tipo:
        payload["tipo"] = auto_tipo

    # Regra: se AD está em "fazer" e agora tem criativo → move para "fazendo"
    status_atual = get_status_atual(numero)
    if status_atual == "fazer":
        payload["status"] = "fazendo"
        print(f"    ↪ Status: fazer → fazendo (criativo detectado)")

    if dry_run:
        print(f"    [dry-run] Supabase UPDATE ads SET media_files={len(media_files)} arquivo(s), tipo={auto_tipo}, status={payload.get('status','—')} WHERE numero={numero}")
        return

    body = json.dumps(payload).encode("utf-8")
    url  = f"{SUPABASE_URL}/rest/v1/ads?numero=eq.{numero}"
    req  = urllib.request.Request(
        url, data=body, method="PATCH",
        headers={
            "apikey":        SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "return=minimal",
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        print(f"    Erro Supabase {e.code}: {e.read().decode()}", file=sys.stderr)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Sincroniza Drive → Supabase (campo media_files)")
    parser.add_argument("--dry-run", action="store_true", help="Mostrar o que seria feito sem salvar")
    args = parser.parse_args()

    print("Conectando ao Google Drive...")
    service = build_drive_service()
    print("  Conectado.")

    print(f"Buscando pasta '{FOLDER_NAME}'...")
    tracker_id = find_tracker_folder(service)
    print(f"  Encontrada (id: {tracker_id})")

    print("Listando subpastas ADS XXX...")
    ads_folders = list_ads_folders(service, tracker_id)
    print(f"  {len(ads_folders)} pasta(s) encontrada(s).")

    if not ads_folders:
        print("Nenhuma pasta ADS encontrada. Crie pastas com o formato 'ADS 001 Nome'.")
        return

    atualizados = 0
    for ad in ads_folders:
        num    = ad["numero"]
        nome   = ad["nome_pasta"]
        fid    = ad["folder_id"]
        print(f"\n  ADS {num:03d} — {nome}")

        arquivos = list_files_in_folder(service, fid)
        media_files = []
        for arq in arquivos:
            tipo = mime_to_tipo(arq["mimeType"], arq["name"])
            if not tipo:
                continue
            media_files.append({
                "nome":      arq["name"],
                "file_id":   arq["id"],
                "tipo":      tipo,
                "url_embed": drive_preview_url(arq["id"], tipo),
                "url_view":  drive_view_url(arq["id"]),
            })

        # Ordena com natural sort: vídeos primeiro, depois imagens
        # "Prancheta 10" vem depois de "Prancheta 2" corretamente
        def natural_key(x):
            parts = re.split(r'(\d+)', x["nome"].lower())
            return (0 if x["tipo"] == "video" else 1,) + tuple(
                int(p) if p.isdigit() else p for p in parts
            )
        media_files.sort(key=natural_key)

        if not media_files:
            print(f"    Nenhum arquivo de mídia encontrado.")
            continue

        print(f"    {len(media_files)} arquivo(s): {[f['nome'] for f in media_files]}")
        update_supabase(num, media_files, dry_run=args.dry_run)

        # Baixa thumbnail local para o primeiro arquivo
        first_id = media_files[0]["file_id"]
        ok = download_thumbnail(service, first_id, num)
        print(f"    Thumbnail: {'salvo' if ok else 'indisponível'}")

        atualizados += 1

    print(f"\n{'[dry-run] ' if args.dry_run else ''}Concluído: {atualizados} AD(s) atualizados no Supabase.")

if __name__ == "__main__":
    main()
