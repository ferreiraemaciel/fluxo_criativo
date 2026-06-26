"""
Migração: Notion (MODELOS DE CONTRATO VISUAL) → Supabase (tabela ads)
Usa a API REST do Notion para buscar todos os registros do database.

Configuração:
  NOTION_TOKEN  — Integration token (secret_...) do Notion
  SUPABASE_URL  — URL do projeto Supabase
  SUPABASE_KEY  — Chave service_role (não a anon key)

Esses valores devem estar no .env na raiz do projeto.
"""

import os, re, sys, json, time, urllib.request, urllib.parse
from pathlib import Path

# ── Carrega .env ─────────────────────────────────────────────────────────────
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
    raise SystemExit("❌  .env não encontrado")

load_env()

NOTION_TOKEN   = os.environ.get("NOTION_TOKEN", "")
SUPABASE_URL   = os.environ.get("SUPABASE_URL", "https://wntzzzuqoqmfcjebmzul.supabase.co")
SUPABASE_KEY   = os.environ.get("SUPABASE_SERVICE_KEY", "") or os.environ.get("SUPABASE_KEY", "")
DATABASE_ID    = "2c58e543-6581-8150-8d46-e10573281cc1"

if not NOTION_TOKEN:
    raise SystemExit("❌  NOTION_TOKEN não encontrado no .env\n"
                     "    Crie uma integration em https://www.notion.so/my-integrations\n"
                     "    e adicione NOTION_TOKEN=secret_... no .env")
if not SUPABASE_KEY:
    raise SystemExit("❌  SUPABASE_SERVICE_KEY não encontrado no .env\n"
                     "    Use a chave service_role (Settings → API no painel Supabase)")


# ── Helpers HTTP ──────────────────────────────────────────────────────────────
def notion_request(path, payload=None):
    url = f"https://api.notion.com/v1{path}"
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {NOTION_TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type":  "application/json",
        },
        method="POST" if payload else "GET",
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def supabase_upsert(rows):
    url = f"{SUPABASE_URL}/rest/v1/ads?on_conflict=numero"
    data = json.dumps(rows).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey":        SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "resolution=merge-duplicates",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


# ── Mapeamento de valores ─────────────────────────────────────────────────────
STATUS_MAP = {
    "Fazer":                 "fazer",
    "Fazendo - Produção":    "fazendo-producao",
    "Fazendo - Teste":       "fazendo-teste",
    "Fazendo - Recorrência": "fazendo-recorrencia",
    "Fazendo - Escala":      "fazendo-recorrencia",  # mais próximo disponível
    "Feito - Ótimo":         "feito-otimo",
    "Feito - Mediano":       "feito-mediano",
    "Feito - Ruim":          "feito-mediano",        # sem "feito-ruim" no schema
}

TIPO_MAP = {
    "Reels":        "reels",
    "Imagem única": "imagem",
    "Carrossel":    "carrossel",
}

def extract_numero(title: str):
    """Extrai o número do título: 'ADS 246 - Tema' → 246"""
    m = re.search(r'\b(\d{1,4})\b', title)
    return int(m.group(1)) if m else None

def prop_text(prop):
    if not prop:
        return ""
    if prop["type"] == "title":
        return "".join(t["plain_text"] for t in prop["title"])
    if prop["type"] == "rich_text":
        return "".join(t["plain_text"] for t in prop["rich_text"])
    return ""

def prop_select(prop):
    if not prop or prop["type"] not in ("select", "status"):
        return ""
    val = prop.get(prop["type"])
    return val["name"] if val else ""

def prop_number(prop):
    if not prop or prop["type"] != "number":
        return None
    return prop["number"]

def prop_url(prop):
    if not prop or prop["type"] != "url":
        return ""
    return prop["url"] or ""


