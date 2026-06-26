#!/usr/bin/env python3
"""
Puxa os dados MANUAIS do Notion (Vendas, CPA, Performance, Status) por ADS e
guarda como referência na tabela `ads` (colunas *_notion). Não sobrescreve os
valores automáticos do Meta. Em seguida gera um relatório de divergências
comparando Notion x Meta, para você decidir caso a caso qual vale.

Saída do relatório: scripts/relatorio_divergencias_notion.md

Uso: python3 scripts/sync_notion_dados.py
"""
import os, re, json, time, urllib.request
from pathlib import Path
from datetime import datetime

def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            return
        cur = cur.parent

load_env()

NOTION_TOKEN = os.environ.get("NOTION_TOKEN", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DATABASE_ID  = "2c58e543-6581-8150-8d46-e10573281cc1"

if not NOTION_TOKEN:
    raise SystemExit("NOTION_TOKEN não encontrado no .env")

ADS_PATTERN = re.compile(r"ADS\s*0*(\d+)", re.IGNORECASE)

# ── Notion ────────────────────────────────────────────────────────────────────
def notion_request(path, method="GET", body=None):
    url = f"https://api.notion.com/v1{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {NOTION_TOKEN}")
    req.add_header("Notion-Version", "2022-06-28")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode())

def query_database(database_id):
    pages, cursor = [], None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        resp = notion_request(f"/databases/{database_id}/query", "POST", body)
        pages.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
        time.sleep(0.3)
    return pages

def prop_number(props, name):
    p = props.get(name, {})
    return p.get("number")

def prop_status(props, name):
    p = props.get(name, {})
    s = p.get("status") or {}
    return s.get("name")

def prop_select(props, name):
    p = props.get(name, {})
    s = p.get("select") or {}
    return s.get("name")

def prop_title(props, name):
    p = props.get(name, {})
    parts = p.get("title", [])
    return "".join(t.get("plain_text", "") for t in parts).strip()

# ── Supabase ──────────────────────────────────────────────────────────────────
def fetch_supabase(path):
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/{path}")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def supabase_patch(numero, payload):
    url = f"{SUPABASE_URL}/rest/v1/ads?numero=eq.{numero}"
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="PATCH")
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    with urllib.request.urlopen(req) as r:
        return r.status

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("Lendo páginas do Notion...")
    pages = query_database(DATABASE_ID)
    print(f"  {len(pages)} páginas.")

    # número -> dados do Notion
    notion = {}
    for page in pages:
        props = page.get("properties", {})
        tema  = prop_title(props, "Tema")
        m = ADS_PATTERN.search(tema)
        if not m:
            continue
        num = int(m.group(1))
        notion[num] = {
            "vendas_notion":      prop_number(props, "Vendas"),
            "cpa_notion":         prop_number(props, "CPA"),
            "performance_notion": prop_status(props, "Performance"),
            "status_notion":      prop_status(props, "Status"),
        }

    print(f"  {len(notion)} ADS com número identificado no Notion.")

    # Gravar referência no Supabase
    print("Gravando referência *_notion na tabela ads...")
    gravados = 0
    for num, dados in notion.items():
        payload = {k: v for k, v in dados.items() if v is not None}
        if not payload:
            continue
        try:
            supabase_patch(num, payload)
            gravados += 1
        except Exception as e:
            print(f"  Erro ao gravar ADS {num}: {e}")
    print(f"  {gravados} ADS atualizados com dados do Notion.")

    # Buscar dados do Meta (já sincronizados) para comparar
    print("Comparando com os dados do Meta...")
    ads = fetch_supabase("ads?select=numero,titulo,status,vendas_total,cpa_historico,vendas_notion,cpa_notion")
    ads_map = {a["numero"]: a for a in ads}

    divergencias = []
    for num in sorted(notion.keys()):
        a = ads_map.get(num)
        if not a:
            continue
        v_meta = a.get("vendas_total")
        v_note = a.get("vendas_notion")
        c_meta = a.get("cpa_historico")
        c_note = a.get("cpa_notion")

        # divergência de vendas: diferença >= 2 ou um tem e outro não
        div_v = False
        if v_note is not None and v_meta is not None and abs((v_note or 0) - (v_meta or 0)) >= 2:
            div_v = True
        # divergência de CPA: diferença relativa > 25%
        div_c = False
        if c_note and c_meta and c_meta > 0:
            if abs(c_note - float(c_meta)) / float(c_meta) > 0.25:
                div_c = True

        if div_v or div_c:
            divergencias.append({
                "numero": num,
                "titulo": (a.get("titulo") or "")[:45],
                "v_meta": v_meta, "v_note": v_note,
                "c_meta": c_meta, "c_note": c_note,
                "div_v": div_v, "div_c": div_c,
            })

    # Gerar relatório markdown
    out = Path(__file__).resolve().parent / "relatorio_divergencias_notion.md"
    linhas = [
        "# Relatório de Divergências — Notion (manual) x Meta (automático)",
        "",
        f"> Gerado em {datetime.now().strftime('%Y-%m-%d %H:%M')}. "
        f"{len(divergencias)} ADS com divergência relevante de {len(notion)} comparados.",
        "",
        "Critério: vendas diferem em 2 ou mais, ou CPA difere mais de 25%.",
        "Você decide caso a caso qual valor vale. O sync do Meta NÃO foi sobrescrito.",
        "",
        "| ADS | Título | Vendas Meta | Vendas Notion | CPA Meta | CPA Notion | Flag |",
        "|----:|--------|------------:|--------------:|---------:|-----------:|------|",
    ]
    for d in divergencias:
        flags = []
        if d["div_v"]: flags.append("vendas")
        if d["div_c"]: flags.append("CPA")
        cm = f"R$ {d['c_meta']:.2f}" if d["c_meta"] else "—"
        cn = f"R$ {d['c_note']:.2f}" if d["c_note"] else "—"
        linhas.append(
            f"| {d['numero']} | {d['titulo']} | {d['v_meta'] if d['v_meta'] is not None else '—'} "
            f"| {d['v_note'] if d['v_note'] is not None else '—'} | {cm} | {cn} | {', '.join(flags)} |"
        )
    out.write_text("\n".join(linhas), encoding="utf-8")

    print(f"\n{'='*50}")
    print(f"Concluído.")
    print(f"  ADS com dados do Notion:  {gravados}")
    print(f"  Divergências encontradas: {len(divergencias)}")
    print(f"  Relatório: {out}")

if __name__ == "__main__":
    main()
