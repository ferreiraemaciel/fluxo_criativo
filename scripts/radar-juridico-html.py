#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Converte um relatório do Radar Jurídico (markdown) em HTML de leitura.

Uso:
    python3 scripts/radar-juridico-html.py radar-juridico/relatorios/2026-07-30.md

Gera o .html irmão, no mesmo caminho. O HTML é autossuficiente (CSS embutido,
zero dependência externa), respeita tema claro e escuro do sistema e foi feito
para leitura corrida, não para impressão de código.

O parser espera a estrutura fixa definida em .claude/agents/radar-juridico-fotografia.md.
Seção ausente é ignorada sem quebrar.
"""

import html
import re
import sys
from pathlib import Path

# ──────────────────────────────────────────────────────────────
# Formatação inline
# ──────────────────────────────────────────────────────────────

URL_RE = re.compile(r'https?://[^\s<>"\)\]]+')


def inline(texto: str) -> str:
    """Escapa HTML e reaplica negrito, links e aspas tipográficas."""
    out = html.escape(texto, quote=False)
    out = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', out)
    out = URL_RE.sub(
        lambda m: f'<a href="{m.group(0)}" target="_blank" rel="noopener">{encurtar(m.group(0))}</a>',
        out,
    )
    return out


def encurtar(url: str, limite: int = 52) -> str:
    limpa = re.sub(r'^https?://(www\.)?', '', url).rstrip('/')
    return limpa if len(limpa) <= limite else limpa[: limite - 1] + '…'


def dominio(url: str) -> str:
    m = re.match(r'^https?://(www\.)?([^/]+)', url)
    return m.group(2) if m else url


# ──────────────────────────────────────────────────────────────
# Parser
# ──────────────────────────────────────────────────────────────


def parse(md: str) -> dict:
    linhas = md.splitlines()
    doc = {'titulo': '', 'periodo': '', 'escopo': '', 'secoes': []}
    secao_atual = None

    for linha in linhas:
        crua = linha.rstrip()
        seco = crua.strip()

        if seco.startswith('# ') and not doc['titulo']:
            doc['titulo'] = seco[2:].strip()
            continue
        if seco.startswith('Período varrido:'):
            doc['periodo'] = seco.split(':', 1)[1].strip()
            continue
        if seco.startswith('Escopo:'):
            doc['escopo'] = seco.split(':', 1)[1].strip()
            continue
        if seco.startswith('## '):
            secao_atual = {'titulo': seco[3:].strip(), 'blocos': []}
            doc['secoes'].append(secao_atual)
            continue
        if secao_atual is None:
            continue
        secao_atual['blocos'].append(crua)

    for secao in doc['secoes']:
        secao['conteudo'] = parse_secao(secao['titulo'], secao['blocos'])

    return doc


def numero_secao(titulo: str) -> str:
    m = re.match(r'^(\d+)\.', titulo.strip())
    return m.group(1) if m else ''


def parse_secao(titulo: str, linhas: list) -> dict:
    """Identifica a seção pelo título, não pelo número.

    A numeração muda quando uma seção entra ou sai do relatório, então
    depender dela quebraria o parser a cada mudança de estrutura.
    """
    t = titulo.lower()
    if 'decis' in t and 'caso' in t:
        return {'tipo': 'casos', 'itens': parse_casos(linhas)}
    if 'pauta' in t:
        return {'tipo': 'pautas', 'itens': parse_pautas(linhas)}
    if 'nada relevante' in t:
        return {'tipo': 'vazios', 'itens': parse_lista(linhas)}
    return {'tipo': 'blocos', 'blocos': parse_blocos(linhas)}


def parse_blocos(linhas: list) -> list:
    """Parser genérico: parágrafo, tabela, lista e citação, em qualquer ordem.

    Usado em toda seção que não tem tratamento próprio, para que seções novas
    apareçam formatadas sem precisar mexer no script.
    """
    blocos, buffer, tabela, lista, citacao = [], [], [], [], []

    def fechar_paragrafo():
        nonlocal buffer
        if buffer:
            blocos.append({'tipo': 'p', 'texto': ' '.join(buffer)})
            buffer = []

    def fechar_tabela():
        nonlocal tabela
        if tabela:
            blocos.append({'tipo': 'tabela', 'cabecalho': tabela[0], 'linhas': tabela[1:]})
            tabela = []

    def fechar_lista():
        nonlocal lista
        if lista:
            blocos.append({'tipo': 'lista', 'itens': lista})
            lista = []

    def fechar_citacao():
        nonlocal citacao
        if citacao:
            blocos.append({'tipo': 'citacao', 'texto': ' '.join(citacao)})
            citacao = []

    def fechar_tudo():
        fechar_paragrafo()
        fechar_tabela()
        fechar_lista()
        fechar_citacao()

    for linha in linhas:
        seco = linha.strip()

        if not seco or seco == '---':
            fechar_tudo()
            continue

        if seco.startswith('|'):
            fechar_paragrafo()
            fechar_lista()
            fechar_citacao()
            celulas = [c.strip() for c in seco.strip('|').split('|')]
            if all(re.fullmatch(r':?-{2,}:?', c) for c in celulas):
                continue
            tabela.append(celulas)
            continue

        if seco.startswith('>'):
            fechar_paragrafo()
            fechar_tabela()
            fechar_lista()
            citacao.append(seco.lstrip('> ').strip())
            continue

        if seco.startswith('- '):
            fechar_paragrafo()
            fechar_tabela()
            fechar_citacao()
            lista.append(seco[2:].strip())
            continue

        fechar_tabela()
        fechar_lista()
        fechar_citacao()
        buffer.append(seco)

    fechar_tudo()
    return blocos


def parse_lista(linhas: list) -> list:
    itens, atual = [], None
    for linha in linhas:
        seco = linha.strip()
        if seco.startswith('- '):
            if atual:
                itens.append(atual)
            atual = seco[2:].strip()
        elif seco and atual:
            atual += ' ' + seco
        elif not seco and atual:
            itens.append(atual)
            atual = None
    if atual:
        itens.append(atual)
    return itens


def parse_casos(linhas: list) -> list:
    casos, atual, campo = [], None, None
    for linha in linhas:
        seco = linha.strip()
        if seco.startswith('### '):
            if atual:
                casos.append(atual)
            atual = {'titulo': seco[4:].strip(), 'campos': []}
            campo = None
            continue
        if atual is None:
            continue
        m = re.match(r'^-\s+\*\*(.+?):\*\*\s*(.*)$', seco)
        if m:
            campo = {'rotulo': m.group(1).strip(), 'valor': m.group(2).strip()}
            atual['campos'].append(campo)
            continue
        if seco and campo:
            campo['valor'] += ' ' + seco
        elif not seco:
            campo = None
    if atual:
        casos.append(atual)
    return casos


def parse_pautas(linhas: list) -> list:
    pautas, atual = [], None
    cabecalho_re = re.compile(r'^\*\*(\d+)\.\s*(.+?)\s*\(prioridade\s+(\w+)\)\*\*$', re.I)

    for linha in linhas:
        seco = linha.strip()
        m = cabecalho_re.match(seco)
        if m:
            if atual:
                pautas.append(atual)
            atual = {
                'ordem': m.group(1),
                'titulo': m.group(2),
                'prioridade': m.group(3).lower(),
                'campos': [],
            }
            continue
        if atual is None or not seco:
            continue
        m2 = re.match(r'^(Ângulo|Formato|Por que agora):\s*(.*)$', seco)
        if m2:
            atual['campos'].append({'rotulo': m2.group(1), 'valor': m2.group(2)})
        elif atual['campos']:
            atual['campos'][-1]['valor'] += ' ' + seco
    if atual:
        pautas.append(atual)
    return pautas


# ──────────────────────────────────────────────────────────────
# Render
# ──────────────────────────────────────────────────────────────

CAMPO_ICONE = {
    'O que aconteceu': 'fato',
    'Quem ganhou': 'placar',
    'Base legal': 'lei',
    'Tribunal e data': 'foro',
    'Potencial de conteúdo': 'potencial',
    'Íntegra lida': 'integra',
    'Íntegra arquivada': 'integra',
    'Vale aprofundar': 'aprofundar',
    'Força como precedente': 'precedente',
    'O que a íntegra revela': 'revela',
    'Onde a decisão é frágil': 'fragil',
    'Fonte': 'fonte',
    'Por que importa pro fotógrafo': 'importa',
    'Cuidado ao produzir conteúdo': 'cuidado',
    'Gancho de conteúdo': 'gancho',
}


def render_campos(campos: list) -> str:
    linhas = []
    for c in campos:
        chave = CAMPO_ICONE.get(c['rotulo'], 'padrao')
        if chave == 'fonte':
            urls = URL_RE.findall(c['valor'])
            if urls:
                linhas.append(
                    f'<div class="campo campo--fonte"><span class="rotulo">Fonte</span>'
                    f'<span class="valor"><a class="btn-fonte" href="{urls[0]}" target="_blank" '
                    f'rel="noopener">{html.escape(dominio(urls[0]))}<span class="seta">↗</span></a></span></div>'
                )
                continue
        classe = f'campo campo--{chave}'
        linhas.append(
            f'<div class="{classe}"><span class="rotulo">{html.escape(c["rotulo"])}</span>'
            f'<span class="valor">{inline(c["valor"])}</span></div>'
        )
    return '\n'.join(linhas)


def render_casos(itens: list) -> str:
    if not itens:
        return '<p class="vazio">Nenhum caso no período.</p>'
    partes = []
    for i, caso in enumerate(itens, 1):
        partes.append(
            f'''<article class="caso">
  <header class="caso-head">
    <span class="caso-num">{i:02d}</span>
    <h3>{inline(caso["titulo"])}</h3>
  </header>
  <div class="caso-corpo">
    {render_campos(caso["campos"])}
  </div>
</article>'''
        )
    return '\n'.join(partes)


def render_pautas(itens: list) -> str:
    if not itens:
        return '<p class="vazio">Nenhuma pauta sugerida.</p>'
    partes = []
    for p in itens:
        campos = ''.join(
            f'<div class="pauta-campo"><span class="rotulo">{html.escape(c["rotulo"])}</span>'
            f'<span class="valor">{inline(c["valor"])}</span></div>'
            for c in p['campos']
        )
        partes.append(
            f'''<article class="pauta pauta--{html.escape(p["prioridade"])}">
  <header>
    <span class="pauta-ordem">{html.escape(p["ordem"])}</span>
    <h3>{inline(p["titulo"])}</h3>
    <span class="badge badge--{html.escape(p["prioridade"])}">prioridade {html.escape(p["prioridade"])}</span>
  </header>
  <div class="pauta-corpo">{campos}</div>
</article>'''
        )
    return '\n'.join(partes)


def render_vazios(itens: list) -> str:
    lis = ''.join(f'<li>{inline(i)}</li>' for i in itens)
    return (
        f'<details class="vazios"><summary>Temas buscados que vieram vazios '
        f'<span class="contador">{len(itens)}</span></summary><ul>{lis}</ul></details>'
    )


def render_blocos(blocos: list) -> str:
    partes = []
    for b in blocos:
        if b['tipo'] == 'p':
            partes.append(f'<p>{inline(b["texto"])}</p>')
        elif b['tipo'] == 'lista':
            lis = ''.join(f'<li>{inline(i)}</li>' for i in b['itens'])
            partes.append(f'<ul class="lista">{lis}</ul>')
        elif b['tipo'] == 'citacao':
            partes.append(f'<blockquote class="citacao">{inline(b["texto"])}</blockquote>')
        elif b['tipo'] == 'tabela':
            partes.append(render_tabela(b['cabecalho'], b['linhas']))
    return '\n'.join(partes)


def render_tabela(cabecalho: list, linhas: list) -> str:
    cab = ''.join(f'<th>{inline(x)}</th>' for x in cabecalho)
    corpo = []
    for linha in linhas:
        celulas = []
        for idx, cel in enumerate(linha):
            classe = ''
            if idx == len(linha) - 1 and '%' in cel:
                classe = ' class="neg"' if cel.strip().startswith('-') else ' class="pos"'
            elif idx >= 2 and re.fullmatch(r'[\d.,]+', cel.strip()):
                classe = ' class="num"'
            elif idx == 0:
                classe = ' class="rot"'
            celulas.append(f'<td{classe}>{inline(cel)}</td>')
        corpo.append('<tr>' + ''.join(celulas) + '</tr>')
    return (
        '<div class="tabela-wrap"><table><thead><tr>'
        + cab
        + '</tr></thead><tbody>'
        + ''.join(corpo)
        + '</tbody></table></div>'
    )


def render_secao(secao: dict) -> str:
    c = secao['conteudo']
    tipo = c['tipo']
    if tipo == 'casos':
        corpo = render_casos(c['itens'])
    elif tipo == 'pautas':
        corpo = render_pautas(c['itens'])
    elif tipo == 'vazios':
        corpo = render_vazios(c['itens'])
    else:
        corpo = render_blocos(c['blocos'])

    titulo = secao['titulo']
    n = numero_secao(titulo)
    rotulo = re.sub(r'^\d+\.\s*', '', titulo)
    marcador = f'<span class="sec-num">{n}</span>' if n else ''
    return f'''<section class="secao">
  <h2>{marcador}{inline(rotulo)}</h2>
  {corpo}
</section>'''


def contar_casos(doc: dict) -> int:
    for s in doc['secoes']:
        if s['conteudo']['tipo'] == 'casos':
            return len(s['conteudo']['itens'])
    return 0


def contar_pautas(doc: dict) -> int:
    for s in doc['secoes']:
        if s['conteudo']['tipo'] == 'pautas':
            return len(s['conteudo']['itens'])
    return 0


CSS = """
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#f6f5f2; --superficie:#fff; --borda:#e2ded6; --borda-forte:#cfc9bd;
  --tinta:#1c1a17; --tinta-media:#5a544b; --tinta-fraca:#8b8378;
  --acento:#9a6b1f; --acento-suave:#f5ecd9; --acento-borda:#e4d4b0;
  --neg:#a4462f; --pos:#2f6b4f;
  --sombra:0 1px 2px rgba(28,26,23,.05),0 8px 24px -12px rgba(28,26,23,.14);
  --raio:14px;
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#141311; --superficie:#1c1b18; --borda:#2e2b26; --borda-forte:#3d3931;
    --tinta:#ece8e1; --tinta-media:#a9a296; --tinta-fraca:#7d766b;
    --acento:#d5a44f; --acento-suave:#2a2318; --acento-borda:#4a3c22;
    --neg:#d97b60; --pos:#6fb392;
    --sombra:0 1px 2px rgba(0,0,0,.3),0 8px 24px -12px rgba(0,0,0,.6);
  }
}
html{-webkit-text-size-adjust:100%}
body{
  margin:0; background:var(--bg); color:var(--tinta);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
  font-size:16.5px; line-height:1.62; letter-spacing:-.003em;
  -webkit-font-smoothing:antialiased;
}
.pagina{max-width:820px;margin:0 auto;padding:0 24px 96px}

