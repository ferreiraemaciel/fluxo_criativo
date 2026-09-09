#!/usr/bin/env python3
"""
Renderiza o JSON já calculado por processar_analise.py num dashboard HTML
autocontido (sem dependência externa além de Google Fonts). Zero geração de
texto por IA aqui, é tudo template + dado, pra poder rodar todo dia sem custo.

É um painel operacional interno, não uma página de vendas, por isso não segue
o design system de VTSD (paginas/design-system-components.md) — mesma
exceção que já vale pro painel-entregas.html e pros outros dashboards do
projeto (instagram-dashboard, tiktok-dashboard). Reaproveita a mesma paleta
escura desses dashboards (ver .claude/skills/instagram-dashboard/scripts/atualizar.py)
pra manter consistência visual entre os painéis do Workshop.

Uso: python3 gerar_relatorio_html.py --in /tmp/tracker-analise-processado.json --out caminho.html
"""
import argparse, json
from pathlib import Path


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--in", dest="entrada", required=True)
    p.add_argument("--out", dest="saida", required=True)
    return p.parse_args()


def money(v):
    if v is None:
        return "-"
    return f"R$ {v:,.2f}".replace(",", "_").replace(".", ",").replace("_", ".")


def pct(v, casas=1):
    if v is None:
        return "-"
    return f"{v * 100:.{casas}f}%"


CSS = """
:root{
  --ink-0:#000000;--ink-1:#0a0a0a;--ink-2:#111111;--ink-3:#141414;--ink-4:#1a1a1a;
  --line-1:#1a1a1a;--line-2:#252525;--line-3:#303030;
  --text-hi:#ffffff;--text-mid:#e8e8e6;--text-dim:#cfcfcb;--text-faint:#a8a8a3;
  --neon:#c4ff5e;--good:#c4ff5e;--warn:#ffb84d;--bad:#ff6a6a;--info:#7aa8c9;
}
*{box-sizing:border-box}
body{font-family:'Space Grotesk','Inter',sans-serif;background:var(--ink-0);color:var(--text-mid);margin:0}
.wrap{max-width:1160px;margin:0 auto;padding:24px 16px 60px}
.hdr{background:var(--ink-2);border-top:2px solid var(--neon);border-bottom:1px solid var(--line-2);padding:22px 24px;margin-bottom:22px}
.hdr h1{font-size:20px;font-weight:700;color:var(--text-hi);margin:0}
.hdr .meta{font-size:12px;color:var(--text-faint);margin-top:8px;font-family:'JetBrains Mono',monospace;line-height:1.7}
.hdr .stale{color:var(--warn)}
.sec{margin-bottom:28px}
.sec h2{font-size:14px;font-weight:700;color:var(--text-hi);text-transform:uppercase;letter-spacing:.5px;
  border-left:3px solid var(--neon);padding-left:10px;margin:0 0 12px}
.card{background:var(--ink-2);border-top:2px solid var(--line-3);border-bottom:1px solid var(--line-2);padding:18px;margin-bottom:12px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:8px}
.kpi{background:var(--ink-2);border-top:2px solid var(--line-3);border-bottom:1px solid var(--line-2);padding:16px}
.kpi-lbl{font-size:10px;font-weight:600;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;font-family:'JetBrains Mono',monospace}
.kpi-val{font-size:24px;font-weight:700;margin-top:4px;color:var(--text-hi)}
.kpi-sub{font-size:11px;color:var(--text-faint);margin-top:2px}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.4px;
  font-family:'JetBrains Mono',monospace;padding:8px 10px;border-bottom:1px solid var(--line-3)}
td{padding:9px 10px;border-bottom:1px solid var(--line-1);color:var(--text-dim)}
tr:hover td{background:var(--ink-3)}
.tag{display:inline-block;padding:2px 8px;font-size:10px;font-weight:700;border:1px solid;
  font-family:'JetBrains Mono',monospace;white-space:nowrap}
.t-good{color:var(--good);border-color:var(--good)}
.t-warn{color:var(--warn);border-color:var(--warn)}
.t-bad{color:var(--bad);border-color:var(--bad)}
.t-info{color:var(--info);border-color:var(--info)}
.empty{color:var(--text-faint);font-size:13px;font-style:italic;padding:6px 0}
.footer{color:var(--text-faint);font-size:11px;text-align:center;margin-top:30px;font-family:'JetBrains Mono',monospace}
.produto-h{font-size:12px;font-weight:700;color:var(--neon);font-family:'JetBrains Mono',monospace;margin:14px 0 6px}
"""


