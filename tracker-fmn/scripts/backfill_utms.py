#!/usr/bin/env python3
"""
Backfill UTMs históricos: lê source_sck da Hotmart e popula
utm_source, utm_medium, utm_campaign, utm_content, utm_term, meta_ad_id
na tabela vendas do Supabase.

Uso: python3 scripts/backfill_utms.py [--days 1825]
"""

import os, sys, json, argparse, urllib.request, urllib.parse, base64
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ── .env ────────────────────────────────────────────────────────────────────

def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        c = cur / ".env"
        if c.exists():
            for line in c.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
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
    sys.exit("Erro: variáveis necessárias não encontradas no .env")

# ── Hotmart OAuth ────────────────────────────────────────────────────────────

def get_token():
    creds = base64.b64encode(f"{HOTMART_CLIENT_ID}:{HOTMART_CLIENT_SECRET}".encode()).decode()
    req = urllib.request.Request(
        "https://api-sec-vlc.hotmart.com/security/oauth/token",
        data=b"grant_type=client_credentials",
        headers={"Authorization": f"Basic {creds}", "Content-Type": "application/x-www-form-urlencoded"}
    )
    return json.loads(urllib.request.urlopen(req).read())["access_token"]

# ── parse source_sck ─────────────────────────────────────────────────────────

SEP = "hQwK21wXxR"

import re
# O click ID da Hotmart tem o padrão jLj6[a-z0-9]+ (case-insensitive)
_CLICK_ID_RE = re.compile(r'jLj6[a-zA-Z0-9]+', re.IGNORECASE)

def clean_source(raw: str) -> str:
    """Remove o click ID da Hotmart do utm_source."""
    # Remove o click ID e tudo depois dele
    m = _CLICK_ID_RE.search(raw)
    if m:
        raw = raw[:m.start()]
    return raw.lower().strip()

def parse_sck(sck) -> dict:
    if not sck:
        return {}
    parts = sck.split(SEP)
    # Decodifica URL encoding (+ → espaço, %XX → char)
    def dec(s):
        return urllib.parse.unquote_plus(s).strip() if s else None

    raw_source = parts[0] if len(parts) > 0 else ""
    utm_source  = clean_source(raw_source) or None
    utm_medium   = dec(parts[1]) if len(parts) > 1 and parts[1] else None
    utm_campaign = dec(parts[2]) if len(parts) > 2 and parts[2] else None
    utm_content  = dec(parts[3]) if len(parts) > 3 and parts[3] else None
    utm_term     = dec(parts[4]) if len(parts) > 4 and parts[4] else None

    # Para Meta Ads: utm_content vem como "Nome do Anúncio|ad_id"
    meta_ad_id = None
    if utm_content and "|" in utm_content:
        nome_ad, ad_id = utm_content.rsplit("|", 1)
        ad_id = ad_id.strip()
        if ad_id.isdigit() and len(ad_id) > 10:
            meta_ad_id = ad_id
            utm_content = nome_ad.strip()

    # Para Meta Ads: utm_medium também pode ter o formato "Nome|adset_id"
    if utm_medium and "|" in utm_medium:
        utm_medium = utm_medium.split("|")[0].strip()

    if utm_campaign and "|" in utm_campaign:
        utm_campaign = utm_campaign.split("|")[0].strip()

    return {
        "utm_source":   utm_source,
        "utm_medium":   utm_medium,
        "utm_campaign": utm_campaign,
        "utm_content":  utm_content,
        "utm_term":     utm_term,
        "meta_ad_id":   meta_ad_id,
    }

# ── Hotmart: buscar todas as vendas ─────────────────────────────────────────

def fetch_all(token, start_ms, end_ms):
    sales, page_token = [], None
    while True:
        params = {"start_date": start_ms, "end_date": end_ms, "max_results": 500}
        if page_token:
            params["page_token"] = page_token
        url = "https://developers.hotmart.com/payments/api/v1/sales/history?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            body = json.loads(urllib.request.urlopen(req).read())
        except urllib.error.HTTPError as e:
            print(f"  Erro Hotmart {e.code}: {e.read().decode()}", file=sys.stderr)
            break
        items = body.get("items", [])
        sales.extend(items)
        print(f"  {len(items)} registros (total: {len(sales)})")
        page_info = body.get("page_info", {})
        page_token = page_info.get("next_page_token")
        if not page_token or not items:
            break
    return sales

