#!/usr/bin/env python3
"""
Importador de leads do inLead em formato JSON (via API sidecar).
Cobre o gap maio-junho 2026 (e qualquer período exportado no mesmo formato).

Uso:
  python3 importar_inlead_json.py --arquivo ~/Downloads/inlead-gap-maio-junho-2026.json --dry-run
  python3 importar_inlead_json.py --arquivo ~/Downloads/inlead-gap-maio-junho-2026.json
"""
import json, sys, os, argparse, urllib.request, urllib.parse
from pathlib import Path

FUNNEL_SLUG = "fotografo-protegido"
BATCH = 200


def env(key):
    for line in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"{key} não encontrado no .env")


def upsert(records, url, key):
    payload = json.dumps(records).encode()
    req = urllib.request.Request(
        f"{url}/rest/v1/quiz_leads?on_conflict=funnel_slug,code",
        data=payload,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as r:
        return r.status


def transform(row):
    email = row.get("email") or None
    if email:
        email = email.strip().lower()

    situacoes = row.get("situacoes") or []
    sentimentos = row.get("sentimentos") or []
    temas = row.get("temas_dominados") or []

    respostas = {}
    for campo in ["area_atuacao", "profissionalizacao", "tipo_negocio", "confianca_clientes",
                  "custo_processo", "usa_contrato", "tipo_contrato_atual", "foco_artistico",
                  "protege_dinheiro", "entende_contrato", "quer_modelos"]:
        v = row.get(campo)
        if v:
            respostas[campo] = v
    if situacoes:  respostas["situacoes"] = situacoes
    if sentimentos: respostas["sentimentos"] = sentimentos
    if temas:       respostas["temas_dominados"] = temas
    if email:       respostas["email"] = email

    utm_content = row.get("utm_content") or None
    if utm_content:
        utm_content = urllib.parse.unquote_plus(utm_content.replace("+", " "))

    utm_campaign = row.get("utm_campaign") or None
    if utm_campaign:
        utm_campaign = urllib.parse.unquote_plus(utm_campaign.replace("+", " "))

    return {
        "funnel_slug": FUNNEL_SLUG,
        "code": row["code"],
        "created_at": row.get("created_at"),
        "origem": "inlead_import",
        "email": email,
        "completou_lead": bool(email),
        "area_atuacao": row.get("area_atuacao"),
        "profissionalizacao": row.get("profissionalizacao"),
        "tipo_negocio": row.get("tipo_negocio"),
        "confianca_clientes": row.get("confianca_clientes"),
        "situacoes": situacoes or [],
        "custo_processo": row.get("custo_processo"),
        "usa_contrato": row.get("usa_contrato"),
        "tipo_contrato_atual": row.get("tipo_contrato_atual"),
        "foco_artistico": row.get("foco_artistico"),
        "sentimentos": sentimentos or [],
        "protege_dinheiro": row.get("protege_dinheiro"),
        "temas_dominados": temas or [],
        "entende_contrato": row.get("entende_contrato"),
        "quer_modelos": row.get("quer_modelos"),
        "utm_source": row.get("utm_source"),
        "utm_medium": utm_campaign,   # inLead usa medium como nome da campanha
        "utm_campaign": utm_campaign,
        "utm_content": utm_content,
        "utm_term": row.get("utm_term"),
        "device_platform": row.get("device_platform"),
        "ip": row.get("ip"),
        "respostas": respostas,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arquivo", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    with open(args.arquivo, encoding="utf-8") as f:
        raw = json.load(f)

    print(f"📂 {len(raw)} leads lidos de {args.arquivo}")

    records = []
    skipped = 0
    for row in raw:
        if not row.get("code"):
            skipped += 1
            continue
        records.append(transform(row))

    com_email = sum(1 for r in records if r["completou_lead"])
    print(f"✅ {len(records)} registros válidos ({com_email} com e-mail), {skipped} ignorados")

    # Dedup por code
    by_code = {}
    for r in records:
        by_code[r["code"]] = r
    records = list(by_code.values())
    print(f"🔁 {len(records)} únicos após dedup por code")

    if args.dry_run:
        print("🔍 Dry-run — nenhum dado gravado.")
        print("Exemplo:", json.dumps(records[0], ensure_ascii=False, default=str)[:400])
        return

    sb_url = env("SUPABASE_URL")
    sb_key = env("SUPABASE_SERVICE_KEY")

    total = 0
    for i in range(0, len(records), BATCH):
        batch = records[i:i + BATCH]
        status = upsert(batch, sb_url, sb_key)
        total += len(batch)
        print(f"  ⬆️  Lote {i//BATCH+1}: {len(batch)} leads → HTTP {status} (total: {total})")

    print(f"\n✅ Importação concluída: {total} leads enviados ao Supabase.")


if __name__ == "__main__":
    main()