def kpi(label, valor, sub=""):
    return (f'<div class="kpi"><div class="kpi-lbl">{label}</div>'
            f'<div class="kpi-val">{valor}</div><div class="kpi-sub">{sub}</div></div>')


def tag(texto, classe):
    return f'<span class="tag {classe}">{texto}</span>'


def sec_resumo(d):
    blocos = []
    for produto, r in d.get("resumo_por_produto", {}).items():
        risco_n = len(r.get("perto_de_pausar", []))
        blocos.append(f'<div class="produto-h">{produto}</div><div class="kpi-grid">'
                       + kpi("Ativos", r["ativos"])
                       + kpi("Gasto 5d", money(r["gasto_5d"]))
                       + kpi("Vendas 5d", r["vendas_5d"])
                       + kpi("Histórico (ativos)", f'{money(r["gasto_total_ativos"])}',
                             f'{r["vendas_total_ativos"]} vendas')
                       + kpi("Perto de pausar", risco_n, "G1/G5" if risco_n else "nenhum agora")
                       + "</div>")
    if not blocos:
        blocos.append('<div class="empty">Nenhum anúncio ativo hoje.</div>')
    return f'<div class="sec"><h2>Resumo executivo</h2>{"".join(blocos)}</div>'


def sec_radar(d):
    r = d.get("radar_regras", {})
    pend = r.get("pendentes_em_ads_ativos", [])
    resolv = r.get("resolvidos_14d", [])
    ads_txt = lambda a: a["ads_numero"] if a.get("ads_numero") is not None else tag("não identificado", "t-warn")
    linhas_pend = "".join(
        f'<tr><td>{ads_txt(a)}</td><td>{a["regra_codigo"]}</td><td>{a["mensagem"]}</td></tr>'
        for a in pend
    ) or '<tr><td colspan="3" class="empty">Nenhum alerta pendente em anúncio ativo.</td></tr>'
    linhas_resolv = "".join(
        f'<tr><td>{a["created_at"][:10]}</td><td>{ads_txt(a)}</td><td>{a["regra_codigo"]}</td>'
        f'<td>{a["mensagem"]}</td></tr>'
        for a in resolv[:15]
    ) or '<tr><td colspan="4" class="empty">Nenhuma pausa automática nos últimos 14 dias.</td></tr>'
    orfaos_nota = (f'<div class="kpi-sub">{r["pendentes_orfaos_count"]} alertas órfãos no banco '
                    f'(de anúncios que já não estão ativos, não exigem ação).</div>'
                    if r.get("pendentes_orfaos_count") else "")
    return f"""<div class="sec"><h2>Radar de regras (G1 a G7)</h2>
    <div class="card"><b>Pendentes em anúncio ativo</b>{orfaos_nota}
    <table><thead><tr><th>ADS</th><th>Regra</th><th>Mensagem</th></tr></thead>
    <tbody>{linhas_pend}</tbody></table></div>
    <div class="card"><b>Pausas automáticas, últimos 14 dias</b>
    <table><thead><tr><th>Data</th><th>ADS</th><th>Regra</th><th>Mensagem</th></tr></thead>
    <tbody>{linhas_resolv}</tbody></table></div></div>"""


GARGALO_TAG = {
    "saudavel": ("saudável", "t-good"),
    "gargalo_criativo": ("criativo", "t-bad"),
    "gargalo_pagina": ("página", "t-bad"),
    "gargalo_conversao": ("oferta/copy", "t-bad"),
    "gargalo_checkout": ("checkout", "t-bad"),
    "sem_dado": ("sem dado", "t-info"),
}


def sec_funil(d):
    linhas = []
    for f in d.get("funil", []):
        txt, cls = GARGALO_TAG.get(f["gargalo"], (f["gargalo"], "t-info"))
        leitura = f' <span class="tag t-warn">{f["leitura_vtsd"]}</span>' if f.get("leitura_vtsd") else ""
        linhas.append(
            f'<tr><td>{f["numero"]}</td><td>{f["titulo"][:50]}</td><td>{f["produto"]}</td>'
            f'<td>{pct(f.get("ctr_7d"), 2)}</td><td>{tag(txt, cls)}{leitura}</td>'
            f'<td style="font-size:11px">{f["gargalo_detalhe"]}</td></tr>'
        )
    corpo = "".join(linhas) or '<tr><td colspan="6" class="empty">Sem anúncio ativo pra avaliar.</td></tr>'
    return f"""<div class="sec"><h2>Funil (janela de 7 dias)</h2><div class="card">
    <table><thead><tr><th>ADS</th><th>Título</th><th>Produto</th><th>CTR</th><th>Gargalo</th><th>Leitura</th></tr></thead>
    <tbody>{corpo}</tbody></table></div></div>"""


