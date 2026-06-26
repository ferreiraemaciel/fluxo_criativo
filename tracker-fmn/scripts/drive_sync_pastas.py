#!/usr/bin/env python3
"""
Cria no Drive uma pasta para cada AD do Supabase que ainda não tem pasta correspondente.
Idempotente: roda quantas vezes quiser, só cria o que falta. Cada pasta nova já nasce pública.

Convenção de nome: "ADS {numero:03d} - {titulo curto}" (casa com o ADS_PATTERN do sync_drive.py).

Uso: python3 scripts/drive_sync_pastas.py
Pensado para rodar no sync_runner.py junto com os demais scripts de Drive.
"""
import os, re, json, urllib.request
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

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
FOLDER_NAME  = os.environ.get("GOOGLE_DRIVE_TRACKER_FOLDER", "Criativos")

_root  = Path(__file__).resolve().parent.parent
_creds = _root / os.environ.get("GOOGLE_CREDENTIALS_PATH", "google-credentials.json")

from google.oauth2 import service_account
from googleapiclient.discovery import build

service = build("drive", "v3",
    credentials=service_account.Credentials.from_service_account_file(
        str(_creds), scopes=["https://www.googleapis.com/auth/drive"]
    ), cache_discovery=False)

ADS_PATTERN = re.compile(r"^ADS\s+(\d+)", re.IGNORECASE)

def fetch_supabase(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def find_criativos_folder():
    resp = service.files().list(
        q=f"name='{FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields="files(id,name)",
    ).execute()
    folders = resp.get("files", [])
    if not folders:
        raise SystemExit(f"Pasta '{FOLDER_NAME}' não encontrada no Drive.")
    return folders[0]["id"]

def list_existing_numbers(parent_id):
    nums = set()
    page_token = None
    while True:
        params = dict(
            q=f"'{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="nextPageToken,files(id,name)", pageSize=500,
        )
        if page_token:
            params["pageToken"] = page_token
        resp = service.files().list(**params).execute()
        for f in resp.get("files", []):
            m = ADS_PATTERN.match(f["name"])
            if m:
                nums.add(int(m.group(1)))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return nums

def slug_titulo(titulo, numero):
    """Remove o prefixo 'ADS XXX -' do título e limita o tamanho."""
    t = re.sub(r"^ADS\s+\d+\s*[-–]\s*", "", titulo or "", flags=re.IGNORECASE).strip()
    t = re.sub(r"[\\/:*?\"<>|]", "", t)  # caracteres inválidos em nome
    return t[:60].strip()

def make_public(file_id):
    try:
        service.permissions().create(
            fileId=file_id, body={"role": "reader", "type": "anyone"}, fields="id",
        ).execute()
    except Exception as e:
        print(f"    Aviso: não consegui tornar público: {e}")

def main():
    print("Lendo ADs do Supabase...")
    ads = fetch_supabase("ads?select=numero,titulo&order=numero.asc&limit=2000")
    print(f"  {len(ads)} ADs cadastrados.")

    print(f"Buscando pasta '{FOLDER_NAME}' no Drive...")
    criativos_id = find_criativos_folder()
    existing = list_existing_numbers(criativos_id)
    print(f"  {len(existing)} pastas ADS já existem no Drive.")

    faltando = [a for a in ads if a["numero"] not in existing]
    print(f"  {len(faltando)} ADs sem pasta. Criando...")

    criadas = 0
    for a in faltando:
        numero = a["numero"]
        titulo = slug_titulo(a.get("titulo", ""), numero)
        nome = f"ADS {numero:03d}" + (f" - {titulo}" if titulo else "")
        meta = {"name": nome, "mimeType": "application/vnd.google-apps.folder", "parents": [criativos_id]}
        f = service.files().create(body=meta, fields="id,name").execute()
        make_public(f["id"])
        criadas += 1
        print(f"  Criada: {f['name']}")

    print(f"\nConcluído. {criadas} pastas criadas, {len(existing)} já existiam.")

if __name__ == "__main__":
    main()
