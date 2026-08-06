"""
Tracker FMN — Lançar nova Ideia via Supabase REST API.

Grava direto na tabela `ideias` (aba Ideias do Tracker), coluna "Ideia".
De lá, o Felipe decide se converte pra ADS ou pra Orgânico pelo botão da
própria tela. Formatos aceitos: Reels, Carrossel, Imagem, Stories, Artigo,
Youtube.

REGRA: uma ideia por plataforma. Quando o mesmo assunto vira artigo, imagem
e carrossel, são três cards, cada um com título e descrição escritos para
aquele formato. O script recusa mais de um formato por card, salvo com
--permitir-multi-formato.

Uso:
  python3 scripts/tracker-lancar-ideia.py \
    --titulo "A juíza disse qual papel faltava, e era o contrato" \
    --formatos "Artigo" \
    --destino Orgânico \
    --descricao "texto completo, escrito para artigo..." \
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
    if len(formatos) > 1 and not args.permitir_multi_formato:
        sys.exit(
            "Uma ideia por plataforma. Foram passados {n} formatos ({fmts}).\n"
            "Rode o script uma vez por formato, com título e descrição próprios de cada um.\n"
            "Se for mesmo o caso raro de um card único cobrindo vários formatos, "
            "use --permitir-multi-formato.".format(n=len(formatos), fmts=", ".join(formatos))
        )
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
    parser.add_argument("--formatos", required=True,
                        help="Um formato por ideia. Ex: 'Artigo'. Ver --permitir-multi-formato")
    parser.add_argument("--permitir-multi-formato", action="store_true",
                        dest="permitir_multi_formato",
                        help="Exceção. Permite mais de um formato no mesmo card")
    parser.add_argument("--destino", default="Orgânico", choices=["Anúncio", "Orgânico"])
    parser.add_argument("--descricao", default="")
    parser.add_argument("--referencia", default="", help="URL de referência (fonte da notícia/decisão)")
    args = parser.parse_args()
    lancar(args)
