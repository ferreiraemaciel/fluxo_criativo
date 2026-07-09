"""
Tracker FMN — Lançar novo AD via Supabase REST API.

Reels e Imagem usam --roteiro e --estetica-visual (estrutura aprovada
2026-07-09, ver tracker-fmn/CAMPOS-COPY-CRIATIVOS.md). --hook-visual,
--hook-copy e --desenvolvimento-cta só devem ser usados pra Carrossel, que
ainda não migrou. Texto Principal é só a copy do Meta (o texto que aparece
no post) — nunca o roteiro/script completo do vídeo, isso vai em --roteiro.

Uso (Reels/Imagem):
  python3 scripts/tracker-lancar-ad.py \
    --titulo "1.000 fotógrafos protegidos no Brasil" \
    --tipo reels \
    --headline "1.000 fotógrafos protegidos no Brasil." \
    --roteiro "Hook: ...\n\nDesenvolvimento: ...\n\nCTA: ..." \
    --estetica-visual "Placar de estádio à noite com câmera no primeiro plano" \
    --texto-principal "Mais de 1.000 fotógrafos fechando trabalhos com contrato assinado." \
    --titulo-ad "1.000 fotógrafos protegidos" \
    --descricao-ad "Esse é o placar de quem parou de jogar sem árbitro." \
    --posicionamento "Feed Instagram 1080x1350" \
    --observacoes "Copa/Futebol #9. Prova. Gerado via criativo-estatico."

Uso (Carrossel, ainda com os campos antigos):
  python3 scripts/tracker-lancar-ad.py \
    --titulo "..." --tipo carrossel \
    --headline "..." --hook-visual "..." --hook-copy "..." \
    --desenvolvimento-cta "..." --texto-principal "..." \
    --titulo-ad "..." --descricao-ad "..."
"""

import argparse
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path


def _load_env():
    """Carrega SUPABASE_URL e SUPABASE_SERVICE_KEY do .env do tracker-fmn."""
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


def _proximo_numero(url, key):
    """Busca o maior número de AD existente e retorna o próximo."""
    endpoint = f"{url}/rest/v1/ads?select=numero&order=numero.desc&limit=1"
    req = urllib.request.Request(endpoint, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            if data:
                return data[0]["numero"] + 1
            return 1
    except urllib.error.HTTPError as e:
        sys.exit(f"Erro ao consultar último número: {e.code} {e.read().decode()}")


def _build_payload(args, incluir_numero=None):
    posicionamento = [p.strip() for p in args.posicionamento.split(",")] if args.posicionamento else []
    payload = {
        "titulo": args.titulo,
        "tipo": args.tipo,
        "headline": args.headline or None,
        "roteiro": args.roteiro or None,
        "estetica_visual": args.estetica_visual or None,
        "hook_visual": args.hook_visual or None,
        "hook_copy": args.hook_copy or None,
        "texto_principal": args.texto_principal or None,
        "desenvolvimento_cta": args.desenvolvimento_cta or None,
        "titulo_ad": args.titulo_ad or None,
        "descricao_ad": args.descricao_ad or None,
        "posicionamento": posicionamento or None,
        "observacoes": args.observacoes or None,
    }
    if incluir_numero:
        payload["numero"] = incluir_numero
        payload["status"] = "fazer"
    return {k: v for k, v in payload.items() if v is not None}


def lancar(args):
    url, key = _load_env()
    numero = _proximo_numero(url, key)
    payload = _build_payload(args, incluir_numero=numero)
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(f"{url}/rest/v1/ads", data=body, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            print(f"OK | AD #{numero} lançado no Tracker FMN")
            print(f"ID: {result[0]['id']}")
            print(f"Título: {result[0]['titulo']}")
            print(f"Status: {result[0]['status']}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Erro ao inserir AD: {e.code} {e.read().decode()}")


def atualizar(args):
    url, key = _load_env()
    payload = _build_payload(args)
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(f"{url}/rest/v1/ads?numero=eq.{args.numero}", data=body, headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }, method="PATCH")
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            if not result:
                sys.exit(f"AD #{args.numero} não encontrado.")
            print(f"OK | AD #{result[0]['numero']} atualizado no Tracker FMN")
            print(f"Título: {result[0]['titulo']}")
    except urllib.error.HTTPError as e:
        sys.exit(f"Erro ao atualizar AD: {e.code} {e.read().decode()}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Lança ou atualiza AD no Tracker FMN.")
    parser.add_argument("--numero", type=int, help="Número do AD para atualizar (omitir para criar novo)")
    parser.add_argument("--titulo", required=True)
    parser.add_argument("--tipo", default="imagem", choices=["reels", "imagem", "carrossel"])
    parser.add_argument("--headline", default="")
    parser.add_argument("--roteiro", default="")
    parser.add_argument("--estetica-visual", default="", dest="estetica_visual")
    parser.add_argument("--hook-visual", default="", dest="hook_visual")
    parser.add_argument("--hook-copy", default="", dest="hook_copy")
    parser.add_argument("--texto-principal", default="", dest="texto_principal")
    parser.add_argument("--desenvolvimento-cta", default="", dest="desenvolvimento_cta")
    parser.add_argument("--titulo-ad", default="", dest="titulo_ad")
    parser.add_argument("--descricao-ad", default="", dest="descricao_ad")
    parser.add_argument("--posicionamento", default="Feed Instagram 1080x1350")
    parser.add_argument("--observacoes", default="")
    args = parser.parse_args()
    if args.numero:
        atualizar(args)
    else:
        lancar(args)
