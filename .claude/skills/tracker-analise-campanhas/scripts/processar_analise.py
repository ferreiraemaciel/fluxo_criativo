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
from collections import defaultdict, Counter
from datetime import datetime, timezone, date
from zoneinfo import ZoneInfo
import calendar

BR = ZoneInfo("America/Sao_Paulo")
SYNC_CICLO_HORAS = 6  # meta-sync (scope curtas) roda 4x/dia: a cada 6h


def fmt_br_data(iso_str):
    if not iso_str:
        return None
    try:
        d = datetime.fromisoformat(str(iso_str).replace("Z", "+00:00"))
        return d.strftime("%d/%m")
    except ValueError:
        return None


def janela_declarada(insights_por_periodo, periodo):
    """Data_inicio/data_fim mais comum entre os ativos pra este período, com aviso
    se as datas não baterem entre os anúncios (janela heterogênea)."""
    pares = [(r.get(periodo, {}).get("data_inicio"), r.get(periodo, {}).get("data_fim"))
             for r in insights_por_periodo if r.get(periodo)]
    pares = [p for p in pares if p[0] and p[1]]
    if not pares:
        return {"inicio": None, "fim": None, "homogenea": True, "n": 0}
    contagem = Counter(pares)
    (ini, fim), n = contagem.most_common(1)[0]
    return {
        "inicio": fmt_br_data(ini), "fim": fmt_br_data(fim),
        "homogenea": len(contagem) == 1, "n_anuncios": len(pares),
        "n_na_janela_predominante": n,
    }


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


def _dias_do_periodo(periodo):
    if not periodo or not periodo.get("data_inicio") or not periodo.get("data_fim"):
        return 0
    try:
        ini = date.fromisoformat(str(periodo["data_inicio"]))
        fim = date.fromisoformat(str(periodo["data_fim"]))
        return (fim - ini).days
    except ValueError:
        return 0


