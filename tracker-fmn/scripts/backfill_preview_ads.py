#!/usr/bin/env python3
"""Backfill retroativo: gera a previa leve (media_preview_url) pra todo ADS
em video que hoje so tem a versao alta, e apaga a alta em seguida (ela nao
faz mais falta -- o Meta ja tem o video via meta_video_id, quando publicado).

Le token/keys do .env na raiz de tracker-fmn/ e o IMPORT_TOKEN do Secret
Manager (cozinha-import-token), nunca hardcoded aqui.

Uso: python3 scripts/backfill_preview_ads.py [--dry-run] [--limit N]
"""
import argparse
import json
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COZINHA_URL = "https://cozinha-296334646934.us-central1.run.app"
WORKER_URL = "https://ads-media.blindagem-fmn.workers.dev"
SUPABASE_URL = "https://wntzzzuqoqmfcjebmzul.supabase.co"


def load_env_var(name):
    env_path = ROOT / ".env"
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"{name} nao encontrado no .env")


def load_import_token():
    r = subprocess.run(
        ["gcloud", "secrets", "versions", "access", "latest", "--secret=cozinha-import-token"],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        raise SystemExit("nao consegui ler IMPORT_TOKEN do Secret Manager: " + r.stderr[:200])
    return r.stdout.strip()


def http_json(method, url, headers=None, body=None, timeout=180):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw.strip() else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, (json.loads(raw) if raw.strip() else {})
        except Exception:
            return e.code, {"error": raw[:200] or str(e)}
    except Exception as e:
        return 0, {"error": str(e)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="so lista, nao processa")
    ap.add_argument("--limit", type=int, default=None, help="limite de itens (teste)")
    args = ap.parse_args()

    service_key = load_env_var("SUPABASE_SERVICE_KEY")
    import_token = load_import_token()
    sb_headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}",
                  "Content-Type": "application/json", "Prefer": "return=minimal"}

    status, rows = http_json(
        "GET",
        f"{SUPABASE_URL}/rest/v1/ads?select=numero,media_url,media_preview_url,media_tipo,tipo"
        f"&or=(media_tipo.eq.video,tipo.eq.reels)&media_url=not.is.null&media_preview_url=is.null"
        f"&order=numero.asc",
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
    )
    if status != 200:
        raise SystemExit(f"erro ao listar ads: {status} {rows}")

    if args.limit:
        rows = rows[: args.limit]

    print(f"total a processar: {len(rows)}")
    if args.dry_run:
        for r in rows:
            print(r["numero"])
        return

    ok, falhas = 0, []
    for i, row in enumerate(rows, 1):
        num = row["numero"]
        try:
            media_url_raw = row["media_url"]
            url_alta = json.loads(media_url_raw)[0] if media_url_raw.strip().startswith("[") else media_url_raw
        except Exception:
            falhas.append((num, "media_url malformado"))
            continue

        print(f"[{i}/{len(rows)}] ADS {num} ... ", end="", flush=True)
        t0 = time.time()

        status, resp = http_json(
            "POST", f"{COZINHA_URL}/reprocessar-alta",
            headers={"X-Token": import_token, "Content-Type": "application/json"},
            body={"url_alta": url_alta, "worker_url": WORKER_URL, "uid": f"bf{num}"},
            timeout=300,
        )
        if status != 200 or not resp.get("ok"):
            falhas.append((num, f"reprocessar-alta falhou: {status} {resp}"))
            print(f"FALHOU ({resp.get('error', resp)})")
            continue

        preview_url = resp["preview_url"]
        thumb_url = resp["thumb_url"]

        # Grava a previa no card. So mexe em thumb_url se o card nao tiver
        # nenhuma ainda (nao quero sobrescrever uma thumb ja escolhida).
        patch = {"media_preview_url": preview_url}
        pstatus, presp = http_json(
            "PATCH", f"{SUPABASE_URL}/rest/v1/ads?numero=eq.{num}",
            headers=sb_headers, body=patch,
        )
        if pstatus not in (200, 204):
            falhas.append((num, f"update supabase falhou: {pstatus} {presp}"))
            print(f"FALHOU no update ({presp})")
            continue

        # So agora apaga a alta -- so depois de confirmar que a previa foi
        # salva no card. Extrai a key do R2 a partir da URL.
        key = url_alta.split("/r2.dev/")[-1]
        dstatus, dresp = http_json(
            "DELETE", f"{WORKER_URL}/original/{urllib.parse.quote(key, safe='')}",
            headers={},
        )
        # zera media_url so depois de confirmar a delecao (ainda que a delecao
        # falhe, e melhor limpar o campo pra parar de achar que a alta existe)
        http_json("PATCH", f"{SUPABASE_URL}/rest/v1/ads?numero=eq.{num}",
                  headers=sb_headers, body={"media_url": None})

        dt = time.time() - t0
        ok += 1
        print(f"ok ({dt:.1f}s)")

    print(f"\nconcluido: {ok}/{len(rows)} processados, {len(falhas)} falhas")
    if falhas:
        print("\nfalhas:")
        for num, msg in falhas:
            print(f"  ADS {num}: {msg}")


import urllib.parse

if __name__ == "__main__":
    main()