/* Cabeçalho */
.capa{padding:64px 0 40px;border-bottom:1px solid var(--borda)}
.selo{
  display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:650;
  letter-spacing:.14em;text-transform:uppercase;color:var(--acento);
  background:var(--acento-suave);border:1px solid var(--acento-borda);
  padding:6px 12px;border-radius:999px;margin-bottom:22px;
}
.selo .ponto{width:6px;height:6px;border-radius:50%;background:var(--acento)}
h1{font-size:clamp(29px,5vw,42px);line-height:1.14;margin:0 0 22px;letter-spacing:-.028em;font-weight:700}
.meta{display:flex;flex-wrap:wrap;gap:10px}
.meta-item{
  font-size:13px;color:var(--tinta-media);background:var(--superficie);
  border:1px solid var(--borda);border-radius:8px;padding:7px 12px;
}
.meta-item b{color:var(--tinta);font-weight:600}

/* Placar */
.placar{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:32px 0 0}
.placar-item{
  background:var(--superficie);border:1px solid var(--borda);border-radius:var(--raio);
  padding:18px 20px;box-shadow:var(--sombra);
}
.placar-num{display:block;font-size:32px;font-weight:700;line-height:1;letter-spacing:-.03em}
.placar-rot{display:block;margin-top:7px;font-size:12.5px;color:var(--tinta-fraca);
  text-transform:uppercase;letter-spacing:.07em;font-weight:600}

