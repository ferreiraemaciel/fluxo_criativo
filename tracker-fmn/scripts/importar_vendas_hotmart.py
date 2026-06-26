#!/usr/bin/env python3
"""
Tracker FMN — Import histórico de vendas Hotmart (CSV)
Uso: python3 scripts/importar_vendas_hotmart.py <caminho_do_csv>

Lê o CSV exportado do Hotmart e insere/atualiza todas as vendas
na tabela `vendas` do Supabase (upsert via hotmart_transaction_id).
Extrai o número do ADS a partir do campo SCK quando disponível.
"""

import csv
import sys
import re
import os
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import datetime

# ── Carrega .env ──────────────────────────────────────────────────
def carregar_env():
    raiz = Path(__file__).resolve().parent.parent
    env_path = raiz / ".env"
    valores = {}
    if env_path.exists():
        for linha in env_path.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            chave, valor = linha.split("=", 1)
            valores[chave.strip()] = valor.strip().strip('"').strip("'")
    return valores

env = carregar_env()
SUPABASE_URL = env.get("SUPABASE_URL") or os.environ.get("SUPABASE_URL")
SUPABASE_KEY = env.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("SUPABASE_URL ou SUPABASE_SERVICE_KEY não encontrados no .env")

# ── Mapeamento de colunas do CSV ──────────────────────────────────
COL = {
    "transaction_id": "Código da transação",
    "status_csv":     "Status da transação",
    "data_transacao": "Data da transação",
    "aprovacao":      "Confirmação do pagamento",
    "produto_nome":   "Produto",
    "produto_id":     "Código do produto",
    "valor_bruto":    "Faturamento bruto (sem impostos)",
    "valor_liquido":  "Faturamento líquido",
    "canal":          "Canal usado para venda",
    "src":            "Código SRC",
    "sck":            "Código SCK",
    "pagamento":      "Método de pagamento",
    "parcelas":       "Quantidade total de parcelas",
    "pais":           "País",
    "estado":         "Estado / Província",
    "cidade":         "Cidade",
    "cep":            "Código postal",
    "nome":           "Comprador(a)",
    "email":          "Email do(a) Comprador(a)",
    "telefone":       "Telefone",
    "cupom":          "Código de cupom",
    "oferta_nome":    "Nome deste preço",
    "oferta_codigo":  "Código do preço",
    "preco_oferta":   "Valor de compra sem impostos",
    "cupom_codigo":   "Código de cupom",
    "motivo_recusa":  "Motivo de Recusa de Cartão",
}

STATUS_MAP = {
    "aprovado":    "aprovada",
    "completo":    "aprovada",
    "complete":    "aprovada",
    "cancelado":   "cancelada",
    "chargeback":  "chargeback",
    "estorno":     "chargeback",
    "contestação": "chargeback",
    "reembolsado": "reembolsada",
    "reembolso":   "reembolsada",
    "atrasado":    "pendente",
    "pendente":    "pendente",
    "expirado":    "cancelada",
    "disputa":     "protesto",
    "reclamado":   "protesto",
    "protesto":    "protesto",
}

# ── Extrai número do ADS do campo SCK ────────────────────────────
RE_ADS = re.compile(r'ADS[+\s_-]*(\d{1,4})', re.IGNORECASE)
RE_NUM = re.compile(r'\b(\d{1,4})\b')

def extrair_ads_numero(sck: str):
    if not sck or sck.strip() in ("(none)", "", "-"):
        return None
    # decodifica URL encoding
    try:
        sck = urllib.parse.unquote_plus(sck)
    except Exception:
        pass
    m = RE_ADS.search(sck)
    if m:
        return int(m.group(1))
    return None

def extrair_utm_source(canal: str, sck: str):
    canal = (canal or "").strip().lower()
    if canal and canal not in ("(none)", "none", ""):
        return canal
    if sck and "FB" in sck.upper():
        return "facebook"
    if sck and "instagram" in sck.lower():
        return "instagram"
    return None

def parse_data(data_str: str):
    """Converte DD/MM/YYYY HH:MM:SS para ISO 8601."""
    if not data_str or data_str.strip() in ("(none)", ""):
        return None
    try:
        dt = datetime.strptime(data_str.strip(), "%d/%m/%Y %H:%M:%S")
        return dt.isoformat()
    except ValueError:
        try:
            dt = datetime.strptime(data_str.strip()[:10], "%d/%m/%Y")
            return dt.isoformat()
        except ValueError:
            return None

def parse_valor(v: str) -> float:
    if not v or v.strip() in ("(none)", ""):
        return 0.0
    v = v.strip().replace(",", ".")
    try:
        return float(v)
    except ValueError:
        return 0.0

# ── Supabase upsert em lotes ──────────────────────────────────────
def supabase_upsert(registros):
    # Upsert padrão — todos os registros do lote DEVEM ter as mesmas chaves
    # (exigência do PostgREST). Campos geo nulos são enviados como null aqui
    # e depois restaurados pelo patch_geo() em passe separado.
    url = f"{SUPABASE_URL}/rest/v1/vendas?on_conflict=hotmart_transaction_id"
    payload = json.dumps(registros).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "apikey":        SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return {"ok": True, "status": resp.status}
    except urllib.error.HTTPError as e:
        corpo = e.read().decode("utf-8", errors="replace")
        return {"ok": False, "status": e.code, "erro": corpo}

