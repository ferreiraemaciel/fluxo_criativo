#!/usr/bin/env python3
"""
Importador de leads históricos do inLead (quiz Fotógrafo Protegido) para o Supabase.

- Lê os CSV de backup exportados do inLead (colunas com IDs crípticos).
- Mapeia cada coluna para o nome humano da pergunta do quiz.
- Faz dedup por 'code' (os exports do inLead têm teto de 5.000 e se sobrepõem).
- Faz parse do campo 'tracking' (UTMs + dados técnicos) e do 'created_at'.
- Sobe para a tabela quiz_leads via PostgREST com upsert (idempotente por code).

Uso:
  python3 importar_quiz_inlead.py --dry-run     # só mostra estatísticas, não grava
  python3 importar_quiz_inlead.py               # importa de verdade
"""
import csv, glob, os, json, sys, re, html, urllib.request, urllib.parse
from datetime import datetime, timezone
from pathlib import Path

csv.field_size_limit(10**7)


def clean(s):
    """Limpa lixo do export do inLead: &nbsp;, entidades HTML, espaços duplos."""
    if not s:
        return s
    s = html.unescape(s)          # &nbsp; -> \xa0, &amp; -> &
    s = s.replace("\xa0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s

DRIVE = os.environ.get(
    "INLEAD_DIR",
    "/Users/ferreiraemaciel/Library/CloudStorage/GoogleDrive-ferreiraemacielfoto@gmail.com/"
    "Meu Drive/Fotografia é o Meu Negócio/InLead",
)
FUNNEL_SLUG = "fotografo-protegido"

# coluna críptica do inLead -> nome humano
MAP = {
    "options: fotoouvideo":    "area_atuacao",
    "options: opcoes_lTUeCG":  "profissionalizacao",
    "options: pjoupf":         "tipo_negocio",
    "options: opcoes_8YRk77":  "confianca_clientes",
    "options: opcoes_lbkMu8":  "situacoes",          # multi
    "options: opcoes_FWjaYZ":  "custo_processo",
    "options: opcoes_Hksdt7":  "usa_contrato",
    "options: opcoes_bWy58H":  "tipo_contrato_atual",
    "options: opcoes_szZGgj":  "foco_artistico",
    "options: opcoes_WawXFG":  "sentimentos",        # multi
    "options: opcoes_nvNn4C":  "protege_dinheiro",
    "options: opcoes_09hrR5":  "temas_dominados",    # multi
    "options: opcoes_47yf4Y":  "entende_contrato",
    "options: opcoes_0fhO4E":  "quer_modelos",
    "field: 0Q6pG7":           "email",
}
MULTI = {"situacoes", "sentimentos", "temas_dominados"}


def env(key):
    for line in (Path(__file__).resolve().parent.parent / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"{key} não encontrado no .env")


def canonical_files():
    allf = sorted(glob.glob(os.path.join(DRIVE, "InLead backup*.csv")))
    return [f for f in allf if "separado" not in f and "email" not in f.lower()]


def parse_created_at(v):
    v = (v or "").strip()
    for fmt in ("%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            return datetime.strptime(v, fmt).replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return None


def parse_tracking(v):
    """tracking = 'chave: valor | chave: valor'. Devolve dict de utm + técnicos."""
    out = {"utm_source": None, "utm_medium": None, "utm_campaign": None,
           "utm_content": None, "utm_term": None, "device_platform": None, "ip": None}
    v = (v or "").strip()
    if not v:
        return out
    for part in v.split(" | "):
        if ": " not in part:
            continue
        k, val = part.split(": ", 1)
        k = k.strip().lower()
        val = val.strip()
        if k.startswith("utm_"):
            out[k] = urllib.parse.unquote_plus(val)
        elif k == "platform":
            out["device_platform"] = val
        elif k == "ip":
            out["ip"] = val
    return out


def transform(row):
    rec = {"funnel_slug": FUNNEL_SLUG, "code": (row.get("code") or "").strip(),
           "origem": "inlead_import", "raw": {k: v for k, v in row.items() if v}}
    rec["created_at"] = parse_created_at(row.get("created_at"))
    respostas = {}
    for col, human in MAP.items():
        val = clean((row.get(col) or "").strip())
        if human in MULTI:
            arr = [clean(x) for x in val.split(" | ") if clean(x)] if val else []
            rec[human] = arr
            if arr:
                respostas[human] = arr
        else:
            if human == "email" and val:
                val = val.lower()
            rec[human] = val or None
            if val:
                respostas[human] = val
    rec["completou_lead"] = bool((row.get("field: 0Q6pG7") or "").strip())
    rec.update(parse_tracking(row.get("tracking")))
    rec["tracking_raw"] = (row.get("tracking") or "").strip() or None
    rec["respostas"] = respostas
    return rec


def merge(old, new):
    out = dict(old)
    for k, v in new.items():
        empty = v in (None, "", [], {})
        if not empty:
            out[k] = v
        elif k not in out:
            out[k] = v
    # raw: junta o que tiver
    out["raw"] = {**old.get("raw", {}), **new.get("raw", {})}
    return out


def load():
    by_code = {}
    counts = []
    for f in canonical_files():
        n = 0
        with open(f, encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                rec = transform(row)
                if not rec["code"]:
                    continue
                n += 1
                key = rec["code"]
                by_code[key] = merge(by_code[key], rec) if key in by_code else rec
        counts.append((os.path.basename(f), n))
    return by_code, counts


def stats(by_code, counts):
    recs = list(by_code.values())
    print("Arquivos lidos:")
    for name, n in counts:
        print(f"   {n:>5} linhas  |  {name}")
    print(f"\nLinhas somadas: {sum(n for _, n in counts)}")
    print(f"Leads únicos (dedup por code): {len(recs)}")
    com = sum(1 for r in recs if r["completou_lead"])
    print(f"Leads completos (com e-mail): {com}  ({com*100//max(len(recs),1)}%)")
    datas = [r["created_at"][:10] for r in recs if r["created_at"]]
    if datas:
        print(f"Período: {min(datas)} a {max(datas)}")

    def dist(field, top=6):
        from collections import Counter
        c = Counter()
        for r in recs:
            v = r.get(field)
            if isinstance(v, list):
                for x in v:
                    c[x] += 1
            elif v:
                c[v] += 1
        print(f"\n  {field}:")
        for val, q in c.most_common(top):
            print(f"     {q:>5}  {val}")

    dist("area_atuacao")
    dist("usa_contrato")
    dist("utm_campaign", top=5)
    # amostra mascarada
    print("\nAmostra (1 registro, e-mail mascarado):")
    for r in recs:
        if r["completou_lead"]:
            s = dict(r)
            e = s.get("email") or ""
            s["email"] = (e[:2] + "***@" + e.split("@")[-1]) if "@" in e else e
            s.pop("raw", None)
            print(json.dumps(s, ensure_ascii=False, indent=2)[:1400])
            break


# conjunto fixo de colunas enviadas (PostgREST exige chaves idênticas no lote)
COLUMNS = [
    "funnel_slug", "code", "created_at", "email", "nome", "whatsapp",
    "area_atuacao", "profissionalizacao", "tipo_negocio", "confianca_clientes",
    "situacoes", "custo_processo", "usa_contrato", "tipo_contrato_atual",
    "foco_artistico", "sentimentos", "protege_dinheiro", "temas_dominados",
    "entende_contrato", "quer_modelos", "completou_lead",
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "device_platform", "ip", "tracking_raw", "origem", "respostas", "raw",
]


def upsert(recs):
    url = env("SUPABASE_URL")
    key = env("SUPABASE_SERVICE_KEY")
    endpoint = f"{url}/rest/v1/quiz_leads?on_conflict=funnel_slug,code"
    headers = {
        "apikey": key, "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    BATCH = 500
    total = 0
    for i in range(0, len(recs), BATCH):
        chunk = [{c: r.get(c) for c in COLUMNS} for r in recs[i:i + BATCH]]
        data = json.dumps(chunk, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                resp.read()
            total += len(chunk)
            print(f"   enviados {total}/{len(recs)}")
        except urllib.error.HTTPError as e:
            print(f"   ERRO no lote {i}: {e.code} {e.read().decode()[:500]}")
            raise
    print(f"\nOK: {total} leads enviados (upsert por code).")


if __name__ == "__main__":
    by_code, counts = load()
    stats(by_code, counts)
    if "--dry-run" in sys.argv:
        print("\n[dry-run] nada foi gravado.")
    else:
        print("\nImportando para o Supabase...")
        upsert(list(by_code.values()))