/* Seções */
.secao{margin-top:56px;scroll-margin-top:24px}
.secao h2{
  display:flex;align-items:center;gap:12px;font-size:13px;font-weight:700;
  letter-spacing:.13em;text-transform:uppercase;color:var(--tinta-media);
  margin:0 0 22px;padding-bottom:14px;border-bottom:1px solid var(--borda);
}
.sec-num{
  display:inline-grid;place-items:center;width:22px;height:22px;border-radius:6px;
  background:var(--tinta);color:var(--bg);font-size:11px;letter-spacing:0;flex:none;
}
.secao p{margin:0 0 15px;color:var(--tinta-media)}
.secao p:last-child{margin-bottom:0}
.secao a{color:var(--acento);text-decoration:none;border-bottom:1px solid var(--acento-borda);
  word-break:break-word}
.secao a:hover{border-bottom-color:var(--acento)}
.vazio{color:var(--tinta-fraca);font-style:italic}

/* Casos */
.caso{
  background:var(--superficie);border:1px solid var(--borda);border-radius:var(--raio);
  box-shadow:var(--sombra);margin-bottom:18px;overflow:hidden;
}
.caso-head{display:flex;gap:14px;align-items:flex-start;padding:22px 24px 18px;
  border-bottom:1px solid var(--borda)}