# ── PATCH geo — segundo passe para nunca perder localização ───────
# Faz PATCH individual em cada registro que tem estado/cidade/telefone no CSV.
# Isso garante que um upsert futuro sem geo não apague dados já existentes:
# o segundo passe restaura o valor sempre que o CSV tiver a info.
GEO_CAMPOS = ["comprador_estado", "comprador_cidade", "comprador_cep",
              "comprador_telefone", "comprador_nome", "comprador_email"]

def patch_geo(registros):
    ok = err = 0
    for r in registros:
        geo = {k: r[k] for k in GEO_CAMPOS if r.get(k) is not None}
        if not geo:
            continue
        tid = r["hotmart_transaction_id"]
        url = f"{SUPABASE_URL}/rest/v1/vendas?hotmart_transaction_id=eq.{tid}"
        payload = json.dumps(geo).encode("utf-8")
        req = urllib.request.Request(url, data=payload, method="PATCH", headers={
            "apikey":        SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "return=minimal",
        })
        try:
            urllib.request.urlopen(req)
            ok += 1
        except Exception:
            err += 1
    return ok, err

# ── Main ──────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        sys.exit("Uso: python3 scripts/importar_vendas_hotmart.py <caminho_do_csv>")

    csv_path = Path(sys.argv[1])
    if not csv_path.exists():
        sys.exit(f"Arquivo não encontrado: {csv_path}")

    print(f"Lendo: {csv_path.name}")

    registros = []
    ignorados = 0
    erros_parse = []

    with open(csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f, delimiter=";")

        # Detecta cabeçalhos disponíveis
        cabecalhos = reader.fieldnames or []

        for i, row in enumerate(reader, start=2):
            tid = row.get(COL["transaction_id"], "").strip()
            if not tid:
                ignorados += 1
                continue

            status_raw = row.get(COL["status_csv"], "").strip().lower()
            status = STATUS_MAP.get(status_raw, "pendente")

            # Ignora retentativos / cobranças futuras de assinatura sem status final
            if status_raw in ("em processamento", "bloqueado"):
                ignorados += 1
                continue

            sck    = row.get(COL["sck"], "").strip()
            canal  = row.get(COL["canal"], "").strip()
            ads_num = extrair_ads_numero(sck)
            utm_source = extrair_utm_source(canal, sck)

            created_at = parse_data(row.get(COL["data_transacao"], ""))

            def col(key):
                """Retorna valor da coluna se o cabeçalho existir no CSV, ou None."""
                header = COL.get(key, "")
                if not header or header not in cabecalhos:
                    return None
                v = row.get(header, "").strip()
                return None if v in ("", "(none)", "-") else v

            parcelas_raw = col("parcelas")
            parcelas = int(parcelas_raw) if parcelas_raw and parcelas_raw.isdigit() else None

            aprovacao = parse_data(col("aprovacao") or "")

            registro = {
                "hotmart_transaction_id": tid,
                "hotmart_event":          f"IMPORT_CSV_{status.upper()}",
                "produto_id":             str(row.get(COL["produto_id"], "") or ""),
                "produto_nome":           row.get(COL["produto_nome"], None) or None,
                "valor_bruto":            parse_valor(row.get(COL["valor_bruto"], "0")),
                "valor_liquido":          parse_valor(row.get(COL["valor_liquido"], "0")),
                "preco_oferta":           parse_valor(col("preco_oferta") or "0") or None,
                "status":                 status,
                "metodo_pagamento":       col("pagamento"),
                "parcelas":               parcelas,
                "utm_source":             utm_source,
                "utm_campaign":           None,
                "utm_medium":             None,
                "utm_content":            None,
                "utm_term":               None,
                "meta_ad_id":             None,
                "ads_numero":             ads_num,
                "comprador_pais":         col("pais") or "BR",
                "comprador_estado":       col("estado"),
                "comprador_cidade":       col("cidade"),
                "comprador_cep":          col("cep"),
                "comprador_nome":         col("nome"),
                "comprador_email":        col("email"),
                "comprador_telefone":     col("telefone"),
                "oferta_nome":            col("oferta_nome"),
                "oferta_codigo":          col("oferta_codigo"),
                "cupom_codigo":           col("cupom_codigo"),
                "motivo_recusa":          col("motivo_recusa"),
                "created_at":             created_at,
                "hotmart_order_date":     created_at,
                "hotmart_approved_date":  aprovacao,
            }

            registros.append(registro)

    total = len(registros)
    print(f"Registros parsed: {total} | Ignorados: {ignorados}")

    if total == 0:
        print("Nenhum registro para importar.")
        return

    # Envia em lotes de 200
    LOTE = 200
    sucesso = 0
    falha = 0

    for ini in range(0, total, LOTE):
        lote = registros[ini:ini + LOTE]
        fim  = min(ini + LOTE, total)
        print(f"  Enviando {ini+1}–{fim} / {total}...", end=" ", flush=True)
        res = supabase_upsert(lote)
        if res["ok"]:
            sucesso += len(lote)
            print(f"OK")
        else:
            falha += len(lote)
            print(f"ERRO {res.get('status')}: {res.get('erro','')[:120]}")
        time.sleep(0.3)

    print(f"\nUpsert: {sucesso} OK | {falha} erros")

    # Segundo passe: PATCH geo para nunca perder estado/cidade/telefone
    print("\nAtualizando localização (estado, cidade, telefone)...")
    geo_ok, geo_err = patch_geo(registros)
    print(f"Geo patch: {geo_ok} atualizados | {geo_err} erros")

    print(f"\nConcluído: {sucesso} registros | {geo_ok} geos garantidos")
    if sucesso > 0:
        print("  O trigger do Supabase recalcula CPA automaticamente.")

if __name__ == "__main__":
    main()
