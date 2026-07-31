"""
Tracker FMN — Lançar nova Ideia via Supabase REST API.

Grava direto na tabela `ideias` (aba Ideias do Tracker), coluna "Ideia".
De lá, o Felipe decide se converte pra ADS ou pra Orgânico pelo botão da
própria tela. --formatos aceita qualquer combinação de: Reels, Carrossel,
Imagem, Stories, Artigo, Youtube (separados por vírgula).

Uso:
  python3 scripts/tracker-lancar-ideia.py \
    --titulo "A juíza disse qual papel faltava, e era o contrato" \
    --formatos "Artigo,Carrossel" \
    --destino Orgânico \
    --descricao "texto completo..." \
    --referencia "https://www.conjur.com.br/..."
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path


def _load_env():
    env_path = Path(__file__).resolve().parent.parent / "tracker-fmn" / ".env"
    if not env_path.exists():
        sys.exit(f"Arquivo .env não encontrado em: {env_path}")
    values = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip('"').strip("'")
    url = values.get("SUPABASE_URL")
    key = values.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL ou SUPABASE_SERVICE_KEY ausentes no .env do tracker-fmn.")
    return url, key


def lancar(args):
    url, key = _load_env()
    formatos = [f.strip() for f in args.formatos.split(",") if f.strip()]
    payload = {
        "title": args.titulo,
        "status": "Ideia",
        "formats": formatos,
        "description": args.descricao or "",
        "destino": args.destino,
    }
    if args.referencia:
        payload["ref_type"] = "url"
        payload["ref_value"] = args.referencia

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(f"{url}/rest/v1/ideias", data=body, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            print(f"OK | Ideia lançada no Tracker FMN")
            print(f"ID: {result[0]['id']}")
            print(f"Título: {result[0]['title']}")
            print(f"Formatos: {', '.join(result[0]['formats'])}")
            print(f"Destino: {result[0]['destino']}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Erro ao inserir Ideia: {e.code} {e.read().decode()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Lança uma nova Ideia no Tracker FMN.")
    parser.add_argument("--titulo", required=True)
    parser.add_argument("--formatos", required=True, help="Ex: 'Artigo,Carrossel'")
    parser.add_argument("--destino", default="Orgânico", choices=["Anúncio", "Orgânico"])
    parser.add_argument("--descricao", default="")
    parser.add_argument("--referencia", default="", help="URL de referência (fonte da notícia/decisão)")
    args = parser.parse_args()
    lancar(args)