# ── Supabase: update individual ───────────────────────────────────────────────

def update_supabase(transaction_id: str, fields: dict) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/vendas?hotmart_transaction_id=eq.{urllib.parse.quote(transaction_id)}"
    body = json.dumps(fields).encode()
    req = urllib.request.Request(
        url, data=body, method="PATCH",
        headers={
            "apikey":        SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "return=minimal",
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
        return True
    except urllib.error.HTTPError as e:
        print(f"  Supabase erro {e.code} para {transaction_id}: {e.read().decode()}", file=sys.stderr)
        return False

# ── Supabase: batch upsert ────────────────────────────────────────────────────

def batch_upsert(rows: list) -> int:
    url = f"{SUPABASE_URL}/rest/v1/vendas?on_conflict=hotmart_transaction_id"
    body = json.dumps(rows).encode()
    req = urllib.request.Request(
        url, data=body, method="POST",
        headers={
            "apikey":        SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "resolution=merge-duplicates,return=minimal",
        }
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
        return len(rows)
    except urllib.error.HTTPError as e:
        print(f"  Supabase batch erro {e.code}: {e.read().decode()}", file=sys.stderr)
        return 0

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Backfill UTMs históricos Hotmart → Supabase")
    parser.add_argument("--days", type=int, default=1825, help="Dias para trás (padrão: 1825 = ~5 anos)")
    parser.add_argument("--dry-run", action="store_true", help="Apenas mostra o que faria, sem gravar")
    args = parser.parse_args()

    end   = datetime.now(timezone.utc)
    start = end - timedelta(days=args.days)
    print(f"Período: {start.strftime('%Y-%m-%d')} → {end.strftime('%Y-%m-%d')}")

    print("Obtendo token Hotmart...")
    token = get_token()

    print("Buscando histórico completo...")
    sales = fetch_all(token, int(start.timestamp()*1000), int(end.timestamp()*1000))
    print(f"Total: {len(sales)} transações\n")

    updated, skipped, parsed_with_sck = 0, 0, 0

    for item in sales:
        purchase  = item.get("purchase", {})
        tracking  = purchase.get("tracking", {})
        sck       = tracking.get("source_sck") or tracking.get("src") or ""
        txn       = purchase.get("transaction", "")

        if not txn:
            continue

        if not sck:
            skipped += 1
            continue

        utms = parse_sck(sck)
        # Só envia campos que realmente têm valor para não sobrescrever dados existentes com null
        fields = {k: v for k, v in utms.items() if v is not None}
        if not fields:
            skipped += 1
            continue

        parsed_with_sck += 1

        if args.dry_run:
            updated += 1
            continue

        # PATCH: só atualiza registros existentes, nunca insere
        ok = update_supabase(txn, fields)
        if ok:
            updated += 1
        if updated % 50 == 0 and updated > 0:
            print(f"  {updated} atualizados...")

    print(f"\nResumo:")
    print(f"  Transações com source_sck: {parsed_with_sck}")
    print(f"  Sem source_sck (ignoradas): {skipped}")
    print(f"  Registros {'que seriam ' if args.dry_run else ''}atualizados: {updated}")

    # Amostras de diagnóstico
    print("\nAmostra (5 primeiros com sck):")
    count = 0
    for item in sales:
        purchase = item.get("purchase", {})
        tracking = purchase.get("tracking", {})
        sck = tracking.get("source_sck") or ""
        if sck:
            utms = parse_sck(sck)
            print(f"  txn={purchase.get('transaction','?')} → source={utms.get('utm_source')} medium={utms.get('utm_medium')} campaign={utms.get('utm_campaign')} ad_id={utms.get('meta_ad_id')}")
            count += 1
            if count >= 5:
                break

if __name__ == "__main__":
    main()