.caso-num{
  font-size:11.5px;font-weight:700;color:var(--acento);background:var(--acento-suave);
  border:1px solid var(--acento-borda);border-radius:7px;padding:4px 8px;flex:none;margin-top:3px;
  font-variant-numeric:tabular-nums;
}
.caso-head h3{margin:0;font-size:20.5px;line-height:1.3;letter-spacing:-.02em;font-weight:670}
.caso-corpo{padding:6px 24px 22px}
.campo{padding:14px 0;border-bottom:1px solid var(--borda)}
.campo:last-child{border-bottom:0;padding-bottom:2px}
.campo .rotulo{
  display:block;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:var(--tinta-fraca);margin-bottom:5px;
}
.campo .valor{display:block;color:var(--tinta-media)}
.campo--placar .valor,.campo--importa .valor{color:var(--tinta)}
.campo--importa{background:var(--acento-suave);margin:14px -24px 0;padding:16px 24px;
  border-top:1px solid var(--acento-borda);border-bottom:0}
.campo--importa .rotulo{color:var(--acento)}
.campo--revela .valor{color:var(--tinta)}
.campo--potencial{background:var(--acento-suave);margin:0 -24px;padding:16px 24px;
  border-top:1px solid var(--acento-borda);border-bottom:1px solid var(--acento-borda)}
