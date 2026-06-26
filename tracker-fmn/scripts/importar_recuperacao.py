#!/usr/bin/env python3
"""Importa motivos de cancelamento e abandonos de carrinho para o Supabase."""

import csv, os, sys, json, urllib.request
from pathlib import Path
from datetime import datetime

def load_env():
    env = {}
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                if "=" in line and not line.startswith("#"):
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
            break
        cur = cur.parent
    return env

def supabase_upsert(env, table, rows, on_conflict=None):
    url = env["SUPABASE_URL"] + f"/rest/v1/{table}"
    if on_conflict:
        url += f"?on_conflict={on_conflict}"
    data = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers={
        "apikey":        env["SUPABASE_SERVICE_KEY"],
        "Authorization": "Bearer " + env["SUPABASE_SERVICE_KEY"],
        "Content-Type":  "application/json",
        "Prefer":        "resolution=merge-duplicates,return=minimal",
    })
    resp = urllib.request.urlopen(req)
    return resp.status

def supabase_patch(env, table, match_col, match_val, payload):
    url = env["SUPABASE_URL"] + f"/rest/v1/{table}?{match_col}=eq.{match_val}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="PATCH", headers={
        "apikey":        env["SUPABASE_SERVICE_KEY"],
        "Authorization": "Bearer " + env["SUPABASE_SERVICE_KEY"],
        "Content-Type":  "application/json",
        "Prefer":        "return=minimal",
    })
    try:
        urllib.request.urlopen(req)
        return True
    except Exception:
        return False

def parse_data_br(s):
    s = s.strip()
    if not s or s == "(none)":
        return None
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).isoformat() + "Z"
        except ValueError:
            pass
    return None

def main():
    env = load_env()

    # ── 1. Motivos de cancelamento ─────────────────────────────────
    cancel_file = Path(__file__).parent.parent / "downloads_temp" / "cancellation.csv"
    cancel_args = [a for a in sys.argv[1:] if "cancellation" in a.lower() or "cancel" in a.lower()]
    if cancel_args:
        cancel_file = Path(cancel_args[0])

    if cancel_file.exists():
        print(f"Atualizando motivos de cancelamento: {cancel_file.name}")
        ok = err = 0
        with open(cancel_file, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                tid = row.get("Transação", "").strip()
                if not tid:
                    continue
                motivo   = row.get("Status do Cartão", "").strip() or None
                categoria = row.get("Categoria de Motivos", "").strip() or None
                if supabase_patch(env, "vendas", "hotmart_transaction_id", tid,
                                  {"motivo_recusa": motivo, "categoria_recusa": categoria}):
                    ok += 1
                else:
                    err += 1
        print(f"  Cancelamentos: {ok} atualizados | {err} erros")
    else:
        print("Arquivo de cancelamentos não informado, pulando.")

    # ── 2. Abandonos de carrinho ───────────────────────────────────
    abandono_args = [a for a in sys.argv[1:] if "cart" in a.lower() or "abandono" in a.lower() or "abandonment" in a.lower()]
    if not abandono_args:
        print("Nenhum arquivo de abandono informado, pulando.")
        return

    total_ok = total_err = 0
    for fpath in abandono_args:
        p = Path(fpath)
        if not p.exists():
            print(f"  Arquivo não encontrado: {fpath}")
            continue
        print(f"Importando abandono: {p.name}")
        rows = []
        with open(p, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                nome  = row.get("Nome", "").strip() or None
                email = row.get("Email", "").strip() or None
                if not email:
                    continue
                phone_code = row.get("Código de área", "").strip()
                phone_num  = row.get("Telefone", "").strip()
                telefone = None
                if phone_num:
                    telefone = f"+55{phone_code}{phone_num}" if phone_code else phone_num

                rows.append({
                    "produto_nome": row.get("Produto", "").strip() or None,
                    "oferta_codigo": row.get("Código da Oferta", "").strip() or None,
                    "nome":          nome,
                    "email":         email,
                    "telefone":      telefone,
                    "documento":     row.get("Documento", "").strip() or None,
                    "pais":          row.get("País", "").strip() or None,
                    "checkout_url":  row.get("URL Checkout", "").strip() or None,
                    "created_at":    parse_data_br(row.get("Data de Criação", "")),
                })

        if not rows:
            continue

        # Enviar em lotes de 200
        for i in range(0, len(rows), 200):
            batch = rows[i:i+200]
            try:
                supabase_upsert(env, "abandono_carrinho", batch)
                total_ok += len(batch)
            except Exception as e:
                print(f"  Erro no lote {i}: {e}")
                total_err += len(batch)

        print(f"  {p.name}: {len(rows)} registros")

    print(f"\nAbandonos: {total_ok} inseridos | {total_err} erros")

if __name__ == "__main__":
    main()
