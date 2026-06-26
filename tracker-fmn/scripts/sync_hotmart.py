#!/usr/bin/env python3
"""
Sincroniza vendas da Hotmart com a tabela `vendas` no Supabase.
Uso: python3 scripts/sync_hotmart.py [--days 30]
"""

import os
import sys
import json
import argparse
import re
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime, timezone, timedelta


# ── Carregar .env ────────────────────────────────────────────────────────────

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

HOTMART_CLIENT_ID     = os.environ.get("HOTMART_CLIENT_ID", "")
HOTMART_CLIENT_SECRET = os.environ.get("HOTMART_CLIENT_SECRET", "")
SUPABASE_URL          = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY  = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not all([HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY]):
    sys.exit("Erro: variáveis HOTMART_CLIENT_ID, HOTMART_CLIENT_SECRET, SUPABASE_URL e SUPABASE_SERVICE_KEY precisam estar no .env")


# ── Hotmart OAuth2 ───────────────────────────────────────────────────────────

def get_hotmart_token():
    import base64
    credentials = f"{HOTMART_CLIENT_ID}:{HOTMART_CLIENT_SECRET}"
    basic = base64.b64encode(credentials.encode()).decode()

    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req = urllib.request.Request(
        "https://api-sec-vlc.hotmart.com/security/oauth/token",
        data=data,
        headers={
            "Authorization": f"Basic {basic}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["access_token"]


# ── Hotmart: buscar vendas ───────────────────────────────────────────────────

STATUS_MAP = {
    "APPROVED":   "aprovada",
    "COMPLETE":   "aprovada",
    "REFUNDED":   "reembolsada",
    "CHARGEBACK": "reembolsada",
    "CANCELLED":  "cancelada",
    "CANCELED":   "cancelada",
    "OVERDUE":    "pendente",
    "WAITING_PAYMENT": "pendente",
}

def fetch_hotmart_sales(token, start_date: datetime, end_date: datetime):
    start_ms = int(start_date.timestamp() * 1000)
    end_ms   = int(end_date.timestamp() * 1000)

    sales = []
    page_token = None

    while True:
        params = {
            "start_date": start_ms,
            "end_date":   end_ms,
            "max_results": 500,
        }
        if page_token:
            params["page_token"] = page_token

        url = "https://developers.hotmart.com/payments/api/v1/sales/history?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {token}",
            "Content-Type":  "application/json",
        })

        try:
            with urllib.request.urlopen(req) as resp:
                body = json.loads(resp.read())
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            print(f"  Erro Hotmart {e.code}: {err}", file=sys.stderr)
            break

        items = body.get("items", [])
        sales.extend(items)
        print(f"  Página carregada: {len(items)} vendas (total até agora: {len(sales)})")

        page_info = body.get("page_info", {})
        page_token = page_info.get("next_page_token")
        if not page_token or not items:
            break

    return sales


_SCK_SEP = "hQwK21wXxR"
_CLICK_ID_RE = re.compile(r'jLj6[a-zA-Z0-9]+', re.IGNORECASE)

def _parse_sck(sck: str) -> dict:
    """Extrai utm_source, utm_medium, utm_campaign, utm_content, utm_term e meta_ad_id do source_sck."""
    if not sck:
        return {}
    parts = sck.split(_SCK_SEP)

    def dec(s):
        return urllib.parse.unquote_plus(s).strip() if s else None

    raw_source = parts[0] if parts else ""
    m = _CLICK_ID_RE.search(raw_source)
    utm_source   = raw_source[:m.start()].lower().strip() if m else raw_source.lower().strip()
    utm_medium   = dec(parts[1]) if len(parts) > 1 and parts[1] else None
    utm_campaign = dec(parts[2]) if len(parts) > 2 and parts[2] else None
    utm_content  = dec(parts[3]) if len(parts) > 3 and parts[3] else None
    utm_term     = dec(parts[4]) if len(parts) > 4 and parts[4] else None

    # Meta Ads: "ad_name|ad_id" em utm_content
    meta_ad_id = None
    if utm_content and "|" in utm_content:
        nome_ad, ad_id = utm_content.rsplit("|", 1)
        ad_id = ad_id.strip()
        if ad_id.isdigit() and len(ad_id) > 10:
            meta_ad_id = ad_id
            utm_content = nome_ad.strip()

    # Meta Ads: "adset_name|adset_id" em utm_medium
    if utm_medium and "|" in utm_medium:
        utm_medium = utm_medium.split("|")[0].strip()
    if utm_campaign and "|" in utm_campaign:
        utm_campaign = utm_campaign.split("|")[0].strip()

    return {
        "utm_source":   utm_source or None,
        "utm_medium":   utm_medium,
        "utm_campaign": utm_campaign,
        "utm_content":  utm_content,
        "utm_term":     utm_term,
        "meta_ad_id":   meta_ad_id,
    }


