#!/usr/bin/env python3
"""
Migração única: Notion → Supabase (tabela ads).
Lê todas as páginas do banco MODELOS DE CONTRATO VISUAL no Notion,
extrai os campos de copy e atualiza os registros correspondentes no Supabase.
"""

import os
import re
import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

# ── Carregar .env ─────────────────────────────────────────────────────────────

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

NOTION_TOKEN     = os.environ.get("NOTION_TOKEN", "")
SUPABASE_URL     = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
DATABASE_ID      = "2c58e543-6581-8150-8d46-e10573281cc1"

if not NOTION_TOKEN:
    raise SystemExit("NOTION_TOKEN não encontrado no .env")

# ── Helpers Notion API ────────────────────────────────────────────────────────

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
    """Retorna todos os registros do banco paginando."""
    pages = []
    cursor = None
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

def get_page_blocks(page_id):
    """Retorna todos os blocos de uma página."""
    blocks = []
    cursor = None
    while True:
        path = f"/blocks/{page_id}/children?page_size=100"
        if cursor:
            path += f"&start_cursor={cursor}"
        resp = notion_request(path)
        blocks.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
        time.sleep(0.2)
    return blocks

# ── Parser de blocos → texto ──────────────────────────────────────────────────

def block_to_text(block):
    """Extrai texto simples de um bloco Notion."""
    btype = block.get("type", "")
    data = block.get(btype, {})
    rich = data.get("rich_text", [])
    text = "".join(r.get("plain_text", "") for r in rich)
    return text.strip()

def blocks_to_sections(blocks):
    """
    Agrupa blocos em seções pelo heading mais próximo.
    Retorna dict: {secao_lower: texto_concatenado}
    """
    sections = {}
    current_heading = "_intro"
    buffer = []

    def flush():
        if buffer:
            key = current_heading
            sections[key] = sections.get(key, "") + "\n".join(buffer).strip()
        buffer.clear()

    for block in blocks:
        btype = block.get("type", "")
        text  = block_to_text(block)

        if btype in ("heading_1", "heading_2", "heading_3"):
            flush()
            # Remove emojis e normaliza
            heading_clean = re.sub(r"[^\w\s]", "", text).strip().lower()
            current_heading = heading_clean
        elif btype == "paragraph" and text:
            buffer.append(text)
        elif btype in ("bulleted_list_item", "numbered_list_item") and text:
            buffer.append(f"• {text}")
        elif btype == "quote" and text:
            buffer.append(text)
        elif btype == "callout":
            data = block.get("callout", {})
            rich = data.get("rich_text", [])
            t = "".join(r.get("plain_text", "") for r in rich).strip()
            if t:
                buffer.append(t)

    flush()
    return sections

def find_section(sections, *keywords):
    """Retorna o valor da primeira seção que contém qualquer uma das keywords."""
    for key, val in sections.items():
        for kw in keywords:
            if kw in key:
                return val.strip()
    return ""

# ── Extração por tipo de AD ───────────────────────────────────────────────────

def extract_fields(sections, tipo):
    """Extrai os campos de copy conforme o tipo de anúncio."""
    tipo_lower = (tipo or "").lower()

    headline       = find_section(sections, "headline")
    hook_visual    = find_section(sections, "imagem principal", "referncia visual", "referencia visual", "imagem")
    hook_copy      = find_section(sections, "gancho", "hook", "cena")
    texto_principal = find_section(sections, "texto principal", "legenda", "desenvolvimento", "roteiro")
    titulo_ad      = find_section(sections, "ttulo", "titulo")
    descricao_ad   = find_section(sections, "descrio", "descricao")

    # Para Reels: gancho é o hook_copy, desenvolvimento+CTA vai para texto_principal
    if "reel" in tipo_lower or "vdeo" in tipo_lower or "video" in tipo_lower:
        dev = find_section(sections, "desenvolvimento", "cta")
        if dev and not texto_principal:
            texto_principal = dev

    return {
        "headline":        headline[:1000]       if headline       else None,
        "hook_visual":     hook_visual[:1000]    if hook_visual    else None,
        "hook_copy":       hook_copy[:2000]      if hook_copy      else None,
        "texto_principal": texto_principal[:3000] if texto_principal else None,
        "titulo_ad":       titulo_ad[:500]       if titulo_ad      else None,
        "descricao_ad":    descricao_ad[:500]    if descricao_ad   else None,
    }

# ── Extrair número do AD do título ────────────────────────────────────────────

def extract_ad_number(title):
    """Extrai o número do AD do título (ex: 'ADS 176 - Contrato inválido' → 176)."""
    m = re.search(r"ADS\s+(\d+)", title, re.IGNORECASE)
    return int(m.group(1)) if m else None

# ── Supabase update ───────────────────────────────────────────────────────────

def supabase_update(numero, fields):
    """Atualiza o registro no Supabase pelo número do AD."""
    # Remove campos None para não sobrescrever dados existentes
    payload = {k: v for k, v in fields.items() if v is not None}
    if not payload:
        return False

    url = f"{SUPABASE_URL}/rest/v1/ads?numero=eq.{numero}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method="PATCH")
    req.add_header("apikey", SUPABASE_SERVICE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_SERVICE_KEY}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status in (200, 204)
    except Exception as e:
        print(f"    Erro Supabase ao atualizar ADS {numero}: {e}")
        return False

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("Buscando páginas do Notion...")
    pages = query_database(DATABASE_ID)
    print(f"  {len(pages)} páginas encontradas.")

    atualizados = 0
    sem_numero  = 0
    sem_copy    = 0
    erros       = 0

    for i, page in enumerate(pages, 1):
        # Título e tipo
        props = page.get("properties", {})
        tema_prop = props.get("Tema", {})
        title_parts = tema_prop.get("title", [])
        title = "".join(t.get("plain_text", "") for t in title_parts).strip()

        tipo_prop = props.get("Tipo de anúncio", {})
        tipo = (tipo_prop.get("select") or {}).get("name", "")

        numero = extract_ad_number(title)
        if not numero:
            sem_numero += 1
            continue

        print(f"  [{i}/{len(pages)}] ADS {numero} — {title[:50]}")

        # Buscar blocos da página
        try:
            blocks = get_page_blocks(page["id"])
        except Exception as e:
            print(f"    Erro ao buscar blocos: {e}")
            erros += 1
            time.sleep(1)
            continue

        if not blocks:
            sem_copy += 1
            continue

        sections = blocks_to_sections(blocks)
        fields   = extract_fields(sections, tipo)

        # Verifica se há algo para salvar
        has_content = any(v for v in fields.values())
        if not has_content:
            sem_copy += 1
            continue

        ok = supabase_update(numero, fields)
        if ok:
            atualizados += 1
        else:
            erros += 1

        # Pausa para respeitar rate limit do Notion
        time.sleep(0.3)

    print(f"\n{'='*50}")
    print(f"Concluído.")
    print(f"  Atualizados:   {atualizados}")
    print(f"  Sem copy:      {sem_copy}")
    print(f"  Sem número:    {sem_numero}")
    print(f"  Erros:         {erros}")

if __name__ == "__main__":
    main()
