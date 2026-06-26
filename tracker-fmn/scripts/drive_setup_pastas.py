#!/usr/bin/env python3
"""
1. Deleta as pastas de teste (ADS 001, 002, 003)
2. Cria pastas reais para cada AD do Supabase dentro de Criativos
"""
import os, sys, json
from pathlib import Path

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

import urllib.request
_root  = Path(__file__).resolve().parent.parent
_creds = _root / os.environ.get("GOOGLE_CREDENTIALS_PATH", "google-credentials.json")
SUPA_URL = os.environ.get("SUPABASE_URL", "")
SUPA_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
CRIATIVOS_ID = "1jskuzz85CD-OCDj-ckA4jCRhwgoUVT7J"

from google.oauth2 import service_account
from googleapiclient.discovery import build
import warnings
warnings.filterwarnings("ignore")

service = build("drive", "v3",
    credentials=service_account.Credentials.from_service_account_file(
        str(_creds), scopes=["https://www.googleapis.com/auth/drive"]
    ), cache_discovery=False)

# ── 1. Deletar pastas de teste ────────────────────────────────────
TEST_IDS = [
    "1z0TQTKGJbU6ul2038lq29trlYTCVntkN",  # ADS 001 Teste Imagem
    "1-0nnlpx7skGkBA9Q0hiwi-26TcK3D-x9",  # ADS 002 Teste Reels
    "13b7ESELrwJeCteKQeABtVRmNh1tPcMqT",  # ADS 003 Teste Carrossel
]
print("Deletando pastas de teste...")
for fid in TEST_IDS:
    try:
        service.files().delete(fileId=fid).execute()
        print(f"  Deletada: {fid}")
    except Exception as e:
        print(f"  Erro ao deletar {fid}: {e}")

# ── 2. Buscar ADs do Supabase ─────────────────────────────────────
print("\nBuscando ADs no Supabase...")
req = urllib.request.Request(
    f"{SUPA_URL}/rest/v1/ads?select=numero,titulo,tipo&order=numero.asc&limit=500",
    headers={"apikey": SUPA_KEY, "Authorization": f"Bearer {SUPA_KEY}"}
)
with urllib.request.urlopen(req) as resp:
    ads = json.loads(resp.read())
print(f"  {len(ads)} ADs encontrados.")

# ── 3. Verificar pastas já existentes ─────────────────────────────
print("\nVerificando pastas existentes no Drive...")
existing = {}
page_token = None
while True:
    params = {
        "q": f"'{CRIATIVOS_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        "fields": "nextPageToken, files(id, name)",
        "pageSize": 500,
    }
    if page_token:
        params["pageToken"] = page_token
    resp = service.files().list(**params).execute()
    for f in resp.get("files", []):
        existing[f["name"]] = f["id"]
    page_token = resp.get("nextPageToken")
    if not page_token:
        break
print(f"  {len(existing)} pasta(s) já existem.")

# ── 4. Criar pastas para cada AD ──────────────────────────────────
print("\nCriando pastas...")
criadas = 0
for ad in ads:
    num   = ad["numero"]
    titulo = (ad.get("titulo") or "").strip()
    nome  = f"ADS {num:03d}" + (f" {titulo}" if titulo else "")
    # Limitar a 100 chars pra não estourar limite do Drive
    nome  = nome[:100]

    if nome in existing:
        print(f"  Já existe: {nome}")
        continue

    meta = {
        "name": nome,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [CRIATIVOS_ID]
    }
    f = service.files().create(body=meta, fields="id,name").execute()
    print(f"  Criada: {f['name']}")
    criadas += 1

print(f"\nConcluído. {criadas} pasta(s) criada(s).")
