#!/usr/bin/env python3
"""
Aplica as regras do REGRAS-KANBAN.md em todos os ADs do Supabase.

O que faz:
  - fazer   + tem mídia no Drive  → move para "fazendo"
  - campeoes que não atendem mais → move para "arquivado" com tag recalculada
  - campeoes sem tag correta      → corrige tag para "Ótimo"
  - testar-novamente inválido     → move para "arquivado" com tag recalculada
  - testar-novamente sem tag      → corrige tag
  - arquivado                     → recalcula tag

Updates são enviados em lote (uma chamada por combinação status+tag),
reduzindo N chamadas individuais a poucos requests.

Uso: python3 scripts/aplicar_regras.py [--dry-run]
"""

import os, json, argparse, urllib.request, urllib.error
from collections import defaultdict
from pathlib import Path

# ── Carregar .env ──────────────────────────────────────────────────────────────
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

SUPABASE_URL         = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

# ── Constantes (espelho de kanban.jsx) ────────────────────────────────────────
TICKET_VAL     = 297.00
GASTO_MIN_TEST = 145.53   # 70% do CPA limite

def classify_ad(vendas, cpa, gasto):
    v = vendas or 0
    g = gasto  or 0
    c = cpa if cpa is not None else (g / v if v > 0 and g > 0 else None)
    if v == 0:
        return "Testar novamente" if g >= GASTO_MIN_TEST else "Ruim"
    if v >= 5 and (c is None or c < TICKET_VAL):
        return "Ótimo"
    return "Mediano"

# ── Supabase helpers ──────────────────────────────────────────────────────────
def supa_request(path, method="GET", body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    headers = {
        "apikey":        SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    }
    data = json.dumps(body).encode() if body else None
    req  = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        print(f"  Erro {e.code}: {e.read().decode()}")
        return None

def fetch_all_ads():
    fields = "numero,status,tag,vendas_total,cpa_historico,gasto_total,media_files,media_drive_url"
    return supa_request(f"ads?select={fields}&order=numero.asc&limit=1000") or []

def batch_patch(numeros, payload, dry_run):
    """Atualiza múltiplos ADs com o mesmo payload numa única chamada."""
    ids = ",".join(str(n) for n in numeros)
    desc = ", ".join(f"{k}={v}" for k, v in payload.items())
    print(f"  Lote {len(numeros)} ADs [{ids[:60]}{'…' if len(ids)>60 else ''}] → {desc}")
    if not dry_run:
        supa_request(f"ads?numero=in.({ids})", method="PATCH", body=payload)

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("Buscando todos os ADs...")
    ads = fetch_all_ads()
    print(f"  {len(ads)} ADs carregados.\n")

    # Acumula {(status, tag): [numeros]} para enviar em lote
    batches = defaultdict(list)

    for ad in ads:
        num    = ad["numero"]
        status = ad.get("status") or "fazer"
        tag    = ad.get("tag")
        vendas = ad.get("vendas_total")
        cpa    = ad.get("cpa_historico")
        gasto  = ad.get("gasto_total")

        # Detecta se tem mídia vinculada
        has_media = False
        try:
            mf = ad.get("media_files") or "[]"
            files = mf if isinstance(mf, list) else json.loads(mf)
            has_media = len(files) > 0 or bool(ad.get("media_drive_url"))
        except Exception:
            has_media = bool(ad.get("media_drive_url"))

        # Regra 1: fazer + mídia → fazendo
        if status == "fazer" and has_media:
            batches[("fazendo", None)].append(num)

        # Regra 2: campeoes → valida se ainda merece estar lá
        elif status == "campeoes":
            nova_tag = classify_ad(vendas, cpa, gasto)
            if nova_tag != "Ótimo":
                batches[("arquivado", nova_tag)].append(num)
            elif tag != "Ótimo":
                batches[("campeoes", "Ótimo")].append(num)

        # Regra 3: testar-novamente → valida se ainda faz sentido
        elif status == "testar-novamente":
            nova_tag = classify_ad(vendas, cpa, gasto)
            if nova_tag != "Testar novamente":
                batches[("arquivado", nova_tag)].append(num)
            elif tag != "Testar novamente":
                batches[("testar-novamente", "Testar novamente")].append(num)

        # Regra 4: arquivado → recalcular tag
        elif status == "arquivado":
            nova_tag = classify_ad(vendas, cpa, gasto)
            if nova_tag != tag:
                batches[("arquivado", nova_tag)].append(num)

    if not batches:
        print("Nenhuma alteração necessária.")
        return

    alterados = 0
    for (novo_status, nova_tag), numeros in batches.items():
        payload = {"status": novo_status}
        if nova_tag is not None:
            payload["tag"] = nova_tag
        # Para lotes de status igual ao atual (só muda tag), não repetir status
        if novo_status in ("campeoes", "testar-novamente", "arquivado"):
            # Só inclui status se for mudança real (ex: campeoes→arquivado)
            # Detectado pelo par de chave. Para correção só de tag, remove status.
            sample_status = novo_status
            # Se todos os ADs já estão nesse status (correção de tag),
            # o PATCH com status=mesmo_valor é inócuo mas aceitável.
        batch_patch(numeros, payload, args.dry_run)
        alterados += len(numeros)

    prefixo = "[dry-run] " if args.dry_run else ""
    print(f"\n{prefixo}Concluído: {alterados} AD(s) atualizados em {len(batches)} lote(s).")

if __name__ == "__main__":
    main()
