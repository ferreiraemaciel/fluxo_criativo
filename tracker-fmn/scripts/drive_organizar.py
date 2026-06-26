#!/usr/bin/env python3
"""
Move arquivos soltos na pasta Criativos para suas subpastas ADS XXX.
Detecta o número do AD pelo nome do arquivo (ex: "ADS 303 - Título.mp4" → pasta ADS 303).
Uso: python3 scripts/drive_organizar.py [--dry-run]
"""
import os, sys, re, json, argparse
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

import warnings
warnings.filterwarnings("ignore")

_root  = Path(__file__).resolve().parent.parent
_creds = _root / os.environ.get("GOOGLE_CREDENTIALS_PATH", "google-credentials.json")

from google.oauth2 import service_account
from googleapiclient.discovery import build

service = build("drive", "v3",
    credentials=service_account.Credentials.from_service_account_file(
        str(_creds), scopes=["https://www.googleapis.com/auth/drive"]
    ), cache_discovery=False)

CRIATIVOS_ID = "1jskuzz85CD-OCDj-ckA4jCRhwgoUVT7J"
ADS_PATTERN  = re.compile(r"ADS\s*(\d+)", re.IGNORECASE)

def listar_tudo(folder_id, so_arquivos=True):
    """Lista arquivos ou pastas diretamente dentro de folder_id."""
    items, page_token = [], None
    tipo_filtro = "mimeType != 'application/vnd.google-apps.folder'" if so_arquivos \
                  else "mimeType = 'application/vnd.google-apps.folder'"
    while True:
        resp = service.files().list(
            q=f"'{folder_id}' in parents and {tipo_filtro} and trashed=false",
            fields="nextPageToken, files(id, name, mimeType)",
            pageSize=500,
            **({"pageToken": page_token} if page_token else {})
        ).execute()
        items.extend(resp.get("files", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    return items

def mover(file_id, dest_folder_id, file_name, origem_id, dry_run):
    if dry_run:
        return
    service.files().update(
        fileId=file_id,
        addParents=dest_folder_id,
        removeParents=origem_id,
        fields="id, parents"
    ).execute()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Carregando subpastas ADS em Criativos...")
    subpastas = listar_tudo(CRIATIVOS_ID, so_arquivos=False)
    # Mapeia número → folder_id
    pasta_map = {}
    for p in subpastas:
        m = ADS_PATTERN.match(p["name"])
        if m:
            pasta_map[int(m.group(1))] = p["id"]
    print(f"  {len(pasta_map)} pastas ADS encontradas.")

    print("\nListando arquivos soltos em Criativos...")
    arquivos = listar_tudo(CRIATIVOS_ID, so_arquivos=True)
    print(f"  {len(arquivos)} arquivo(s) solto(s) encontrado(s).")

    if not arquivos:
        print("Nenhum arquivo solto. Tudo já está organizado.")
        return

    movidos, sem_pasta, sem_numero = 0, 0, 0

    for arq in arquivos:
        nome = arq["name"]
        m = ADS_PATTERN.search(nome)
        if not m:
            print(f"  [sem número] {nome}")
            sem_numero += 1
            continue

        num = int(m.group(1))
        if num not in pasta_map:
            print(f"  [sem pasta]  ADS {num:03d} — {nome}")
            sem_pasta += 1
            continue

        dest_id = pasta_map[num]
        prefixo = "[dry-run] " if args.dry_run else ""
        print(f"  {prefixo}ADS {num:03d} ← {nome}")
        mover(arq["id"], dest_id, nome, CRIATIVOS_ID, args.dry_run)
        movidos += 1

    print(f"\n{'[dry-run] ' if args.dry_run else ''}Concluído.")
    print(f"  Movidos:      {movidos}")
    if sem_pasta:
        print(f"  Sem pasta:    {sem_pasta}  (pasta ADS não encontrada — crie a pasta primeiro)")
    if sem_numero:
        print(f"  Sem número:   {sem_numero}  (nome não começa com ADS XXX — ignorados)")

if __name__ == "__main__":
    main()