def sec_vtsd(d):
    v = d.get("leitura_vtsd", {})
    return f"""<div class="sec"><h2>Leitura VTSD</h2><div class="kpi-grid">
    {kpi("Urgência Oculta esgotou", v.get("esgotou", 0), "CTR caiu com o tempo")}
    {kpi("Nunca decolou", v.get("nunca_decolou", 0), "CTR baixo desde o início")}
    {kpi("Sem comparação confiável", v.get("sem_comparacao_confiavel", 0), "histórico curto demais")}
    </div><div class="card" style="font-size:12px;color:var(--text-faint)">{v.get("aviso_hot_cold", "")}</div></div>"""


def sec_fadiga_escala(d):
    fadiga = d.get("fadiga", [])
    escala = d.get("candidatos_escala", [])
    lf = "".join(
        f'<tr><td>{a["numero"]}</td><td>{a["titulo"][:45]}</td><td>{a["produto"]}</td>'
        f'<td>{a["frequencia_7d"]:.1f}</td><td>{pct(a["ctr_7d"], 2)} / {pct(a["ctr_30d"], 2)}</td></tr>'
        for a in fadiga
    ) or '<tr><td colspan="5" class="empty">Nenhum candidato a fadiga agora.</td></tr>'
    le = "".join(
        f'<tr><td>{a["numero"]}</td><td>{a["titulo"][:45]}</td><td>{a["produto"]}</td>'
        f'<td>{money(a["cpa_historico"])}</td><td>{a["vendas_total"]}</td></tr>'
        for a in escala
    ) or '<tr><td colspan="5" class="empty">Nenhum candidato a escala agora.</td></tr>'
    return f"""<div class="sec"><h2>Fadiga x candidatos a escalar</h2>
    <div class="card"><b>Fadiga (frequência alta, CTR caindo)</b>
    <table><thead><tr><th>ADS</th><th>Título</th><th>Produto</th><th>Freq.</th><th>CTR 7d / 30d</th></tr></thead>
    <tbody>{lf}</tbody></table></div>
    <div class="card"><b>Candidatos a escala (CPA baixo, histórico bom)</b>
    <table><thead><tr><th>ADS</th><th>Título</th><th>Produto</th><th>CPA histórico</th><th>Vendas</th></tr></thead>
    <tbody>{le}</tbody></table></div></div>"""


def sec_lifecycle(d):
    lc = d.get("lifecycle", {})
    antigos = lc.get("ativos_rodando_45d_ou_mais", [])
    campeoes = lc.get("campeoes_atuais", [])
    reativ = lc.get("arquivados_reativaveis", [])
    la = "".join(f'<tr><td>{a["numero"]}</td><td>{a["titulo"][:50]}</td><td>{a["produto"]}</td>'
                 f'<td>{a["dias_rodando"]}</td></tr>' for a in antigos) \
        or '<tr><td colspan="4" class="empty">Nenhum ativo há 45+ dias.</td></tr>'
    campeoes_ord = sorted(campeoes, key=lambda a: a.get("cpa_historico") or 9e9)[:15]
    lc_html = "".join(f'<tr><td>{a["numero"]}</td><td>{a["titulo"][:50]}</td><td>{a["produto"]}</td>'
                       f'<td>{money(a["cpa_historico"])}</td><td>{a["vendas_total"]}</td></tr>' for a in campeoes_ord) \
        or '<tr><td colspan="5" class="empty">Nenhum campeão hoje.</td></tr>'
    reativ_ord = sorted(reativ, key=lambda a: a.get("cpa_historico") or 9e9)[:15]
    lr = "".join(f'<tr><td>{a["numero"]}</td><td>{a["titulo"][:50]}</td><td>{a["produto"]}</td>'
                 f'<td>{a["tag"]}</td><td>{money(a["cpa_historico"])}</td></tr>' for a in reativ_ord) \
        or '<tr><td colspan="5" class="empty">Nenhum arquivado reativável.</td></tr>'
    return f"""<div class="sec"><h2>Lifecycle</h2>
    <div class="card"><b>Ativos rodando há 45+ dias sem refresh</b>
    <table><thead><tr><th>ADS</th><th>Título</th><th>Produto</th><th>Dias</th></tr></thead>
    <tbody>{la}</tbody></table></div>
    <div class="card"><b>Campeões atuais ({len(campeoes)}), top 15 por CPA</b>
    <table><thead><tr><th>ADS</th><th>Título</th><th>Produto</th><th>CPA histórico</th><th>Vendas</th></tr></thead>
    <tbody>{lc_html}</tbody></table></div>
    <div class="card"><b>Arquivados reativáveis ({len(reativ)}), top 15 por CPA</b>
    <table><thead><tr><th>ADS</th><th>Título</th><th>Produto</th><th>Tag</th><th>CPA histórico</th></tr></thead>
    <tbody>{lr}</tbody></table></div></div>"""