def map_sale(item: dict) -> dict:
    purchase = item.get("purchase", {})
    product  = item.get("product", {})
    buyer    = item.get("buyer", {})
    producer = item.get("producer", {})

    transaction = purchase.get("transaction", "")
    raw_status  = purchase.get("status", "")
    status      = STATUS_MAP.get(raw_status.upper(), "pendente")

    price        = purchase.get("price", {})
    valor_bruto  = price.get("value", 0.0)

    # Hotmart retorna commission_as e fee separados — calculamos líquido
    hotmart_fee_obj = purchase.get("hotmart_fee", {})
    hotmart_commission = hotmart_fee_obj.get("total", 0.0)
    hotmart_commission_base = hotmart_fee_obj.get("base")  # preço produto sem juros parcelamento
    valor_liquido = round(valor_bruto - hotmart_commission, 2)

    # preco_oferta: preço base do produto sem juros de parcelamento
    # hotmart_fee.base = base de cálculo da taxa = preço do produto sem parcelamento
    # Ex: venda 12x → price.value=368.64 (com juros), hotmart_fee.base=297 (preço produto)
    # Fallback: em vendas à vista hotmart_fee.base pode vir nulo → price.value já é o preço certo
    preco_oferta = hotmart_commission_base if hotmart_commission_base else valor_bruto

    created_at_ms = purchase.get("order_date")
    if created_at_ms:
        created_at = datetime.fromtimestamp(created_at_ms / 1000, tz=timezone.utc).isoformat()
    else:
        created_at = datetime.now(timezone.utc).isoformat()

    tracking = purchase.get("tracking", {})
    sck = tracking.get("source_sck") or tracking.get("src") or ""
    utms = _parse_sck(sck)

    # Extração robusta de dados do comprador — Hotmart sempre tem essas informações,
    # mas o campo pode vir em caminhos diferentes dependendo do método de pagamento.
    addr = buyer.get("address") or {}
    comprador_nome = (
        buyer.get("name") or
        buyer.get("full_name") or
        buyer.get("trade_name") or
        item.get("subscriber", {}).get("name") or
        None
    )
    comprador_cidade = (
        addr.get("city") or
        buyer.get("locality") or
        None
    )
    comprador_estado = (
        addr.get("state") or
        addr.get("region") or
        buyer.get("state") or
        None
    )
    comprador_telefone = (
        buyer.get("phone") or
        buyer.get("mobile_phone") or
        buyer.get("cel_phone") or
        None
    )
    # E-mail: sempre presente na Hotmart, funciona como fallback de identificação
    comprador_email = (
        buyer.get("email") or
        item.get("subscriber", {}).get("email") or
        None
    )

    payment     = purchase.get("payment", {})
    metodo_pagamento = (payment.get("type") or "").lower() or None

    produto_id = (
        str(product.get("id") or product.get("ucode") or "").strip() or None
    )

    comprador_pais = (
        addr.get("country") or
        buyer.get("locale", {}).get("country") if isinstance(buyer.get("locale"), dict) else None or
        "BR"
    )

    return {
        "hotmart_transaction_id": transaction,
        "status":                 status,
        "created_at":             created_at,
        "produto_id":             produto_id,
        "produto_nome":           product.get("name", ""),
        "valor_bruto":            valor_bruto,
        "valor_liquido":          valor_liquido,
        "preco_oferta":           preco_oferta,
        "metodo_pagamento":       metodo_pagamento,
        "utm_source":             utms.get("utm_source"),
        "utm_medium":             utms.get("utm_medium"),
        "utm_campaign":           utms.get("utm_campaign"),
        "utm_content":            utms.get("utm_content"),
        "utm_term":               utms.get("utm_term"),
        "meta_ad_id":             utms.get("meta_ad_id"),
        "ads_numero":             None,
        "comprador_pais":         comprador_pais,
        "comprador_email":        comprador_email,
        "comprador_estado":       comprador_estado,
        "comprador_cidade":       comprador_cidade,
        "comprador_nome":         comprador_nome,
        "comprador_telefone":     comprador_telefone,
        "hotmart_raw":            item,
    }


# ── Supabase: upsert ─────────────────────────────────────────────────────────

def upsert_supabase(rows: list):
    if not rows:
        return 0

    url  = f"{SUPABASE_URL}/rest/v1/vendas?on_conflict=hotmart_transaction_id"
    body = json.dumps(rows).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "apikey":         SUPABASE_SERVICE_KEY,
            "Authorization":  f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type":   "application/json",
            "Prefer":         "resolution=merge-duplicates",
        }
    )

    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
            return len(rows)
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  Erro Supabase {e.code}: {err}", file=sys.stderr)
        return 0


