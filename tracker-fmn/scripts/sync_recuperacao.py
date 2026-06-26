#!/usr/bin/env python3
"""
Busca na Hotmart os leads recuperáveis (interesse demonstrado, mas compra não aprovada)
e grava em recuperacao_vendas: cartão sem limite, boleto/pix expirado, aguardando
pagamento, cancelado, checkout iniciado. Só entram leads com e-mail ou telefone.

Uso: python3 scripts/sync_recuperacao.py [--days 60]
"""
import os, sys, json, base64, argparse, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime, timezone, timedelta

def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        c = cur / ".env"
        if c.exists():
            for line in c.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and "=" in line and not line.startswith("#"):
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            return
        cur = cur.parent

load_env()
HOTMART_CLIENT_ID     = os.environ.get("HOTMART_CLIENT_ID", "")
HOTMART_CLIENT_SECRET = os.environ.get("HOTMART_CLIENT_SECRET", "")
SUPABASE_URL          = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not all([HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    sys.exit("Erro: HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY no .env")

# Status Hotmart que representam leads recuperáveis (interesse, sem aprovação)
RECUPERAVEL = {
    "NO_FUNDS":        "Cartão sem limite",
    "EXPIRED":         "Boleto/Pix expirado",
    "WAITING_PAYMENT": "Aguardando pagamento",
    "PRINTED_BILLET":  "Boleto gerado, não pago",
    "OVERDUE":         "Pagamento atrasado",
    "CANCELLED":       "Cancelado",
    "CANCELED":        "Cancelado",
    "BLOCKED":         "Bloqueado",
    "UNDER_ANALYSIS":  "Em análise",
    "STARTED":         "Checkout iniciado",
}

def get_token():
    basic = base64.b64encode(f"{HOTMART_CLIENT_ID}:{HOTMART_CLIENT_SECRET}".encode()).decode()
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req = urllib.request.Request(
        "https://api-sec-vlc.hotmart.com/security/oauth/token", data=data,
        headers={"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["access_token"]

def fetch_sales(token, start, end, status=None):
    start_ms, end_ms = int(start.timestamp()*1000), int(end.timestamp()*1000)
    sales, page_token = [], None
    while True:
        params = {"start_date": start_ms, "end_date": end_ms, "max_results": 500}
        if status:
            params["transaction_status"] = status
        if page_token:
            params["page_token"] = page_token
        url = "https://developers.hotmart.com/payments/api/v1/sales/history?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as r:
                body = json.loads(r.read())
        except urllib.error.HTTPError as e:
            print(f"  Erro Hotmart {e.code}: {e.read().decode()[:200]}", file=sys.stderr)
            break
        items = body.get("items", [])
        sales.extend(items)
        page_token = body.get("page_info", {}).get("next_page_token")
        if not page_token or not items:
            break
    return sales

def map_lead(item):
    purchase = item.get("purchase", {})
    product  = item.get("product", {})
    buyer    = item.get("buyer", {})
    raw      = (purchase.get("status", "") or "").upper()
    if raw not in RECUPERAVEL:
        return None
    email = buyer.get("email")
    tel   = buyer.get("phone") or buyer.get("checkout_phone")
    if not email and not tel:
        return None  # sem forma de contato, não serve para recuperação
    order_ms = purchase.get("order_date")
    created = datetime.fromtimestamp(order_ms/1000, tz=timezone.utc).isoformat() if order_ms else datetime.now(timezone.utc).isoformat()
    return {
        "hotmart_id":   purchase.get("transaction", ""),
        "nome":         buyer.get("name", ""),
        "email":        email,
        "telefone":     tel,
        "produto_nome": product.get("name", ""),
        "valor":        purchase.get("price", {}).get("value", 0.0),
        "status":       RECUPERAVEL[raw],
        "created_at":   created,
    }

def upsert(rows):
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/recuperacao_vendas?on_conflict=hotmart_id"
    req = urllib.request.Request(url, data=json.dumps(rows).encode(), method="POST",
        headers={"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                 "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})
    with urllib.request.urlopen(req) as r:
        return r.status

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=60)
    args = ap.parse_args()

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=args.days)
    print(f"Buscando leads recuperáveis de {start.date()} até {end.date()}...")

    token = get_token()
    # busca cada status recuperável explicitamente (o default só traz aprovadas)
    sales = []
    for st in sorted(set(RECUPERAVEL.keys())):
        chunk = fetch_sales(token, start, end, status=st)
        if chunk:
            print(f"  {st}: {len(chunk)} transações")
        sales.extend(chunk)
    print(f"  {len(sales)} transações recuperáveis no período.")

    leads = [m for m in (map_lead(s) for s in sales) if m]
    # dedup por hotmart_id
    seen, unicos = set(), []
    for l in leads:
        if l["hotmart_id"] in seen:
            continue
        seen.add(l["hotmart_id"]); unicos.append(l)

    print(f"  {len(unicos)} leads recuperáveis com contato.")
    if unicos:
        for i in range(0, len(unicos), 100):
            upsert(unicos[i:i+100])
        from collections import Counter
        por_status = Counter(l["status"] for l in unicos)
        for s, n in por_status.most_common():
            print(f"    {s}: {n}")
    print("Concluído.")

if __name__ == "__main__":
    main()
