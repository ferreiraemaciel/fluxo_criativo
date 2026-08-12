#!/usr/bin/env python3
"""Corrige `vendas.valor_liquido` com o valor real que a Hotmart repassa.

POR QUE ESTE SCRIPT EXISTE
──────────────────────────
O `valor_liquido` estava sendo CALCULADO como `preço pago - taxa da Hotmart`,
em vez de vir do valor que a Hotmart informa como comissão do PRODUTOR. Duas
consequências, conferidas contra a API em 2026-08-12:

1. VENDA PARCELADA. O cálculo partia do valor pago pelo comprador, que inclui
   os juros do cartão. Numa venda 12x: o comprador pagou R$ 368,64, o produto
   custa R$ 297,04, e o Tracker registrava R$ 338,23 de líquido. O que a
   Hotmart repassa de verdade é R$ 264,14. O juro do cartão nunca foi do
   produtor, e estava entrando como receita dele.

2. TODA VENDA. Existe uma comissão de addon ("Club", R$ 2,49 por venda) que
   sai do repasse e não era descontada. Mesmo à vista o líquido saía R$ 2,49
   acima do real.

A fonte da verdade é o endpoint `sales/commissions`, que devolve o repasse de
cada participante. Aqui só o que tem `source = PRODUCER` interessa: é o que
efetivamente cai na conta.

Idempotente: rodar de novo só reconfirma os mesmos valores.

Uso:  python3 scripts/corrigir_valor_liquido.py [--desde 2025-01-01] [--aplicar]
      Sem --aplicar, mostra o que mudaria sem gravar nada.
"""

import argparse
import json
import runpy
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://developers.hotmart.com/payments/api/v1"
AQUI = Path(__file__).resolve().parent


def carregar_ambiente():
    """Reaproveita as credenciais e o helper de Supabase do sync_hotmart."""
    return runpy.run_path(str(AQUI / "sync_hotmart.py"), run_name="corrigir_liquido")


def buscar_comissoes(token, desde_ms):
    """Percorre todas as páginas e devolve {transacao: valor_do_produtor}."""
    por_transacao = {}
    params = {"start_date": desde_ms, "max_results": 500}
    pagina = 0
    while True:
        url = f"{BASE}/sales/commissions?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as r:
            dados = json.load(r)

        for item in dados.get("items", []):
            transacao = item.get("transaction")
            produtor = next(
                (c for c in item.get("commissions", []) if c.get("source") == "PRODUCER"),
                None,
            )
            if transacao and produtor:
                por_transacao[transacao] = round(
                    float(produtor.get("commission", {}).get("value", 0)), 2
                )

        pagina += 1
        proxima = (dados.get("page_info") or {}).get("next_page_token")
        print(f"  página {pagina}: {len(por_transacao)} transações acumuladas")
        if not proxima:
            break
        params["page_token"] = proxima
        time.sleep(0.3)   # respeita o limite da API

    return por_transacao


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--desde", default="2025-01-01", help="data inicial (AAAA-MM-DD)")
    ap.add_argument("--aplicar", action="store_true", help="grava de verdade")
    args = ap.parse_args()

    amb = carregar_ambiente()
    token = amb["get_hotmart_token"]()
    sb_url = amb["SUPABASE_URL"]
    sb_key = amb["SUPABASE_SERVICE_KEY"]

    desde_ms = int(
        datetime.strptime(args.desde, "%Y-%m-%d").replace(tzinfo=timezone.utc).timestamp() * 1000
    )

    print(f"Buscando repasses na Hotmart desde {args.desde}...")
    repasses = buscar_comissoes(token, desde_ms)
    print(f"{len(repasses)} transações com comissão de produtor.\n")

    # O que está gravado hoje. O Supabase devolve no máximo 1000 linhas por
    # vez, então precisa paginar: sem isso a conferência ficaria só no primeiro
    # milheiro e diria que está tudo certo no resto.
    vendas, passo = [], 1000
    while True:
        url = (f"{sb_url}/rest/v1/vendas?select=hotmart_transaction_id,valor_liquido,"
               f"valor_bruto,preco_oferta,parcelas&status=eq.aprovada"
               f"&order=hotmart_transaction_id&limit={passo}&offset={len(vendas)}")
        req = urllib.request.Request(url, headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"})
        with urllib.request.urlopen(req) as r:
            lote = json.load(r)
        vendas.extend(lote)
        if len(lote) < passo:
            break

    divergentes, soma_antes, soma_depois, sem_dado = [], 0.0, 0.0, 0
    for v in vendas:
        t = v["hotmart_transaction_id"]
        atual = float(v.get("valor_liquido") or 0)
        real = repasses.get(t)
        if real is None:
            sem_dado += 1
            continue
        if abs(atual - real) > 0.01:
            divergentes.append((t, atual, real, v.get("parcelas")))
            soma_antes += atual
            soma_depois += real

    print(f"Vendas conferidas ......... {len(vendas)}")
    print(f"Sem dado na API ........... {sem_dado}")
    print(f"Divergentes ............... {len(divergentes)}")
    print(f"Líquido gravado ........... R$ {soma_antes:,.2f}")
    print(f"Líquido real .............. R$ {soma_depois:,.2f}")
    print(f"Diferença ................. R$ {soma_antes - soma_depois:,.2f}\n")

    for t, atual, real, parc in divergentes[:8]:
        print(f"  {t}  {parc or 1}x   {atual:>9.2f} → {real:>9.2f}")
    if len(divergentes) > 8:
        print(f"  ... e mais {len(divergentes) - 8}")

    if not args.aplicar:
        print("\nNada foi gravado. Rode com --aplicar para corrigir.")
        return

    print("\nGravando...")
    for i, (t, _atual, real, _p) in enumerate(divergentes, 1):
        u = f"{sb_url}/rest/v1/vendas?hotmart_transaction_id=eq.{urllib.parse.quote(t)}"
        req = urllib.request.Request(
            u, data=json.dumps({"valor_liquido": real}).encode(), method="PATCH",
            headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}",
                     "Content-Type": "application/json", "Prefer": "return=minimal"},
        )
        urllib.request.urlopen(req).read()
        if i % 100 == 0:
            print(f"  {i}/{len(divergentes)}")
    print(f"Pronto: {len(divergentes)} vendas corrigidas.")


if __name__ == "__main__":
    sys.exit(main())