# ── Busca todas as páginas do database ───────────────────────────────────────
def fetch_all_pages():
    pages = []
    cursor = None
    page_num = 1
    while True:
        payload = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        resp = notion_request(f"/databases/{DATABASE_ID}/query", payload)
        pages.extend(resp["results"])
        print(f"  Página {page_num}: {len(resp['results'])} registros", flush=True)
        page_num += 1
        if not resp.get("has_more"):
            break
        cursor = resp["next_cursor"]
        time.sleep(0.35)  # respeita rate limit Notion (3 req/s)
    return pages


# ── Converte página Notion → linha Supabase ───────────────────────────────────
def notion_to_row(page):
    props = page["properties"]

    titulo_raw = prop_text(props.get("Tema") or props.get("Name") or props.get("title", {}) or {})
    if not titulo_raw:
        # tenta qualquer propriedade do tipo title
        for p in props.values():
            if p.get("type") == "title":
                titulo_raw = prop_text(p)
                break

    if not titulo_raw:
        return None

    numero = extract_numero(titulo_raw)
    if numero is None:
        return None  # ignora registros sem número (templates, etc.)

    status_raw = prop_select(props.get("Status", {}))
    status     = STATUS_MAP.get(status_raw, "fazer")

    tipo_raw   = prop_select(props.get("Tipo de anúncio", {}))
    tipo       = TIPO_MAP.get(tipo_raw, "reels")

    cpa        = prop_number(props.get("CPA", {}))
    vendas     = prop_number(props.get("Vendas", {}))
    url        = prop_url(props.get("URL", {}))

    # Título limpo: remove "ADS NNN - " do início se existir
    titulo_limpo = re.sub(r'^ADS\s*\d+\s*[-–]\s*', '', titulo_raw, flags=re.IGNORECASE).strip()
    if not titulo_limpo:
        titulo_limpo = titulo_raw

    row = {
        "numero":       numero,
        "titulo":       titulo_limpo,
        "status":       status,
        "tipo":         tipo,
    }
    if cpa is not None:
        row["cpa_historico"] = round(cpa, 2)
    if vendas is not None:
        row["vendas_total"] = int(vendas)
    if url:
        row["meta_ad_url"] = url

    return row


# ── Principal ─────────────────────────────────────────────────────────────────
def main():
    print(f"\n🔍  Buscando registros do Notion...", flush=True)
    pages = fetch_all_pages()
    print(f"\n✅  {len(pages)} registros encontrados no Notion\n", flush=True)

    rows = []
    skipped = []
    for page in pages:
        row = notion_to_row(page)
        if row:
            rows.append(row)
        else:
            titulo = ""
            for p in page["properties"].values():
                if p.get("type") == "title":
                    titulo = prop_text(p)
                    break
            skipped.append(titulo or page["id"])

    print(f"📋  {len(rows)} ADs para importar  |  {len(skipped)} ignorados (sem número)\n")
    if skipped:
        print("  Ignorados:")
        for s in skipped[:10]:
            print(f"    • {s}")
        if len(skipped) > 10:
            print(f"    ... e mais {len(skipped)-10}")
        print()

    if not rows:
        print("Nenhum AD para importar. Encerrando.")
        return

    # Upsert em lotes de 50
    BATCH = 50
    total_ok = 0
    for i in range(0, len(rows), BATCH):
        lote = rows[i:i+BATCH]
        status_code, body = supabase_upsert(lote)
        if status_code in (200, 201):
            total_ok += len(lote)
            print(f"  ✅  Lote {i//BATCH+1}: {len(lote)} ADs inseridos/atualizados")
        else:
            print(f"  ❌  Lote {i//BATCH+1} falhou ({status_code}): {body[:200]}")
        time.sleep(0.1)

    print(f"\n🎉  Migração concluída: {total_ok}/{len(rows)} ADs no Supabase\n")

    # Salva relatório
    report_path = Path(__file__).parent / "migração-ads-report.json"
    report_path.write_text(json.dumps({"total": len(rows), "importados": total_ok, "ignorados": skipped}, ensure_ascii=False, indent=2))
    print(f"📄  Relatório salvo em: {report_path}\n")


if __name__ == "__main__":
    main()