def diagnostico_funil(periodo7d, periodo_30d=None):
    if not periodo7d or num(periodo7d.get("cliques")) == 0:
        return "sem_dado", "Sem clique suficiente no período pra avaliar o funil.", None
    ctr = num(periodo7d.get("ctr_unico"))
    connect = num(periodo7d.get("connect_rate"))
    conv_pagina = num(periodo7d.get("conv_pagina"))
    checkout_rate = num(periodo7d.get("checkout_rate"))
    if connect and connect < 0.5:
        return "gargalo_pagina", f"Connect rate baixo ({connect:.0%}), o link foi clicado mas a página não carrega bem ou demora.", None
    if conv_pagina and conv_pagina < 0.01 and num(periodo7d.get("landing_page_views")) > 50:
        return "gargalo_conversao", f"Muita visita na página ({int(periodo7d.get('landing_page_views') or 0)}) e poucas compras, a oferta ou a copy da página é o gargalo.", None
    if checkout_rate is not None and num(periodo7d.get("initiate_checkout")) > 5 and checkout_rate < 0.3:
        return "gargalo_checkout", f"Inicia checkout mas não termina ({checkout_rate:.0%} de conclusão), travou no pagamento.", None
    if ctr and ctr < 0.01:
        # Leitura VTSD: distingue "a Urgência Oculta esgotou" (CTR já foi bom e caiu com
        # o tempo) de "essa Urgência Oculta nunca decolou" (CTR sempre foi baixo). Usa o
        # período de 30 dias como referência, não "maximum": esse último reflete a vida do
        # meta_ad_id atual, que pode ser tão curto quanto os 7 dias se o anúncio foi
        # relançado com número novo recentemente (ver CLAUDE.md do tracker-fmn, seção de
        # relançamento) - nesse caso comparar não diz nada.
        dias_30d = _dias_do_periodo(periodo_30d)
        ctr_30d = num(periodo_30d.get("ctr_unico")) if periodo_30d else None
        if dias_30d < 20:
            leitura = "sem_comparacao_confiavel"
            msg = (f"CTR baixo ({ctr:.2%}), mas esse anúncio só tem {dias_30d} dias de histórico "
                   f"disponível, pouco pra dizer se é fadiga ou se nunca decolou.")
        elif ctr_30d and ctr_30d >= 0.015 and ctr < ctr_30d * 0.7:
            leitura = "esgotou"
            msg = f"CTR caiu de {ctr_30d:.2%} (30 dias) pra {ctr:.2%} agora, a Urgência Oculta desse criativo esgotou com esse público."
        else:
            leitura = "nunca_decolou"
            msg = f"CTR baixo ({ctr:.2%}) e nunca foi muito melhor que isso nos últimos {dias_30d} dias, essa Urgência Oculta nunca decolou com esse público, não é fadiga."
        return "gargalo_criativo", msg, leitura
    return "saudavel", "Funil sem gargalo evidente no período.", None


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
    meta_ad_id_para_numero = {a["meta_ad_id"]: a["numero"] for a in bruto["ads_numero_produto"]
                               if a.get("meta_ad_id")}

    def resolver_numero(alerta):
        """Alguns alertas do meta-sync gravam ads_numero nulo mesmo com meta_ad_id
        preenchido (achado real em 2026-09-09). Sem isso, um alerta de verdade de um
        anúncio ativo seria classificado como órfão por engano."""
        n = alerta.get("ads_numero")
        if n is not None:
            return n
        return meta_ad_id_para_numero.get(alerta.get("meta_ad_id"))

    for al in bruto["alertas_pendentes"] + bruto["alertas_resolvidos_14d"]:
        al["ads_numero"] = resolver_numero(al)

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
            motivo = f"CPA 3d (R${num(cpa_3d):.2f}) e 5d (R${num(cpa_5d):.2f}) já acima do limite R${cpa_limite:.2f}, G5 deve pausar no próximo ciclo."
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
        if p7:
            cat_funil, msg_funil, leitura_vtsd_ad = diagnostico_funil(p7, p30)
        else:
            cat_funil, msg_funil, leitura_vtsd_ad = "sem_dado", "Sem insights sincronizados.", None
        funil_rows.append({
            "numero": ad["numero"], "titulo": ad["titulo"], "produto": produto,
            "roas_7d": p7.get("roas") if p7 else None,
            "cpa_7d": p7.get("cpa") if p7 else None,
            "ctr_7d": p7.get("ctr_unico") if p7 else None,
            "ctr_30d": p30.get("ctr_unico") if p30 else None,
            "leitura_vtsd": leitura_vtsd_ad,
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

        # "Dias rodando" usa a idade do ad_id ATUAL (insights_cache periodo=maximum),
        # não ads.created_at: um lote inteiro de cards tem created_at idêntico até o
        # milissegundo (11/06, achado real em 2026-09-09), prova de importação em
        # massa no banco, não da data em que o anúncio de fato entrou no ar. Um card
        # antigo no Tracker pode estar rodando um criativo relançado há poucos dias.
        pmax = ins.get("maximum")
        dias_ad_atual = _dias_do_periodo(pmax)
        if pmax and dias_ad_atual >= 45:
            lifecycle_ativos_antigos.append({"numero": ad["numero"], "titulo": ad["titulo"],
                                              "produto": produto, "dias_rodando": dias_ad_atual})

    # ---------- Lifecycle: campeões e arquivados reativáveis ----------
    campeoes = [{"numero": a["numero"], "titulo": a["titulo"], "produto": a.get("produto") or "MCV",
                 "cpa_historico": a.get("cpa_historico"), "vendas_total": a.get("vendas_total")}
                for a in bruto["ads_campeoes"]]
    reativaveis = [{"numero": a["numero"], "titulo": a["titulo"], "produto": a.get("produto") or "MCV",
                    "tag": a.get("tag"), "cpa_historico": a.get("cpa_historico"),
                    "vendas_total": a.get("vendas_total"), "updated_at": a.get("updated_at")}
                   for a in bruto["ads_arquivados_recentes"] if a.get("tag") in ("Ótimo", "Mediano")]

    # ---------- Orçamento & receita real ----------
    # Duas medidas deliberadamente diferentes, nenhuma "estimada" apresentada como
    # "real" sem dizer:
    #  1) Receita líquida na janela de vendas declarada (dado real, direto da tabela
    #     vendas) x projeção de gasto pro mesmo período (estimativa, a partir do
    #     ritmo confiável de 5 dias). Não existe "gasto real dos últimos 30 dias" pra
    #     medir contra isso: insights_cache periodo=30d só tem 58 linhas na conta
    #     inteira hoje (só o que o meta-sync está acompanhando ativamente agora), e
    #     somar por ad_id atual sempre subconta quando o anúncio foi relançado.
    #  2) ROAS de vida inteira dos anúncios que estão ativos agora (gasto_total e
    #     receita real desses números específicos, sem recorte de data) - os dois
    #     lados vêm de fonte confiável (agregado por número), por isso é comparável.
    receita_janela = defaultdict(float)
    n_vendas_janela = defaultdict(int)
    for v in bruto["vendas_30d"]:
        prod = numero_produto.get(v.get("ads_numero")) if v.get("ads_numero") else None
        chave = prod or "sem_atribuicao"
        receita_janela[chave] += num(v.get("valor_liquido"))
        n_vendas_janela[chave] += 1

    receita_vida_ativos = defaultdict(float)
    n_vendas_vida_ativos = defaultdict(int)
    for v in bruto.get("vendas_vida_ativos", []):
        prod = numero_produto.get(v.get("ads_numero")) or "MCV"
        receita_vida_ativos[prod] += num(v.get("valor_liquido"))
        n_vendas_vida_ativos[prod] += 1

    dias_no_mes = calendar.monthrange(hoje.year, hoje.month)[1]
    dias_restantes = dias_no_mes - hoje.day
    produtos_conhecidos = sorted(set(params.keys()) | set(resumo.keys()) | set(receita_janela.keys()) - {"sem_atribuicao"})
    projecao = {}
    for produto in produtos_conhecidos:
        r = resumo.get(produto, {"ativos": 0, "gasto_5d": 0.0, "gasto_total_ativos": 0.0, "vendas_total_ativos": 0})
        media_diaria_5d = r["gasto_5d"] / 5 if r["gasto_5d"] else 0
        gasto_vida_ativos = r["gasto_total_ativos"]
        receita_vida = receita_vida_ativos.get(produto, 0)
        projecao[produto] = {
            "ativos_hoje": r["ativos"],
            "media_diaria_5d": round(media_diaria_5d, 2),
            "projecao_resto_do_mes": round(media_diaria_5d * dias_restantes, 2),
            "receita_liquida_janela": round(receita_janela.get(produto, 0), 2),
            "n_vendas_janela": n_vendas_janela.get(produto, 0),
            "gasto_estimado_mesma_janela": round(media_diaria_5d * 30, 2),
            "aviso_gasto_estimado": ("Estimativa a partir do ritmo dos últimos 5 dias (gasto_5d, "
                                      "confiável, por número do card), não é soma de gasto real "
                                      "dos últimos 30 dias, esse dado não existe com precisão no "
                                      "Tracker hoje (ver nota técnica)." if r["ativos"] else
                                      "Nenhum anúncio ativo hoje, sem ritmo pra projetar."),
            "gasto_vida_ativos": round(gasto_vida_ativos, 2),
            "receita_vida_ativos": round(receita_vida, 2),
            "n_vendas_vida_ativos_hotmart": n_vendas_vida_ativos.get(produto, 0),
            "vendas_total_vida_ativos_meta": r["vendas_total_ativos"],
            "roas_vida_ativos": round(receita_vida / gasto_vida_ativos, 2) if gasto_vida_ativos else None,
        }

    # ---------- Honestidade de datas: janela exata por período + frescor do dado ----------
    todas_insights_ativos = list(insights_idx.values())
    janelas = {p: janela_declarada(todas_insights_ativos, p) for p in ("7d", "30d", "maximum")}

    timestamps_sync = [r.get("atualizado_em") for r in bruto["insights_cache"] if r.get("atualizado_em")]
    ultimo_sync_iso = max(timestamps_sync) if timestamps_sync else None
    frescor = {"ultimo_sync": None, "horas_desde_sync": None, "pode_estar_desatualizado": None}
    if ultimo_sync_iso:
        ultimo_sync = datetime.fromisoformat(ultimo_sync_iso.replace("Z", "+00:00"))
        agora = datetime.now(timezone.utc)
        horas = (agora - ultimo_sync).total_seconds() / 3600
        frescor = {
            "ultimo_sync": ultimo_sync.astimezone(BR).strftime("%d/%m %H:%M"),
            "horas_desde_sync": round(horas, 1),
            "pode_estar_desatualizado": horas > SYNC_CICLO_HORAS * 1.5,
        }

    # ---------- Leitura VTSD (contagem de apoio; a interpretação de negócio é feita na narração) ----------
    contagem_leitura = Counter(f.get("leitura_vtsd") for f in funil_rows if f.get("leitura_vtsd"))
    leitura_vtsd = {
        "esgotou": contagem_leitura.get("esgotou", 0),
        "nunca_decolou": contagem_leitura.get("nunca_decolou", 0),
        "sem_comparacao_confiavel": contagem_leitura.get("sem_comparacao_confiavel", 0),
        "aviso_hot_cold": ("O Tracker não sincroniza o público/segmentação de cada conjunto "
                            "(HOT/COLD/SUPERCOLD), só métrica agregada do anúncio. Não é possível "
                            "classificar temperatura de público com este dado, só o funil e a "
                            "fadiga do criativo."),
    }

    saida = {
        "gerado_em": bruto["gerado_em"],
        "gerado_em_brasilia": datetime.fromisoformat(bruto["gerado_em"]).astimezone(BR).strftime("%d/%m/%Y %H:%M"),
        "janelas_declaradas": janelas,
        "frescor_dos_dados": frescor,
        "leitura_vtsd": leitura_vtsd,
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
            "cobertura_arquivados": f"Varre todo o histórico: {len(bruto['ads_arquivados_recentes'])} arquivados.",
        },
        "orcamento_receita": {
            "janela_vendas": f'{fmt_br_data(bruto["janela_vendas_desde"])} a {hoje.strftime("%d/%m")}',
            "receita_sem_atribuicao_na_janela": round(receita_janela.get("sem_atribuicao", 0), 2),
            "por_produto": projecao,
            "dias_restantes_no_mes": dias_restantes,
        },
    }
    print(json.dumps(saida, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
