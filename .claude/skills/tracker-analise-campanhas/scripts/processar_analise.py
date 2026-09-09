#!/usr/bin/env python3
"""
Recebe o JSON bruto de coletar_dados.py e devolve um JSON pequeno, já calculado,
com o material pronto para cada seção do relatório narrado:

  resumo_por_produto     saúde geral (ativos, gasto/vendas 5d e histórico, alertas)
  radar_regras           quem já foi pausado/alertado e quem está perto de disparar
                         (G1: gasto sem venda, G5: CPA acima do limite, G6: esfriou)
  funil                  ranking por CPA/ROAS + gargalo de funil por anúncio ativo
  fadiga_e_escala        candidatos a pausar por fadiga vs candidatos a escalar
  lifecycle              tempo rodando, campeões atuais, arquivados com histórico bom
  orcamento_receita      ritmo de gasto, projeção do mês, receita líquida real x gasto

Uso: python3 processar_analise.py --in /tmp/tracker-analise-bruto.json
"""
import argparse, json
from collections import defaultdict
from datetime import datetime, timezone, date
import calendar


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="entrada", required=True)
    return p.parse_args()


def num(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def parametros_produto(regras_atp):
    """Extrai ticket e cpa_limite por produto a partir de G1/G5 em regras_atp."""
    out = {"MCV": {"ticket": 297.0, "cpa_limite": 207.90},
           "BLI": {"ticket": 397.0, "cpa_limite": 277.90}}
    for r in regras_atp:
        params = r.get("parametros") or {}
        por_produto = params.get("por_produto") or {}
        for produto, vals in por_produto.items():
            if produto not in out:
                out[produto] = {}
            if "cpa_limite" in vals:
                out[produto]["cpa_limite"] = vals["cpa_limite"]
            if "ticket" in vals:
                out[produto]["ticket"] = vals["ticket"]
    return out


def indexar_insights(insights_cache):
    """meta_ad_id -> periodo -> linha"""
    idx = defaultdict(dict)
    for row in insights_cache:
        idx[row["meta_ad_id"]][row["periodo"]] = row
    return idx


def diagnostico_funil(periodo7d):
    if not periodo7d or num(periodo7d.get("cliques")) == 0:
        return "sem_dado", "Sem clique suficiente no período pra avaliar o funil."
    ctr = num(periodo7d.get("ctr_unico"))
    connect = num(periodo7d.get("connect_rate"))
    conv_pagina = num(periodo7d.get("conv_pagina"))
    checkout_rate = num(periodo7d.get("checkout_rate"))
    if connect and connect < 0.5:
        return "gargalo_pagina", f"Connect rate baixo ({connect:.0%}) — link clicado mas a página não carrega bem ou demora."
    if conv_pagina and conv_pagina < 0.01 and num(periodo7d.get("landing_page_views")) > 50:
        return "gargalo_conversao", f"Muita visita na página ({int(periodo7d.get('landing_page_views') or 0)}) e poucas compras — a oferta/copy da página é o gargalo."
    if checkout_rate is not None and num(periodo7d.get("initiate_checkout")) > 5 and checkout_rate < 0.3:
        return "gargalo_checkout", f"Inicia checkout mas não termina ({checkout_rate:.0%} de conclusão) — travou no pagamento."
    if ctr and ctr < 0.01:
        return "gargalo_criativo", f"CTR baixo ({ctr:.2%}) — o criativo não está parando o scroll."
    return "saudavel", "Funil sem gargalo evidente no período."


def main():
    args = parse_args()
    with open(args.entrada, encoding="utf-8") as f:
        bruto = json.load(f)

    params = parametros_produto(bruto["regras_atp"])
    insights_idx = indexar_insights(bruto["insights_cache"])
    numero_produto = {a["numero"]: a.get("produto") or "MCV" for a in bruto["ads_numero_produto"]}

    ads_ativos = bruto["ads_ativos"]
    hoje = datetime.now(timezone.utc).date()

    # ---------- Resumo por produto + Radar de regras ----------
    resumo = defaultdict(lambda: {
        "ativos": 0, "gasto_5d": 0.0, "vendas_5d": 0, "gasto_total_ativos": 0.0,
        "vendas_total_ativos": 0, "perto_de_pausar": [], "saudaveis": [], "sem_dado": [],
    })
    numeros_ativos = {a["numero"] for a in ads_ativos}
    pendentes_relevantes = [al for al in bruto["alertas_pendentes"] if al.get("ads_numero") in numeros_ativos]
    pendentes_orfaos = [al for al in bruto["alertas_pendentes"] if al.get("ads_numero") not in numeros_ativos]
    radar = {
        "pendentes_em_ads_ativos": pendentes_relevantes,
        "pendentes_orfaos_count": len(pendentes_orfaos),
        "resolvidos_14d": bruto["alertas_resolvidos_14d"],
        "quase_disparando": [],
    }

    funil_rows = []
    fadiga = []
    escala = []
    lifecycle_ativos_antigos = []

    for ad in ads_ativos:
        produto = ad.get("produto") or "MCV"
        p = params.get(produto, params["MCV"])
        r = resumo[produto]
        r["ativos"] += 1
        r["gasto_5d"] += num(ad.get("gasto_5d"))
        r["vendas_5d"] += int(ad.get("vendas_5d") or 0)
        r["gasto_total_ativos"] += num(ad.get("gasto_total"))
        r["vendas_total_ativos"] += int(ad.get("vendas_total") or 0)

        cpa_3d, cpa_5d = ad.get("cpa_3d"), ad.get("cpa_5d")
        gasto_5d, vendas_5d = num(ad.get("gasto_5d")), int(ad.get("vendas_5d") or 0)
        cpa_limite = p["cpa_limite"]

        status_regra = "saudavel"
        motivo = None
        if vendas_5d == 0 and gasto_5d >= p["ticket"] * 0.7:
            status_regra = "risco_g1"
            motivo = f"Gastou R${gasto_5d:.2f} em 5 dias sem nenhuma venda (G1 dispara a R${p['ticket']:.2f})."
        elif cpa_3d is not None and cpa_5d is not None and num(cpa_3d) >= cpa_limite and num(cpa_5d) >= cpa_limite:
            status_regra = "risco_g5"
            motivo = f"CPA 3d (R${num(cpa_3d):.2f}) e 5d (R${num(cpa_5d):.2f}) já acima do limite R${cpa_limite:.2f} — G5 deve pausar no próximo ciclo."
        elif cpa_3d is not None and num(cpa_3d) >= cpa_limite * 0.85:
            status_regra = "atencao"
            motivo = f"CPA 3d (R${num(cpa_3d):.2f}) chegando perto do limite R${cpa_limite:.2f}."

        item = {"numero": ad["numero"], "titulo": ad["titulo"], "produto": produto,
                "gasto_5d": gasto_5d, "vendas_5d": vendas_5d,
                "cpa_3d": cpa_3d, "cpa_5d": cpa_5d, "motivo": motivo}
        if status_regra in ("risco_g1", "risco_g5"):
            r["perto_de_pausar"].append(item)
            radar["quase_disparando"].append(item)
        elif status_regra == "atencao":
            radar["quase_disparando"].append(item)
            r["saudaveis"].append(ad["numero"])
        else:
            r["saudaveis"].append(ad["numero"])

        # ---------- Funil + fadiga + escala (usando período 7d como referência) ----------
        ins = insights_idx.get(ad.get("meta_ad_id"), {})
        p7 = ins.get("7d")
        p30 = ins.get("30d")
        cat_funil, msg_funil = diagnostico_funil(p7) if p7 else ("sem_dado", "Sem insights sincronizados.")
        funil_rows.append({
            "numero": ad["numero"], "titulo": ad["titulo"], "produto": produto,
            "roas_7d": p7.get("roas") if p7 else None,
            "cpa_7d": p7.get("cpa") if p7 else None,
            "ctr_7d": p7.get("ctr_unico") if p7 else None,
            "connect_rate_7d": p7.get("connect_rate") if p7 else None,
            "checkout_rate_7d": p7.get("checkout_rate") if p7 else None,
            "gargalo": cat_funil, "gargalo_detalhe": msg_funil,
        })

        freq7 = num(p7.get("frequencia")) if p7 else 0
        ctr7 = num(p7.get("ctr_unico")) if p7 else 0
        ctr30 = num(p30.get("ctr_unico")) if p30 else 0
        if freq7 >= 2.5 and ctr30 and ctr7 < ctr30 * 0.7:
            fadiga.append({"numero": ad["numero"], "titulo": ad["titulo"], "produto": produto,
                            "frequencia_7d": freq7, "ctr_7d": ctr7, "ctr_30d": ctr30})
        cpa_hist = ad.get("cpa_historico")
        if (cpa_hist is not None and num(cpa_hist) > 0 and num(cpa_hist) < cpa_limite * 0.75
                and int(ad.get("vendas_total") or 0) >= 3 and freq7 < 2.0):
            escala.append({"numero": ad["numero"], "titulo": ad["titulo"], "produto": produto,
                            "cpa_historico": cpa_hist, "vendas_total": ad.get("vendas_total"),
                            "frequencia_7d": freq7})

        if ad.get("created_at"):
            try:
                dt = datetime.fromisoformat(ad["created_at"].replace("Z", "+00:00")).date()
                dias_rodando = (hoje - dt).days
                if dias_rodando >= 45:
                    lifecycle_ativos_antigos.append({"numero": ad["numero"], "titulo": ad["titulo"],
                                                      "produto": produto, "dias_rodando": dias_rodando})
            except ValueError:
                pass

    # ---------- Lifecycle: campeões e arquivados reativáveis ----------
    campeoes = [{"numero": a["numero"], "titulo": a["titulo"], "produto": a.get("produto") or "MCV",
                 "cpa_historico": a.get("cpa_historico"), "vendas_total": a.get("vendas_total")}
                for a in bruto["ads_campeoes"]]
    reativaveis = [{"numero": a["numero"], "titulo": a["titulo"], "produto": a.get("produto") or "MCV",
                    "tag": a.get("tag"), "cpa_historico": a.get("cpa_historico"),
                    "vendas_total": a.get("vendas_total"), "updated_at": a.get("updated_at")}
                   for a in bruto["ads_arquivados_recentes"] if a.get("tag") in ("Ótimo", "Mediano")]

    # ---------- Orçamento & receita real (30d) ----------
    receita_30d = defaultdict(float)
    n_vendas_30d = defaultdict(int)
    for v in bruto["vendas_30d"]:
        prod = numero_produto.get(v.get("ads_numero")) if v.get("ads_numero") else None
        chave = prod or "sem_atribuicao"
        receita_30d[chave] += num(v.get("valor_liquido"))
        n_vendas_30d[chave] += 1

    gasto_30d = defaultdict(float)
    for ad in ads_ativos:
        ins = insights_idx.get(ad.get("meta_ad_id"), {})
        p30 = ins.get("30d")
        if p30:
            gasto_30d[ad.get("produto") or "MCV"] += num(p30.get("gasto"))

    dias_no_mes = calendar.monthrange(hoje.year, hoje.month)[1]
    dias_restantes = dias_no_mes - hoje.day
    projecao = {}
    for produto, r in resumo.items():
        media_diaria_5d = r["gasto_5d"] / 5 if r["gasto_5d"] else 0
        projecao[produto] = {
            "gasto_30d_aprox": round(gasto_30d.get(produto, 0), 2),
            "media_diaria_5d": round(media_diaria_5d, 2),
            "projecao_resto_do_mes": round(media_diaria_5d * dias_restantes, 2),
            "receita_liquida_30d": round(receita_30d.get(produto, 0), 2),
            "n_vendas_30d": n_vendas_30d.get(produto, 0),
            "roas_real_30d": round(receita_30d.get(produto, 0) / gasto_30d[produto], 2)
                             if gasto_30d.get(produto) else None,
        }

    saida = {
        "gerado_em": bruto["gerado_em"],
        "parametros_por_produto": params,
        "resumo_por_produto": {
            k: {"ativos": v["ativos"], "gasto_5d": round(v["gasto_5d"], 2), "vendas_5d": v["vendas_5d"],
                "gasto_total_ativos": round(v["gasto_total_ativos"], 2),
                "vendas_total_ativos": v["vendas_total_ativos"],
                "perto_de_pausar": v["perto_de_pausar"]}
            for k, v in resumo.items()
        },
        "radar_regras": radar,
        "funil": funil_rows,
        "fadiga": fadiga,
        "candidatos_escala": escala,
        "lifecycle": {
            "ativos_rodando_45d_ou_mais": lifecycle_ativos_antigos,
            "campeoes_atuais": campeoes,
            "arquivados_reativaveis": reativaveis,
        },
        "orcamento_receita": {
            "receita_sem_atribuicao_30d": round(receita_30d.get("sem_atribuicao", 0), 2),
            "por_produto": projecao,
            "dias_restantes_no_mes": dias_restantes,
        },
    }
    print(json.dumps(saida, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
