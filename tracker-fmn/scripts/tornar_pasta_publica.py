#!/usr/bin/env python3
"""
Torna a pasta Criativos (e todos os arquivos dentro das subpastas ADS)
publicamente acessíveis via Drive API usando o Service Account.
"""

import os
import sys
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

CREDENTIALS_PATH = os.environ.get("GOOGLE_CREDENTIALS_PATH", "google-credentials.json")
FOLDER_NAME      = os.environ.get("GOOGLE_DRIVE_TRACKER_FOLDER", "Criativos")

_root       = Path(__file__).resolve().parent.parent
_creds_path = _root / CREDENTIALS_PATH
if not _creds_path.exists():
    sys.exit(f"Credenciais não encontradas em: {_creds_path}")

from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/drive"]

def build_service():
    creds = service_account.Credentials.from_service_account_file(
        str(_creds_path), scopes=SCOPES
    )
    return build("drive", "v3", credentials=creds, cache_discovery=False)

def make_public(service, file_id, name=""):
    try:
        service.permissions().create(
            fileId=file_id,
            body={"role": "reader", "type": "anyone"},
            fields="id",
        ).execute()
        return True
    except Exception as e:
        print(f"  Erro ao tornar público '{name}': {e}")
        return False

def main():
    service = build_service()

    # 1. Encontrar pasta Criativos
    print(f"Buscando pasta '{FOLDER_NAME}'...")
    res = service.files().list(
        q=f"name='{FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id,name)",
    ).execute()
    folders = res.get("files", [])
    if not folders:
        sys.exit(f"Pasta '{FOLDER_NAME}' não encontrada.")
    folder_id = folders[0]["id"]
    print(f"  Encontrada: {folder_id}")

    # 2. Tornar a pasta raiz pública
    make_public(service, folder_id, FOLDER_NAME)
    print(f"  Pasta '{FOLDER_NAME}' tornada pública.")

    # 3. Listar subpastas ADS
    print("Listando subpastas ADS...")
    page_token = None
    ads_folders = []
    while True:
        params = dict(
            q=f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="nextPageToken,files(id,name)",
            pageSize=200,
        )
        if page_token:
            params["pageToken"] = page_token
        res = service.files().list(**params).execute()
        ads_folders.extend(res.get("files", []))
        page_token = res.get("nextPageToken")
        if not page_token:
            break
    print(f"  {len(ads_folders)} subpastas encontradas.")

    # 4. Para cada subpasta: tornar pública + tornar arquivos públicos
    ok = 0
    erros = 0
    for i, folder in enumerate(ads_folders, 1):
        fid  = folder["id"]
        nome = folder["name"]
        make_public(service, fid, nome)

        # Listar arquivos dentro da subpasta
        res = service.files().list(
            q=f"'{fid}' in parents and trashed=false",
            fields="files(id,name)",
            pageSize=200,
        ).execute()
        files = res.get("files", [])
        for f in files:
            if make_public(service, f["id"], f["name"]):
                ok += 1
            else:
                erros += 1

        if i % 50 == 0:
            print(f"  {i}/{len(ads_folders)} pastas processadas...")

    print(f"\nConcluído. {ok} arquivos tornados públicos. {erros} erros.")
    print("As URLs de thumbnail agora funcionam sem autenticação.")

if __name__ == "__main__":
    main()
