"""
Tracker FMN — Importação histórico completo de vendas Hotmart
Roda uma vez só. Usa upsert para não duplicar registros existentes.
"""

import os, sys, requests, time
from pathlib import Path

# ── Carregar .env ─────────────────────────────────────────────────
def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            return
        cur = cur.parent
    sys.exit("❌  .env não encontrado")

load_env()

CLIENT_ID     = os.environ["HOTMART_CLIENT_ID"]
CLIENT_SECRET = os.environ["HOTMART_CLIENT_SECRET"]
SUPABASE_URL  = os.environ["SUPABASE_URL"]
SUPABASE_KEY  = os.environ["SUPABASE_SERVICE_KEY"]

HOTMART_AUTH  = "https://api-sec-vlc.hotmart.com/security/oauth/token"
HOTMART_SALES = "https://developers.hotmart.com/payments/api/v1/sales/history"

SUPABASE_HEADERS = {
    "apikey":        SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type":  "application/json",
    "Prefer":        "resolution=merge-duplicates",
}

# ── Mapeamento de status Hotmart → Tracker ─────────────────────────
STATUS_MAP = {
    "APPROVED":    "aprovada",
    "COMPLETE":    "aprovada",
    "REFUNDED":    "reembolsada",
    "CANCELLED":   "cancelada",
    "CHARGEBACK":  "chargeback",
    "PROTEST":     "protesto",
    "DELAYED":     "pendente",
    "ABANDONED":   "recuperacao",
    "OVERDUE":     "pendente",
    "PRINTED_BILLET": "pendente",
}

def get_token():
    resp = requests.post(
        HOTMART_AUTH,
        params={"grant_type": "client_credentials"},
        auth=(CLIENT_ID, CLIENT_SECRET),
        timeout=30,
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    print("✅  Token Hotmart obtido")
    return token

def fetch_page(token, page_token=None):
    params = {"max_results": 500}
    if page_token:
        params["page_token"] = page_token
    resp = requests.get(
        HOTMART_SALES,
        headers={"Authorization": f"Bearer {token}"},
        params=params,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()

def resolve_ads_numero(meta_ad_id):
    if not meta_ad_id:
        return None
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/ads",
        headers=SUPABASE_HEADERS,
        params={"meta_ad_id": f"eq.{meta_ad_id}", "select": "numero", "limit": 1},
        timeout=15,
    )
    rows = resp.json()
    return rows[0]["numero"] if rows else None

def upsert_batch(rows):
    resp = requests.post(
        f"{SUPABASE_URL}/rest/v1/vendas?on_conflict=hotmart_transaction_id",
        headers=SUPABASE_HEADERS,
        json=rows,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        print(f"⚠️   Erro upsert: {resp.status_code} {resp.text[:200]}")
    return resp.status_code in (200, 201)

def parse_sale(item):
    purchase   = item.get("purchase", {})
    product    = item.get("product", {})
    buyer      = item.get("buyer", {})
    tracking   = purchase.get("tracking", {})

    transaction_id = purchase.get("transaction")
    if not transaction_id:
        return None

    hotmart_status = purchase.get("status", "")
    status = STATUS_MAP.get(hotmart_status.upper(), "pendente")

    utm_content = tracking.get("source_sck") or tracking.get("utm_content") or None
    meta_ad_id  = utm_content

    # Valor: price.value já em BRL (ex: 297 = R$297,00)
    valor_raw = purchase.get("price", {})
    valor_bruto = round(float(valor_raw.get("value", 0)), 2) if valor_raw else 0.0

    comissao = purchase.get("commission", {}).get("as_owner", {})
    valor_liq_raw = comissao.get("total_value", 0)
    valor_liquido = round(float(valor_liq_raw), 2) if valor_liq_raw else valor_bruto

    # Data da aprovação em ms → ISO
    approved_ms = purchase.get("approved_date") or purchase.get("order_date") or 0
    if approved_ms:
        from datetime import datetime, timezone
        created_at = datetime.fromtimestamp(int(approved_ms) / 1000, tz=timezone.utc).isoformat()
    else:
        created_at = None

    metodo = purchase.get("payment", {}).get("type", None)

    return {
        "hotmart_transaction_id": transaction_id,
        "hotmart_event":          f"IMPORT_{hotmart_status}",
        "produto_id":             str(product.get("id", "")),
        "produto_nome":           product.get("name") or None,
        "valor_bruto":            valor_bruto,
        "valor_liquido":          valor_liquido,
        "status":                 status,
        "metodo_pagamento":       metodo.lower() if metodo else None,
        "utm_source":             tracking.get("utm_source") or None,
        "utm_campaign":           tracking.get("utm_campaign") or None,
        "utm_medium":             tracking.get("utm_medium") or None,
        "utm_content":            utm_content,
        "utm_term":               tracking.get("utm_term") or None,
        "meta_ad_id":             meta_ad_id,
        "ads_numero":             None,  # resolvido em lote separado se necessário
        "comprador_pais":         buyer.get("address", {}).get("country") or "BR",
        "comprador_estado":       buyer.get("address", {}).get("state") or None,
        "comprador_cidade":       buyer.get("address", {}).get("city") or None,
        **({"created_at": created_at} if created_at else {}),
    }

def main():
    token = get_token()

    total = 0
    erros = 0
    page_token = None
    pagina = 1

    while True:
        print(f"\n📄  Página {pagina}...", end=" ", flush=True)
        try:
            data = fetch_page(token, page_token)
        except requests.HTTPError as e:
            print(f"❌  Erro HTTP: {e}")
            break

        items = data.get("items", [])
        if not items:
            print("sem mais itens.")
            break

        print(f"{len(items)} vendas encontradas", end=" ", flush=True)

        rows = []
        for item in items:
            parsed = parse_sale(item)
            if parsed:
                rows.append(parsed)

        if rows:
            ok = upsert_batch(rows)
            if ok:
                total += len(rows)
                print(f"→ {total} total inseridas ✅")
            else:
                erros += len(rows)

        # Próxima página
        next_page = data.get("page_info", {}).get("next_page_token")
        if not next_page:
            break
        page_token = next_page
        pagina += 1
        time.sleep(0.5)  # respeitar rate limit

    print(f"\n{'='*50}")
    print(f"✅  Importação concluída: {total} vendas salvas, {erros} erros")
    print(f"{'='*50}")

if __name__ == "__main__":
    main()