.campo--potencial .rotulo{color:var(--acento)}
.campo--potencial .valor{color:var(--tinta)}
.campo--potencial .valor strong:first-of-type{font-size:19px;letter-spacing:-.02em}
.campo--aprofundar{background:var(--acento-suave);margin:0 -24px;padding:14px 24px;
  border-bottom:0}
.campo--aprofundar .rotulo{color:var(--acento)}
.campo--aprofundar .valor{color:var(--tinta)}
.campo--precedente .valor{color:var(--tinta)}
.campo--fragil{border-left:3px solid var(--neg);padding-left:14px;
  margin-left:-17px;background:transparent}
.campo--fragil .rotulo{color:var(--neg)}
.campo--fragil .valor{color:var(--tinta)}
.campo--cuidado{border-left:3px solid var(--neg);padding-left:14px;margin-left:-17px}
.campo--cuidado .rotulo{color:var(--neg)}
.campo--cuidado .valor{color:var(--tinta)}
.campo--gancho{background:var(--acento-suave);margin:0 -24px;padding:16px 24px 18px;
  border-bottom:0}
.campo--gancho .rotulo{color:var(--acento)}
.campo--gancho .valor{color:var(--tinta)}
.btn-fonte{
  display:inline-flex;align-items:center;gap:7px;font-size:13.5px;font-weight:560;
  border:1px solid var(--borda-forte)!important;border-radius:8px;padding:7px 12px;
  color:var(--tinta-media)!important;text-decoration:none;
}
.btn-fonte:hover{border-color:var(--acento)!important;color:var(--acento)!important}
.btn-fonte .seta{font-size:11px;opacity:.65}