# ── Enriquecimento de endereço via API de detalhes ───────────────────────────

def fetch_buyer_details(token: str, transaction: str) -> dict:
    """Busca detalhes do comprador (incluindo endereço) via endpoint de resumo da Hotmart."""
    url = (
        "https://developers.hotmart.com/payments/api/v1/sales/users/details"
        f"?transactionCode={urllib.parse.quote(transaction)}"
    )
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type":  "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
            items = body.get("items", [])
            return items[0] if items else {}
    except Exception:
        return {}


def enrich_estados(token: str, days: int = 90):
    """Busca na Hotmart o endereço de vendas aprovadas sem estado cadastrado."""
    import time

    # Buscar transaction IDs sem estado no Supabase
    url = (
        f"{SUPABASE_URL}/rest/v1/vendas"
        f"?select=hotmart_transaction_id"
        f"&status=eq.aprovada"
        f"&comprador_estado=is.null"
        f"&order=created_at.desc"
        f"&limit=200"
    )
    req = urllib.request.Request(url, headers={
        "apikey":        SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            pendentes = json.loads(resp.read())
    except Exception as e:
        print(f"  Erro ao buscar pendentes: {e}", file=sys.stderr)
        return

    if not pendentes:
        print("  Nenhuma venda sem estado para enriquecer.")
        return

    print(f"  {len(pendentes)} vendas sem estado — buscando detalhes na Hotmart...")
    atualizados = 0

    for item in pendentes:
        tid = item.get("hotmart_transaction_id")
        if not tid:
            continue

        details = fetch_buyer_details(token, tid)
        buyer = details.get("buyer") or details.get("data", {}).get("buyer", {})
        addr  = buyer.get("address") or {}

        estado  = addr.get("state") or addr.get("region") or buyer.get("state") or None
        cidade  = addr.get("city")  or buyer.get("locality") or None
        pais    = addr.get("country") or buyer.get("locale", {}).get("country") if isinstance(buyer.get("locale"), dict) else None

        if not estado and not cidade:
            time.sleep(0.2)
            continue

        patch_url  = f"{SUPABASE_URL}/rest/v1/vendas?hotmart_transaction_id=eq.{urllib.parse.quote(tid)}"
        patch_body = {}
        if estado: patch_body["comprador_estado"] = estado
        if cidade: patch_body["comprador_cidade"] = cidade
        if pais:   patch_body["comprador_pais"]   = pais

        patch_req = urllib.request.Request(
            patch_url,
            data=json.dumps(patch_body).encode(),
            method="PATCH",
            headers={
                "apikey":        SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type":  "application/json",
                "Prefer":        "return=minimal",
            }
        )
        try:
            with urllib.request.urlopen(patch_req) as r:
                r.read()
            atualizados += 1
            print(f"    ✓ {tid[:12]}… → {estado}/{cidade}")
        except Exception as e:
            print(f"    ✗ {tid[:12]}… erro: {e}", file=sys.stderr)

        time.sleep(0.25)

    print(f"  {atualizados} vendas enriquecidas com endereço.")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Sincroniza vendas Hotmart → Supabase")
    parser.add_argument("--days",   type=int,            default=30,    help="Quantos dias para trás buscar (padrão: 30)")
    parser.add_argument("--enrich", action="store_true", default=False, help="Enriquecer vendas sem estado via API de detalhes")
    args = parser.parse_args()

    end_date   = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=args.days)

    print(f"Buscando vendas de {start_date.strftime('%Y-%m-%d')} até {end_date.strftime('%Y-%m-%d')}...")

    print("Obtendo token Hotmart...")
    token = get_hotmart_token()
    print("  Token obtido.")

    print("Buscando histórico de vendas...")
    sales = fetch_hotmart_sales(token, start_date, end_date)
    print(f"  {len(sales)} vendas encontradas.")

    if not sales:
        print("Nenhuma venda para sincronizar.")
    else:
        rows = [map_sale(s) for s in sales]

        print(f"Enviando {len(rows)} registros ao Supabase...")
        saved = upsert_supabase(rows)
        print(f"  {saved} registros salvos (upsert por hotmart_transaction_id).")

        from collections import Counter
        status_count = Counter(r["status"] for r in rows)
        print("\nResumo:")
        for status, count in sorted(status_count.items()):
            total = sum(r["valor_bruto"] for r in rows if r["status"] == status)
            print(f"  {status}: {count} vendas  |  R$ {total:,.2f}")

    if args.enrich:
        print("\nEnriquecendo endereços ausentes...")
        enrich_estados(token, days=args.days)


if __name__ == "__main__":
    main()
