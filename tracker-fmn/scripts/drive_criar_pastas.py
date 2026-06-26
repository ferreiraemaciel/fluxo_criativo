#!/usr/bin/env python3
"""
Cria pastas ADS XXX dentro da pasta Criativos no Drive.
Uso: python3 scripts/drive_criar_pastas.py
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

_root = Path(__file__).resolve().parent.parent
_creds = _root / os.environ.get("GOOGLE_CREDENTIALS_PATH", "google-credentials.json")

from google.oauth2 import service_account
from googleapiclient.discovery import build

service = build("drive", "v3",
    credentials=service_account.Credentials.from_service_account_file(
        str(_creds), scopes=["https://www.googleapis.com/auth/drive"]
    ), cache_discovery=False)

# ID da pasta Criativos (encontrado pelo sync_drive.py)
CRIATIVOS_ID = "1jskuzz85CD-OCDj-ckA4jCRhwgoUVT7J"

# Pastas a criar para teste
PASTAS = ["ADS 001 Teste Imagem", "ADS 002 Teste Reels", "ADS 003 Teste Carrossel"]

for nome in PASTAS:
    meta = {"name": nome, "mimeType": "application/vnd.google-apps.folder", "parents": [CRIATIVOS_ID]}
    f = service.files().create(body=meta, fields="id,name").execute()
    print(f"  Criada: {f['name']} (id: {f['id']})")

print("\nPastas criadas no Drive. Adicione arquivos de mídia dentro de cada uma e rode:")
print("  python3 scripts/sync_drive.py --dry-run")