/* Tabela */
.tabela-wrap{overflow-x:auto;border:1px solid var(--borda);border-radius:var(--raio);
  background:var(--superficie);box-shadow:var(--sombra);margin-bottom:20px}
table{border-collapse:collapse;width:100%;min-width:520px;font-size:14.5px}
th{
  text-align:left;font-size:11px;letter-spacing:.09em;text-transform:uppercase;
  color:var(--tinta-fraca);font-weight:700;padding:13px 16px;
  border-bottom:1px solid var(--borda-forte);white-space:nowrap;
}
td{padding:12px 16px;border-bottom:1px solid var(--borda);color:var(--tinta-media)}
tbody tr:last-child td{border-bottom:0}
tbody tr:hover td{background:var(--acento-suave)}
td.num,td.neg,td.pos{text-align:right;font-variant-numeric:tabular-nums}
td.neg{color:var(--neg);font-weight:600}
td.pos{color:var(--pos);font-weight:600}
td.rot{color:var(--tinta);font-weight:600}

/* Blocos genéricos */
.lista{margin:0 0 15px;padding-left:22px;color:var(--tinta-media)}
.lista li{margin-bottom:8px}
.citacao{
  margin:20px 0 0;padding:18px 22px;background:var(--acento-suave);
  border:1px solid var(--acento-borda);border-radius:var(--raio);
  color:var(--tinta);font-size:16px;
}

/* Nota */
.nota{
  background:var(--superficie);border:1px solid var(--borda);border-left:3px solid var(--acento);
  border-radius:10px;padding:16px 20px;margin-top:20px;
}
.nota-rotulo{display:block;font-size:11px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--acento);margin-bottom:6px}
.nota p{margin:0;font-size:14.5px}

/* Pautas */
.pauta{
  background:var(--superficie);border:1px solid var(--borda);border-radius:var(--raio);
  box-shadow:var(--sombra);margin-bottom:16px;overflow:hidden;
}
.pauta header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
  padding:20px 24px 16px;border-bottom:1px solid var(--borda)}
.pauta-ordem{
  display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;
  background:var(--tinta);color:var(--bg);font-size:12.5px;font-weight:700;flex:none;
}
.pauta header h3{margin:0;font-size:18.5px;line-height:1.3;letter-spacing:-.018em;
  font-weight:660;flex:1 1 240px}
.badge{
  font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
  padding:5px 10px;border-radius:999px;border:1px solid;flex:none;
}
.badge--alta{color:var(--neg);border-color:var(--neg);background:transparent}
.badge--média,.badge--media{color:var(--tinta-fraca);border-color:var(--borda-forte)}
.badge--baixa{color:var(--tinta-fraca);border-color:var(--borda-forte)}
.pauta-corpo{padding:6px 24px 20px}
.pauta-campo{padding:13px 0;border-bottom:1px solid var(--borda)}
.pauta-campo:last-child{border-bottom:0;padding-bottom:2px}
.pauta-campo .rotulo{display:block;font-size:11px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--tinta-fraca);margin-bottom:5px}
.pauta-campo .valor{display:block;color:var(--tinta-media)}