def sec_orcamento(d):
    o = d.get("orcamento_receita", {})
    blocos = []
    for produto, p in o.get("por_produto", {}).items():
        blocos.append(f'<div class="produto-h">{produto} ({p["ativos_hoje"]} ativo(s) hoje)</div><div class="kpi-grid">'
                       + kpi("Ritmo diário (5d)", money(p["media_diaria_5d"]))
                       + kpi("Projeção resto do mês", money(p["projecao_resto_do_mes"]),
                             f'{o.get("dias_restantes_no_mes")} dias restantes')
                       + kpi(f'Receita líquida ({o.get("janela_vendas","")})', money(p["receita_liquida_janela"]),
                             f'{p["n_vendas_janela"]} vendas, dado real')
                       + kpi("Gasto estimado, mesma janela", money(p["gasto_estimado_mesma_janela"]),
                             "estimativa a partir do ritmo 5d")
                       + kpi("ROAS, vida inteira dos ativos", f'{p["roas_vida_ativos"]}x' if p["roas_vida_ativos"] else "-",
                             f'{money(p["receita_vida_ativos"])} / {money(p["gasto_vida_ativos"])}')
                       + "</div>"
                       # Nota por PRODUTO, nunca uma nota global só do primeiro produto da lista
                       # (bug real, achado em 2026-09-09: BLI vem antes de MCV na ordenação e
                       # tem 0 ativos, então a nota de "sem ritmo pra projetar" dele aparecia
                       # embaixo do bloco do MCV, que tem 10 ativos e nota bem diferente).
                       + f'<div style="font-size:11px;color:var(--text-faint);margin:-4px 0 14px">{p["aviso_gasto_estimado"]}</div>')
    sem_atrib = o.get("receita_sem_atribuicao_na_janela")
    return f"""<div class="sec"><h2>Orçamento e receita real</h2>{"".join(blocos)}
    <div class="card" style="font-size:12px;color:var(--text-faint)">
    Receita sem atribuição a anúncio, mesma janela ({o.get("janela_vendas","")}):
    <b style="color:var(--text-dim)">{money(sem_atrib)}</b> (orgânico, direto, WhatsApp).</div></div>"""


def render(d):
    frescor = d.get("frescor_dos_dados", {})
    stale_cls = "stale" if frescor.get("pode_estar_desatualizado") else ""
    janelas = d.get("janelas_declaradas", {})
    janela_txt = " · ".join(
        f'{p}: {j["inicio"]}-{j["fim"]}' for p, j in janelas.items() if j.get("inicio")
    )
    header = f"""<div class="hdr"><h1>Análise de Campanhas — Tracker FMN</h1>
    <div class="meta">Gerado em {d.get("gerado_em_brasilia")} (horário de Brasília)<br>
    Dados sincronizados até {frescor.get("ultimo_sync", "?")}
    <span class="{stale_cls}">{" (pode estar desatualizado)" if frescor.get("pode_estar_desatualizado") else ""}</span><br>
    Janelas: {janela_txt}</div></div>"""

    corpo = (sec_resumo(d) + sec_radar(d) + sec_funil(d) + sec_vtsd(d)
             + sec_fadiga_escala(d) + sec_lifecycle(d) + sec_orcamento(d))

    footer = ('<div class="footer">Fonte: Supabase do Tracker FMN (ads, insights_cache, alertas, vendas). '
               'Sem chamada à Graph API do Meta, sem Notion. Gerado por '
               'tracker-analise-campanhas/scripts/gerar_relatorio_html.py</div>')

    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Análise de Campanhas — Tracker FMN</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head>
<body><div class="wrap">{header}{corpo}{footer}</div></body></html>"""


if __name__ == "__main__":
    args = parse_args()
    with open(args.entrada, encoding="utf-8") as f:
        dados = json.load(f)
    html = render(dados)
    Path(args.saida).write_text(html, encoding="utf-8")
    print(f"OK: {len(html)} bytes gravados em {args.saida}")
