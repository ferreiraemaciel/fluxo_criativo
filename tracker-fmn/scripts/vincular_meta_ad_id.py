"""
Vincula meta_ad_id nos registros do Supabase.
Busca todos os anúncios da conta Meta, extrai o número do nome (ex: "ADS 246 - tema" → 246)
e atualiza meta_ad_id nos ads do Supabase que tiverem número correspondente.
"""

import re
import json
import os
import urllib.request
import urllib.parse
from pathlib import Path


def load_env():
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidate = cur / ".env"
        if candidate.exists():
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        cur = cur.parent


def api_get(url):
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def supabase_request(method, path, body=None):
    url = os.environ["SUPABASE_URL"].rstrip("/") + path
    headers = {
        "apikey": os.environ["SUPABASE_SERVICE_KEY"],
        "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_KEY']}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode("utf-8"))


# O nome do anúncio na Meta carrega DOIS números: o do slot da campanha ("CR 62")
# e o do criativo ("ADS 52"). Quem identifica o criativo é o segundo.
#
# A versão anterior pegava o primeiro número que aparecesse no nome, com
# r'\b(\d{1,4})\b'. Como "CR" vem antes de "ADS", ela capturava o slot e
# vinculava o card ao anúncio errado: 136 dos 237 cards ficaram assim, 134 deles
# apontando para um anúncio cujo CR era igual ao número do card. Corrigido em
# 2026-08-25. O sync_insights.py sempre usou o padrão certo, por isso as
# métricas nunca quebraram, só o vínculo.
ADS_PATTERN = re.compile(r"ADS\s*0*(\d{1,4})\b", re.IGNORECASE)


def extrair_numero(nome):
    """Número do CRIATIVO, lido do trecho 'ADS N' do nome do anúncio.

    Se o nome não tiver 'ADS N', devolve None e o anúncio é ignorado. Não vale
    chutar pelo primeiro número que aparecer: era exatamente esse chute que
    produzia o vínculo errado."""
    achados = ADS_PATTERN.findall(nome or "")
    return int(achados[-1]) if achados else None


def buscar_ads_meta(account_id, token):
    """Busca todos os anúncios da conta Meta (todas as páginas)."""
    ads = []
    url = (
        f"https://graph.facebook.com/v25.0/act_{account_id}/ads"
        f"?fields=id,name,effective_status,created_time"
        f"&limit=500"
        f"&access_token={token}"
    )
    while url:
        data = api_get(url)
        if "error" in data:
            raise RuntimeError(f"Erro Meta API: {data['error']}")
        ads.extend(data.get("data", []))
        url = data.get("paging", {}).get("next")
    return ads


def buscar_ads_supabase():
    """Busca todos os ads do Supabase com numero e meta_ad_id atual."""
    result = supabase_request("GET", "/rest/v1/ads?select=numero,meta_ad_id&limit=1000")
    return {row["numero"]: row["meta_ad_id"] for row in (result or [])}


def atualizar_meta_ad_id(numero, meta_ad_id):
    return supabase_request(
        "PATCH",
        f"/rest/v1/ads?numero=eq.{numero}",
        {"meta_ad_id": meta_ad_id},
    )


def main():
    load_env()

    token = os.environ.get("FB_ACCESS_TOKEN_PERMANENTE")
    account_id = os.environ.get("FB_AD_ACCOUNT_ID")

    if not token or not account_id:
        raise SystemExit("FB_ACCESS_TOKEN_PERMANENTE ou FB_AD_ACCOUNT_ID não encontrados no .env")

    print("Buscando anúncios da conta Meta...")
    meta_ads = buscar_ads_meta(account_id, token)
    print(f"  {len(meta_ads)} anúncios encontrados no Meta.")

    print("Buscando ads do Supabase...")
    supabase_map = buscar_ads_supabase()
    print(f"  {len(supabase_map)} ads no Supabase.")

    # Monta mapa número → meta_ad_id a partir dos anúncios Meta.
    #
    # O mesmo criativo costuma rodar em vários anúncios (o ADS 195 roda em 9).
    # O card guarda um id só, então é preciso um critério estável, senão cada
    # execução escolhe um diferente e o campo fica trocando à toa.
    # Critério: anúncio ATIVO ganha de pausado; empatou, fica o mais recente.
    candidatos = {}
    sem_numero = []
    for ad in meta_ads:
        n = extrair_numero(ad["name"])
        if n is None:
            sem_numero.append(ad["name"])
            continue
        candidatos.setdefault(n, []).append(ad)

    def prioridade(ad):
        ativo = 1 if (ad.get("effective_status") or "").upper() == "ACTIVE" else 0
        return (ativo, ad.get("created_time") or "", ad["id"])

    meta_por_numero = {}
    for n, lista in candidatos.items():
        escolhido = max(lista, key=prioridade)
        meta_por_numero[n] = escolhido["id"]
        if len(lista) > 1:
            print(f"  [info] ADS {n}: {len(lista)} anúncios com esse criativo, "
                  f"escolhido '{escolhido['name'][:60]}'")

    # Vincula
    atualizados = []
    ja_vinculados = []
    nao_encontrados = []

    for numero in sorted(supabase_map.keys()):
        meta_id = meta_por_numero.get(numero)
        atual = supabase_map[numero]

        if meta_id is None:
            nao_encontrados.append(numero)
            continue

        if atual == meta_id:
            ja_vinculados.append(numero)
            continue

        atualizar_meta_ad_id(numero, meta_id)
        atualizados.append((numero, meta_id))
        print(f"  ✅ AD {numero} → {meta_id}")

    print("\n--- Resumo ---")
    print(f"Atualizados agora:   {len(atualizados)}")
    print(f"Já vinculados:       {len(ja_vinculados)}")
    print(f"Não encontrados:     {len(nao_encontrados)}")
    if nao_encontrados:
        print(f"  Números sem match: {nao_encontrados[:20]}{'...' if len(nao_encontrados) > 20 else ''}")
    if sem_numero:
        print(f"\nAnúncios Meta sem número no nome ({len(sem_numero)}):")
        for n in sem_numero[:10]:
            print(f"  - {n}")
        if len(sem_numero) > 10:
            print(f"  ... e mais {len(sem_numero) - 10}")


if __name__ == "__main__":
    main()