/* Vazios */
.vazios{background:var(--superficie);border:1px solid var(--borda);border-radius:var(--raio)}
.vazios summary{
  cursor:pointer;padding:16px 20px;font-size:14px;font-weight:600;color:var(--tinta-media);
  display:flex;align-items:center;gap:10px;list-style:none;
}
.vazios summary::-webkit-details-marker{display:none}
.vazios summary::before{content:"›";font-size:19px;color:var(--tinta-fraca);
  transition:transform .18s ease;display:inline-block}
.vazios[open] summary::before{transform:rotate(90deg)}
.contador{font-size:11.5px;font-weight:700;color:var(--tinta-fraca);
  border:1px solid var(--borda-forte);border-radius:999px;padding:2px 8px}
.vazios ul{margin:0;padding:0 24px 20px 46px;color:var(--tinta-media);font-size:14.5px}
.vazios li{margin-bottom:9px}
.vazios li:last-child{margin-bottom:0}

/* Rodapé */
.rodape{margin-top:64px;padding-top:24px;border-top:1px solid var(--borda);
  font-size:12.5px;color:var(--tinta-fraca);display:flex;justify-content:space-between;
  gap:16px;flex-wrap:wrap}

@media (max-width:600px){
  body{font-size:16px}
  .pagina{padding:0 18px 64px}
  .capa{padding:40px 0 30px}
  .caso-head,.caso-corpo,.pauta header,.pauta-corpo{padding-left:18px;padding-right:18px}
  .campo--importa,.campo--gancho{margin-left:-18px;margin-right:-18px;
    padding-left:18px;padding-right:18px}
}
@media print{
  body{background:#fff}
  .caso,.pauta,.tabela-wrap,.nota{box-shadow:none;break-inside:avoid}
  .vazios{display:none}
}
"""


def render(doc: dict, origem: Path) -> str:
    secoes = '\n'.join(render_secao(s) for s in doc['secoes'])
    n_casos = contar_casos(doc)
    n_pautas = contar_pautas(doc)

    placar = f'''<div class="placar">
  <div class="placar-item"><span class="placar-num">{n_casos}</span>
    <span class="placar-rot">{"caso novo" if n_casos == 1 else "casos novos"}</span></div>
  <div class="placar-item"><span class="placar-num">{n_pautas}</span>
    <span class="placar-rot">{"pauta sugerida" if n_pautas == 1 else "pautas sugeridas"}</span></div>
</div>'''

    titulo_limpo = re.sub(r'\s*[—–-]\s*', ' · ', doc['titulo'])
    titulo_h1 = re.sub(r'^Radar Jurídico da Fotografia\s*[—–-]\s*', '', doc['titulo'])
    titulo_h1 = inline(titulo_h1) if titulo_h1 else inline(doc['titulo'])

    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(titulo_limpo)}</title>
<style>{CSS}</style>
</head>
<body>
<div class="pagina">
  <header class="capa">
    <span class="selo"><span class="ponto"></span>Radar Jurídico da Fotografia</span>
    <h1>{titulo_h1}</h1>
    <div class="meta">
      <span class="meta-item">Período varrido <b>{html.escape(doc["periodo"])}</b></span>
      <span class="meta-item">Escopo <b>{html.escape(doc["escopo"])}</b></span>
    </div>
    {placar}
  </header>
  {secoes}
  <footer class="rodape">
    <span>Gerado a partir de {html.escape(origem.name)}</span>
    <span>Fontes oficiais e API pública DataJud (CNJ)</span>
  </footer>
</div>
</body>
</html>'''


def main() -> int:
    if len(sys.argv) < 2:
        print('Uso: python3 scripts/radar-juridico-html.py <relatorio.md>')
        return 1

    origem = Path(sys.argv[1]).expanduser().resolve()
    if not origem.exists():
        print(f'Arquivo não encontrado: {origem}')
        return 1

    doc = parse(origem.read_text(encoding='utf-8'))
    destino = origem.with_suffix('.html')
    destino.write_text(render(doc, origem), encoding='utf-8')

    print(f'HTML gerado: {destino}')
    print(f'Casos: {contar_casos(doc)} | Pautas: {contar_pautas(doc)} | Seções: {len(doc["secoes"])}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
