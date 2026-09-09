#!/usr/bin/env python3
"""
Coleta os dados das campanhas em veiculação direto do Supabase do Tracker FMN
(nunca da Graph API do Meta, nunca do Notion — o Tracker já sincroniza tudo sozinho
via meta-sync/kanban-sync). Imprime um JSON único consolidado em stdout, que a skill
tracker-analise-campanhas usa pra montar a análise narrada.

Fontes:
  - ads          (status='ativo' + campeões + arquivados recentes, gasto/vendas/CPA
                   em 3 janelas, produto MCV/BLI, tag de performance)
  - insights_cache (funil completo por anúncio: CTR, connect rate, hook/hold rate,
                     checkout iniciado, em vários períodos)
  - alertas      (pendentes de ação + resolvidos recentes, regras G1-G7)
  - regras_atp   (parâmetros vigentes por produto: ticket, CPA limite)
  - vendas       (receita líquida real dos últimos 30 dias, pra ROAS de verdade)

Uso: python3 coletar_dados.py --out /tmp/tracker-analise-bruto.json
Sem --out, imprime o JSON em stdout.
"""
import argparse, sys, json, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from datetime import datetime, timedelta, timezone


def load_env():
    candidatos = []
    cur = Path(__file__).resolve().parent
    while cur.parent != cur:
        candidatos.append(cur / "tracker-fmn" / ".env")
        candidatos.append(cur / ".env")
        cur = cur.parent
    for candidate in candidatos:
        if candidate.exists():
            env = {}
            for line in candidate.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, _, v = line.partition("=")
                env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
            if "SUPABASE_URL" in env and "SUPABASE_SERVICE_KEY" in env:
                return env
    raise SystemExit("SUPABASE_URL / SUPABASE_SERVICE_KEY não encontrados em tracker-fmn/.env")


ENV = load_env()
SUPABASE_URL = ENV["SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = ENV["SUPABASE_SERVICE_KEY"]


def supa_get(path):
    """GET paginado no PostgREST (Range), devolve lista completa sem cair no teto de 1000."""
    out = []
    offset = 0
    page = 1000
    while True:
        sep = "&" if "?" in path else "?"
        url = f"{SUPABASE_URL}/rest/v1/{path}{sep}limit={page}&offset={offset}"
        req = urllib.request.Request(url, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        })
        with urllib.request.urlopen(req, timeout=60) as r:
            chunk = json.loads(r.read())
        out.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return out


def in_clause(valores):
    return "(" + ",".join(str(v) for v in valores) + ")"


def batched(seq, n=150):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def main():
    agora = datetime.now(timezone.utc)
    desde_30d = (agora - timedelta(days=30)).date().isoformat()
    desde_14d = (agora - timedelta(days=14)).date().isoformat()

    campos_ads = ("numero,titulo,tipo,status,produto,tag,meta_ad_id,meta_campaign_id,"
                  "meta_adset_id,gasto_total,vendas_total,cpa_historico,gasto_3d,"
                  "vendas_3d,cpa_3d,gasto_5d,vendas_5d,cpa_5d,isento_regra,observacoes,"
                  "posicionamento,created_at,updated_at")

    ads_ativos = supa_get(f"ads?status=eq.ativo&select={campos_ads}")
    ads_campeoes = supa_get(f"ads?status=eq.campeoes&select={campos_ads}")
    ads_arquivados = supa_get(
        f"ads?status=eq.arquivado&select={campos_ads}&order=updated_at.desc&limit=60"
    )

    meta_ad_ids = [a["meta_ad_id"] for a in ads_ativos if a.get("meta_ad_id")]
    periodos = ["maximum", "3d", "5d", "7d", "14d", "30d"]
    insights = []
    for lote in batched(meta_ad_ids, 100):
        if not lote:
            continue
        filtro = urllib.parse.quote(in_clause(lote), safe="(),")
        insights.extend(supa_get(
            f"insights_cache?meta_ad_id=in.{filtro}"
            f"&periodo=in.({','.join(periodos)})"
            f"&select=meta_ad_id,meta_ad_name,meta_adset_id,meta_campaign_id,"
            f"meta_campaign_name,periodo,gasto,impressoes,cliques,link_clicks,"
            f"landing_page_views,compras,valor_compras,initiate_checkout,cpa,roas,"
            f"ctr_unico,cpm,frequencia,connect_rate,conv_pagina,checkout_rate,"
            f"hook_rate,hold_rate,status_meta"
        ))

    alertas_pendentes = supa_get(
        "alertas?resolvido=eq.false&select=id,ads_numero,regra_codigo,mensagem,"
        "acao_tomada,acao_pendente,dados_snapshot,created_at&order=created_at.desc"
    )
    alertas_recentes = supa_get(
        f"alertas?resolvido=eq.true&created_at=gte.{desde_14d}"
        "&select=id,ads_numero,regra_codigo,mensagem,acao_tomada,created_at"
        "&order=created_at.desc&limit=80"
    )

    regras_atp = supa_get("regras_atp?select=codigo,nome,ativo,parametros")

    vendas_30d = supa_get(
        f"vendas?created_at=gte.{desde_30d}&status=eq.aprovada"
        "&select=ads_numero,produto_nome,valor_liquido,created_at"
    )

    # numero -> produto de TODO ads já cadastrado (não só ativos), pra atribuir
    # corretamente a receita de vendas cujo anúncio já saiu do ar.
    ads_numero_produto = supa_get("ads?select=numero,produto")

    saida = {
        "gerado_em": agora.isoformat(),
        "janela_vendas_desde": desde_30d,
        "regras_atp": regras_atp,
        "ads_ativos": ads_ativos,
        "ads_campeoes": ads_campeoes,
        "ads_arquivados_recentes": ads_arquivados,
        "insights_cache": insights,
        "alertas_pendentes": alertas_pendentes,
        "alertas_resolvidos_14d": alertas_recentes,
        "vendas_30d": vendas_30d,
        "ads_numero_produto": ads_numero_produto,
    }
    return saida


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=None, help="Caminho do arquivo de saída (padrão: stdout)")
    return p.parse_args()


if __name__ == "__main__":
    try:
        args = parse_args()
        resultado = main()
        texto = json.dumps(resultado, ensure_ascii=False, default=str)
        if args.out:
            Path(args.out).write_text(texto, encoding="utf-8")
            print(f"OK: {len(texto)} bytes gravados em {args.out}")
        else:
            print(texto)
    except urllib.error.HTTPError as e:
        print(json.dumps({"erro": f"HTTP {e.code}: {e.read().decode()[:500]}"}), file=sys.stderr)
        sys.exit(1)
