#!/usr/bin/env python3
"""
Backfill comprador_telefone em vendas aprovadas que estão sem telefone.
Usa a API do Hotmart para buscar o telefone por hotmart_transaction_id.
"""

import os
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

# ── Credenciais ────────────────────────────────────────────────────────────────
def _load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            env = {}
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
            return env
        cur = cur.parent
    raise SystemExit(".env não encontrado")

ENV             = _load_env()
HOTMART_CID     = ENV["HOTMART_CLIENT_ID"]
HOTMART_SECRET  = ENV["HOTMART_CLIENT_SECRET"]
SUPABASE_URL    = ENV["SUPABASE_URL"]
SUPABASE_KEY    = ENV["SUPABASE_SERVICE_KEY"]

HOTMART_API     = "https://developers.hotmart.com"
HOTMART_AUTH    = "https://api-sec-vlc.hotmart.com"

# ── Hotmart OAuth ──────────────────────────────────────────────────────────────
def hotmart_token():
    import base64
    url  = f"{HOTMART_AUTH}/security/oauth/token"
    body = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    creds = base64.b64encode(f"{HOTMART_CID}:{HOTMART_SECRET}".encode()).decode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type":  "application/x-www-form-urlencoded",
        "Authorization": f"Basic {creds}",
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())["access_token"]

# ── Busca detalhes de compradores da transação ─────────────────────────────────
def buscar_telefone_hotmart(token, transaction_id):
    """Retorna telefone do comprador via API de usuários da venda."""
    url = f"{HOTMART_API}/payments/api/v1/sales/users?transaction={transaction_id}"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read())
        # Tenta buyer dentro de items[0]
        items = data.get("items") or []
        for item in items:
            buyer = item.get("buyer") or {}
            phone = (
                buyer.get("checkout_phone")
                or buyer.get("phone")
                or buyer.get("mobile_phone")
            )
            if phone:
                return str(phone).strip()
        return None
    except Exception as e:
        print(f"    API erro para {transaction_id}: {e}")
        return None

# ── Supabase helpers ───────────────────────────────────────────────────────────
def sb_get(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}", headers={
        "apikey":        SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
    })
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())

def sb_patch(path, data):
    body = json.dumps(data).encode()
    req  = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/{path}",
        data=body, method="PATCH",
        headers={
            "apikey":        SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "return=minimal",
        }
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return r.status

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("Buscando vendas aprovadas sem telefone...")
    rows = sb_get(
        "vendas?status=eq.aprovada"
        "&comprador_telefone=is.null"
        "&hotmart_transaction_id=not.is.null"
        "&select=id,comprador_nome,hotmart_transaction_id"
        "&order=created_at.desc"
        "&limit=200"
    )
    print(f"  {len(rows)} vendas sem telefone encontradas.\n")
    if not rows:
        print("Nada para backfill.")
        return

    token  = hotmart_token()
    ok     = 0
    sem    = 0
    erros  = 0

    for row in rows:
        tid   = row["hotmart_transaction_id"]
        nome  = row.get("comprador_nome") or "?"
        print(f"  [{tid}] {nome[:30]:<30} ", end="", flush=True)

        phone = buscar_telefone_hotmart(token, tid)
        if phone:
            try:
                sb_patch(f"vendas?id=eq.{row['id']}", {"comprador_telefone": phone})
                print(f"✅ {phone}")
                ok += 1
            except Exception as e:
                print(f"❌ erro ao salvar: {e}")
                erros += 1
        else:
            print("— sem telefone na API")
            sem += 1

        time.sleep(0.3)  # respeita rate limit do Hotmart

    print(f"\nConcluído: {ok} atualizados | {sem} sem telefone | {erros} erros")

if __name__ == "__main__":
    main()
