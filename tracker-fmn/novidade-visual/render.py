#!/usr/bin/env python3
"""
Novidade de Produto: gerador da arte (formato 6 do Índice de Formatos Visuais).

Lê um arquivo de especificação (JSON), monta o HTML e renderiza o PNG 1080x1350 com o Chrome.
O quadro é fixo (marca, selo NOVIDADE, título, apoio, rodapé, 3D, textura). O que muda a cada
novidade é só o "hero" (o bloco com a tela do produto) e o texto.

Uso:
  python3 tracker-fmn/novidade-visual/render.py tracker-fmn/novidade-visual/exemplos/codigo-por-email.json
  python3 tracker-fmn/novidade-visual/render.py spec.json --saida /caminho/da/pasta

Saída: <saida>/<nome>.html e <saida>/<nome>.png, mais um relatório de conferência no terminal
(linhas do título, escala do hero, avisos). Leia IDENTIDADE-VISUAL-NOVIDADE-PRODUTO.md antes.
"""
import argparse, html, json, re, shutil, subprocess, sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# ---------------------------------------------------------------- marcas
# Cada produto tem a sua. Blindagem foi conferida pelo Felipe (15/10/2026).
# FMN Pro foi derivada do og-fmnpro.png e do app: validar na primeira peça dele.
MARCAS = {
    "blindagem": dict(
        nome="Blindagem", logo="marcas/blindagem/logo.png", logo_altura=124,
        logo_sombra="rgba(67,97,238,0.55)",
        fundo="#070a18", glow1="rgba(67,97,238,0.42)", glow2="rgba(249,182,79,0.20)", glow3="rgba(67,97,238,0.14)",
        icone_cor="#7c93ff", icone_bg="rgba(124,147,255,0.14)", icone_borda="rgba(124,147,255,0.35)",
        base_card="#0e1330", base_ouro="#0d1022", rampa=("#1b2350", "#0a0e22"),
    ),
    "fmnpro": dict(
        nome="FMN Pro", logo="marcas/fmnpro/logo.png", logo_altura=112,
        logo_sombra="rgba(249,182,79,0.35)",
        fundo="#0b0907", glow1="rgba(201,138,29,0.30)", glow2="rgba(249,182,79,0.14)", glow3="rgba(201,138,29,0.08)",
        icone_cor="#f2c26b", icone_bg="rgba(249,182,79,0.12)", icone_borda="rgba(249,182,79,0.32)",
        base_card="#15110c", base_ouro="#14100a", rampa=("#2a2118", "#0c0a07"),
    ),
}

# ---------------------------------------------------------------- ícones (traço, 24x24)
ICONES = {
    "documento": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    "email": '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7.5 8.5 6 8.5-6"/><path d="m15.5 17.5 2 2 3.5-4"/>',
    "caneta": '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14.5 7.5l3 3M12 20h8"/>',
    "calendario": '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "imagem": '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-8 8"/>',
    "check": '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    "porcentagem": '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="17" r="2.2"/>',
    "relogio": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "cadeado": '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    "pessoas": '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2A5 5 0 0 1 21 19"/>',
    "presente": '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v8h14v-8"/><path d="M12 8c-2-4-6-3-5 0 .6 1.6 5 0 5 0Zm0 0c2-4 6-3 5 0-.6 1.6-5 0-5 0Z"/>',
    "estrela": '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.4 6.4 20.3l1.1-6.2L3 9.7l6.2-.9z"/>',
    "camera": '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>',
    "elo": '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    "seta": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "sino": '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    "dinheiro": '<rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
    "painel": '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M9 9v11"/>',
    "mensagem": '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
}


def ico(nome):
    return '<svg viewBox="0 0 24 24">%s</svg>' % ICONES.get(nome or "documento", ICONES["documento"])


def esc(t):
    return html.escape(str(t if t is not None else ""), quote=False)


# ---------------------------------------------------------------- texto
def fmt_titulo(t):
    """{ouro:palavra} vira dourado, {suave:trecho} vira cinza claro. O resto é branco."""
    s = esc(t)
    s = re.sub(r"\{ouro:(.*?)\}", r'<span class="ouro">\1</span>', s)
    s = re.sub(r"\{suave:(.*?)\}", r'<span class="suave-t">\1</span>', s)
    return s


def fmt_apoio(t):
    return re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", esc(t))


def sem_marcas(t):
    return re.sub(r"\{(?:ouro|suave):(.*?)\}", r"\1", str(t))


def rampa(c1, c2, n):
    a = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    b = [int(c2[i:i + 2], 16) for i in (1, 3, 5)]
    out = []
    for k in range(n):
        f = k / max(1, n - 1)
        out.append("#%02x%02x%02x" % tuple(round(a[j] + (b[j] - a[j]) * f) for j in range(3)))
    return out


def espessura(cores, sinal=-1):
    """Camadas de box-shadow que dão espessura ao cartão, para a esquerda e para baixo."""
    return ", ".join("%dpx %dpx 0 %s" % (sinal * (i + 1), i + 1, c) for i, c in enumerate(cores))


# ---------------------------------------------------------------- hero: módulos
def hero_corrente(d):
    """Passos ligados por elos. Serve para novidade que é um fluxo ou uma sequência."""
    partes = []
    itens = d["itens"]
    for i, it in enumerate(itens):
        dest = it.get("destaque")
        extra = ""
        if it.get("codigo"):
            extra += '<div class="codigo">%s</div>' % "".join("<span>%s</span>" % esc(c) for c in str(it["codigo"]))
        if it.get("tag"):
            extra += '<div class="tags"><em>%s</em></div>' % esc(it["tag"])
        partes.append(
            '<div class="cartao%s">%s<div class="icone">%s</div><div class="texto"><b>%s</b>%s%s</div>%s</div>' % (
                " destaque" if dest else "",
                '<div class="etiqueta">%s</div>' % esc(it["etiqueta"]) if it.get("etiqueta") else "",
                ico(it.get("icone")), esc(it["titulo"]),
                "<small>%s</small>" % esc(it["sub"]) if it.get("sub") else "", extra,
                '<div class="chip">%s</div>' % esc(it["chip"]) if it.get("chip") else ""))
        if i < len(itens) - 1:
            partes.append('<div class="elo">%s</div>' % ico("elo"))
    return "".join(partes)


def hero_tela(d):
    """Uma janela do app com linhas. Serve para recurso novo numa tela ou numa configuração."""
    linhas = []
    for ln in d["linhas"]:
        ctrl = ""
        tipo = ln.get("controle", "")
        if tipo == "ligado" or tipo == "desligado":
            ctrl = '<div class="tog %s"><i></i></div>' % ("on" if tipo == "ligado" else "off")
        elif tipo == "chip":
            ctrl = '<div class="chip">%s</div>' % esc(ln.get("valor", ""))
        elif tipo == "valor":
            ctrl = '<div class="valor">%s</div>' % esc(ln.get("valor", ""))
        linhas.append(
            '<div class="linha%s">%s<div class="icone peq">%s</div><div class="texto"><b>%s</b>%s</div>%s</div>' % (
                " destaque" if ln.get("destaque") else "",
                '<div class="etiqueta">%s</div>' % esc(ln["etiqueta"]) if ln.get("etiqueta") else "",
                ico(ln.get("icone")), esc(ln["titulo"]),
                "<small>%s</small>" % esc(ln["sub"]) if ln.get("sub") else "", ctrl))
    return ('<div class="cartao janela"><div class="barra"><i></i><i></i><i></i><span>%s</span></div>'
            '<div class="linhas">%s</div></div>') % (esc(d.get("janela", "")), "".join(linhas))


def hero_lista(d):
    """Grade de cartões pequenos. Serve para modelos novos, vários recursos de uma vez."""
    cel = []
    for it in d["itens"]:
        cel.append('<div class="cartao mini%s">%s<div class="icone">%s</div><div class="texto"><b>%s</b>%s</div></div>' % (
            " destaque" if it.get("novo") else "",
            '<div class="etiqueta">%s</div>' % esc(it["etiqueta"]) if it.get("etiqueta") else "",
            ico(it.get("icone")), esc(it["titulo"]),
            "<small>%s</small>" % esc(it["sub"]) if it.get("sub") else ""))
    return '<div class="grade">%s</div>' % "".join(cel)


def hero_numero(d):
    """Um número grande no centro. Serve para desconto, prazo, economia, regra."""
    chips = "".join('<div class="passo%s">%s</div>' % (" ativo" if c.get("destaque") else "", esc(c["texto"]))
                    for c in d.get("passos", []))
    return ('<div class="cartao destaque numero"><div class="rot">%s</div><div class="grande-num">%s</div>'
            '<div class="sub-num">%s</div>%s</div>') % (
        esc(d.get("rotulo", "")), esc(d["numero"]), esc(d.get("legenda", "")),
        '<div class="passos">%s</div>' % chips if chips else "")


def hero_comparativo(d):
    """Antes e agora lado a lado. Serve para melhoria de algo que já existia."""
    def lado(x, novo):
        return ('<div class="cartao col%s">%s<div class="icone">%s</div><div class="rot">%s</div>'
                '<div class="texto"><b>%s</b>%s</div></div>') % (
            " destaque" if novo else "",
            '<div class="etiqueta">%s</div>' % esc(x["etiqueta"]) if x.get("etiqueta") else "",
            ico(x.get("icone")), esc(x.get("rotulo", "")), esc(x["titulo"]),
            "<small>%s</small>" % esc(x["sub"]) if x.get("sub") else "")
    return '<div class="duplo">%s<div class="vai">%s</div>%s</div>' % (
        lado(d["antes"], False), ico("seta"), lado(d["agora"], True))


HEROS = {"corrente": hero_corrente, "tela": hero_tela, "lista": hero_lista,
         "numero": hero_numero, "comparativo": hero_comparativo}

# ---------------------------------------------------------------- textura do fundo
def _ruido(freq, oitavas):
    return ("url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='540' height='540'>"
            "<filter id='n' x='0' y='0' width='100%%' height='100%%'><feTurbulence type='fractalNoise' "
            "baseFrequency='%s' numOctaves='%d' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter>"
            "<rect width='100%%' height='100%%' filter='url(%%23n)'/></svg>\")") % (freq, oitavas)


TEXTURAS = {
    "camurca": ("display:block; background-image:%s; background-size:540px 540px; mix-blend-mode:soft-light; opacity:.62;" % _ruido("1.15", 4)),
    "papel": ("display:block; background-image:%s,%s,%s; background-size:540px 540px,540px 540px,540px 540px; "
              "mix-blend-mode:soft-light; opacity:.55;" % (_ruido("0.75", 3), _ruido("0.014 0.02", 2), _ruido("0.9 0.06", 2))),
    "lisa": "display:none;",
}

# ---------------------------------------------------------------- CSS
CSS = r"""
:root { --fundo:{{fundo}}; --ouro:#f9b64f; --ouro-escuro:#c98a1d; --ouro-claro:#ffd48a; --branco:#f4f6ff;
  --suave:rgba(244,246,255,.62); --borda:rgba(255,255,255,.14); --icone:{{icone_cor}}; }
* { box-sizing:border-box; margin:0; padding:0; }
html, body { width:1080px; height:1350px; background:var(--fundo); }
body { font-family:"Inter","Helvetica Neue",Arial,sans-serif; color:var(--branco); -webkit-font-smoothing:antialiased; }
.arte { position:relative; width:1080px; height:1350px; overflow:hidden; display:flex; flex-direction:column; padding:56px 72px 54px;
  background: radial-gradient(900px 700px at 88% 6%, {{glow1}}, transparent 62%),
              radial-gradient(760px 620px at 4% 98%, {{glow2}}, transparent 64%),
              radial-gradient(700px 500px at 50% 46%, {{glow3}}, transparent 70%), var(--fundo); }
.arte::before { content:""; position:absolute; inset:0; pointer-events:none; {{textura}} }
.arte > * { position:relative; }

.topo { display:flex; align-items:center; justify-content:space-between; flex:none; }
.marca { display:flex; align-items:center; gap:22px; }
.marca img { height:{{logo_altura}}px; width:auto; filter:drop-shadow(0 14px 34px {{logo_sombra}}); }
.marca span { font-size:40px; font-weight:700; letter-spacing:-.02em; }
.selo { display:inline-flex; align-items:center; gap:12px; background:linear-gradient(135deg,#ffd48a,var(--ouro) 55%,var(--ouro-escuro));
  color:#1a1204; font-weight:800; font-size:26px; letter-spacing:.16em; text-transform:uppercase; padding:16px 30px; border-radius:999px;
  box-shadow:0 10px 40px rgba(249,182,79,.38), inset 0 1px 0 rgba(255,255,255,.55); }
.selo i { width:12px; height:12px; border-radius:50%; background:#1a1204; display:inline-block; }

.heroarea { flex:1; min-height:0; display:flex; align-items:center; justify-content:center; padding:6px 24px 66px; }
.hero { width:100%; max-width:888px; display:flex; flex-direction:column; align-items:stretch;
  transform:perspective(1700px) scale(var(--escala,.93)) rotateX(9deg) rotateY(11deg) rotateZ(-.8deg); transform-style:preserve-3d; transform-origin:50% 46%; }

/* cartão base, 3D com a espessura para a esquerda (lado maior na esquerda, sentido de leitura) */
.cartao { position:relative; display:flex; align-items:center; gap:26px; padding:22px 34px; min-height:98px; border-radius:28px;
  transform-style:preserve-3d; overflow:visible; border:1px solid rgba(255,255,255,.22);
  background:linear-gradient(200deg, rgba(255,255,255,.14), rgba(255,255,255,.045) 55%, rgba(255,255,255,.08)), {{base_card}};
  box-shadow:{{espessura_card}}, -26px 38px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.28); }
.cartao::after { content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; background:linear-gradient(245deg, rgba(255,255,255,.20), rgba(255,255,255,0) 38%); }
.cartao.destaque { transform:translateZ(48px); padding:34px 38px; min-height:176px; border:1.5px solid rgba(255,214,140,.95);
  background:linear-gradient(200deg, rgba(255,205,120,.34), rgba(249,182,79,.10) 60%, rgba(249,182,79,.16)), {{base_ouro}};
  box-shadow:{{espessura_ouro}}, 0 0 0 10px rgba(249,182,79,.07), -34px 50px 80px rgba(0,0,0,.65), 0 30px 110px rgba(249,182,79,.38), inset 0 1px 0 rgba(255,255,255,.4); }

.icone { flex:none; width:58px; height:58px; border-radius:18px; display:grid; place-items:center; background:{{icone_bg}}; border:1px solid {{icone_borda}};
  box-shadow:0 10px 22px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.25); transform:translateZ(22px); }
.icone svg { width:30px; height:30px; stroke:var(--icone); fill:none; stroke-width:1.9; stroke-linecap:round; stroke-linejoin:round; }
.destaque > .icone { width:76px; height:76px; border-radius:24px; background:linear-gradient(135deg,#ffd48a,var(--ouro)); border:none;
  box-shadow:0 16px 34px rgba(249,182,79,.55), 0 8px 0 #b57a1c, inset 0 2px 0 rgba(255,255,255,.6); }
.destaque > .icone svg { width:40px; height:40px; stroke:#1a1204; stroke-width:2.1; }
.icone.peq { width:50px; height:50px; border-radius:16px; }
.icone.peq svg { width:26px; height:26px; }
.texto { flex:1; min-width:0; }
.texto b { display:block; font-size:29px; font-weight:700; letter-spacing:-.015em; line-height:1.15; }
.texto small { display:block; margin-top:6px; font-size:21px; color:var(--suave); font-weight:500; line-height:1.3; }
.destaque > .texto b { font-size:35px; }
.destaque > .texto small { font-size:22px; color:rgba(244,246,255,.75); }
.chip { flex:none; font-family:"SF Mono",Menlo,Consolas,monospace; font-size:19px; color:var(--suave); padding:9px 14px; border-radius:12px;
  background:rgba(0,0,0,.28); border:1px solid var(--borda); box-shadow:0 8px 16px rgba(0,0,0,.4); transform:translateZ(16px); }
.destaque .chip { border-color:rgba(249,182,79,.5); color:#ffe3b3; }
.etiqueta { position:absolute; top:-17px; right:34px; background:var(--ouro); color:#1a1204; font-weight:800; font-size:18px; letter-spacing:.14em;
  padding:7px 16px; border-radius:999px; text-transform:uppercase; box-shadow:0 8px 22px rgba(249,182,79,.45); transform:translateZ(34px); z-index:3; }
.codigo { display:flex; gap:9px; margin-top:15px; }
.codigo span { width:46px; height:54px; border-radius:12px; display:grid; place-items:center; font-weight:800; font-size:29px; font-family:"SF Mono",Menlo,monospace;
  background:rgba(7,10,24,.72); border:1px solid rgba(249,182,79,.6); color:#ffe3b3; box-shadow:0 6px 0 rgba(120,80,20,.9), 0 12px 18px rgba(0,0,0,.5); transform:translateZ(12px); }
.tags { display:flex; gap:10px; margin-top:14px; }
.tags em { font-style:normal; font-size:17px; font-weight:600; color:#bfe7c8; background:rgba(46,160,90,.16); border:1px solid rgba(120,220,150,.35); padding:4px 12px; border-radius:999px; }

/* elo: linha contínua por TRÁS dos cartões, entrando por baixo deles (nunca por cima) */
.elo { position:relative; height:84px; display:flex; justify-content:center; align-items:center; transform-style:preserve-3d; }
.elo::before { content:""; position:absolute; top:-40px; bottom:-40px; left:50%; width:4px; margin-left:-2px; transform:translateZ(-16px);
  background:linear-gradient(180deg, rgba(249,182,79,.55), rgba(249,182,79,.95) 50%, rgba(249,182,79,.55)); }
.elo svg { position:relative; width:36px; height:36px; padding:7px; border-radius:50%; background:var(--fundo); border:1px solid rgba(249,182,79,.7);
  stroke:var(--ouro); fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; transform:translateZ(-16px); box-shadow:0 8px 18px rgba(0,0,0,.5); }

/* módulo tela */
.janela { flex-direction:column; align-items:stretch; gap:0; padding:0; }
.janela .barra { display:flex; align-items:center; gap:10px; padding:20px 28px; border-bottom:1px solid var(--borda); }
.janela .barra i { width:13px; height:13px; border-radius:50%; background:rgba(255,255,255,.22); }
.janela .barra span { margin-left:14px; font-size:22px; font-weight:600; color:var(--suave); }
.janela .linhas { padding:22px; display:flex; flex-direction:column; gap:14px; }
.linha { position:relative; display:flex; align-items:center; gap:22px; padding:22px 24px; border-radius:22px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10); transform-style:preserve-3d; }
.linha.destaque { transform:translateZ(36px); padding:28px 26px; border:1.5px solid rgba(255,214,140,.95);
  background:linear-gradient(200deg, rgba(255,205,120,.30), rgba(249,182,79,.10)), {{base_ouro}};
  box-shadow:-12px 18px 40px rgba(0,0,0,.55), 0 20px 70px rgba(249,182,79,.30); }
.linha .etiqueta { right:24px; top:-16px; }
.valor { flex:none; font-size:38px; font-weight:800; color:var(--ouro); letter-spacing:-.02em; }
.tog { flex:none; position:relative; width:92px; height:52px; border-radius:999px; background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.2); }
.tog i { position:absolute; top:5px; left:6px; width:40px; height:40px; border-radius:50%; background:#cfd3e6; box-shadow:0 4px 10px rgba(0,0,0,.4); }
.tog.on { background:linear-gradient(135deg,#ffd48a,var(--ouro)); border-color:rgba(255,214,140,.9); }
.tog.on i { left:auto; right:6px; background:#fff; }

/* módulo lista */
.grade { display:grid; grid-template-columns:1fr 1fr; gap:34px 28px; transform-style:preserve-3d; }
.cartao.mini { flex-direction:column; align-items:flex-start; gap:16px; padding:30px 28px; min-height:196px; }
.cartao.mini.destaque { padding:30px 28px; min-height:196px; }
.cartao.mini.destaque > .icone { width:64px; height:64px; border-radius:20px; }
.cartao.mini.destaque > .icone svg { width:34px; height:34px; }
.cartao.mini .texto b { font-size:27px; }
.cartao.mini.destaque .texto b { font-size:29px; }
.cartao.mini .etiqueta { right:22px; }

/* módulo número */
.cartao.numero { flex-direction:column; align-items:center; text-align:center; gap:6px; padding:44px 38px 40px; min-height:0; }
.numero .rot { font-size:26px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:rgba(244,246,255,.7); }
.numero .grande-num { font-size:230px; line-height:1; font-weight:800; letter-spacing:-.05em;
  background:linear-gradient(135deg,#ffe3b3,var(--ouro) 55%,var(--ouro-escuro)); -webkit-background-clip:text; background-clip:text; color:transparent; transform:translateZ(30px); }
.numero .sub-num { font-size:30px; font-weight:500; color:rgba(244,246,255,.85); max-width:700px; line-height:1.3; }
.passos { display:flex; flex-wrap:wrap; justify-content:center; gap:12px; margin-top:26px; }
.passo { font-size:22px; font-weight:600; padding:10px 20px; border-radius:999px; background:rgba(0,0,0,.30); border:1px solid var(--borda); color:var(--suave); transform:translateZ(16px); }
.passo.ativo { color:#1a1204; background:linear-gradient(135deg,#ffd48a,var(--ouro)); border-color:transparent; font-weight:800; }

/* módulo comparativo */
.duplo { display:flex; align-items:center; gap:0; transform-style:preserve-3d; }
.duplo .cartao.col { flex:1; flex-direction:column; align-items:flex-start; justify-content:center; gap:16px; padding:38px 30px; min-height:380px; }
.duplo .cartao.col.destaque { padding:38px 30px; min-height:430px; }
.duplo .col > .icone { width:72px; height:72px; border-radius:22px; }
.duplo .col > .icone svg { width:38px; height:38px; }
.duplo .cartao.col:not(.destaque) { opacity:.92; }
.duplo .rot { font-size:20px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:rgba(244,246,255,.55); }
.duplo .destaque .rot { color:#ffe3b3; }
.duplo .vai { flex:none; width:64px; height:64px; margin:0 -14px; border-radius:50%; display:grid; place-items:center; background:var(--fundo); border:1px solid rgba(249,182,79,.7); z-index:5; transform:translateZ(60px); }
.duplo .vai svg { width:32px; height:32px; stroke:var(--ouro); fill:none; stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; }
.duplo .col .texto b { font-size:38px; }
.duplo .col .texto small { font-size:26px; }

/* título, apoio, rodapé */
.bloco { flex:none; }
.grande, .apoio, .sub-num, .duplo .texto { text-wrap:balance; }
.grande { font-size:98px; line-height:1; font-weight:800; letter-spacing:-.045em; }
.grande .suave-t { color:rgba(244,246,255,.62); font-weight:700; }
.grande .ouro { background:linear-gradient(135deg,#ffe3b3,var(--ouro) 60%,var(--ouro-escuro)); -webkit-background-clip:text; background-clip:text; color:transparent; }
.apoio { margin-top:26px; font-size:32px; line-height:1.38; color:rgba(244,246,255,.82); font-weight:500; letter-spacing:-.01em; max-width:900px; }
.apoio b { color:#fff; font-weight:700; }
.rodape { flex:none; margin-top:34px; padding-top:28px; border-top:1px solid var(--borda); display:flex; justify-content:center; }
.rodape .fim { display:inline-flex; align-items:center; gap:14px; font-size:31px; font-weight:700; color:var(--ouro); letter-spacing:-.01em; }
.rodape .fim svg { width:32px; height:32px; stroke:var(--ouro); fill:none; stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; }
"""

# Mede o texto e ajusta o que for preciso. Escreve o relatório num <pre id="rel"> que o Python lê.
JS = r"""
document.fonts.ready.then(function () {
  var rel = {};
  var g = document.querySelector('.grande'), a = document.querySelector('.apoio');
  function linhas(el) { var lh = parseFloat(getComputedStyle(el).lineHeight); return Math.round(el.getBoundingClientRect().height / lh); }
  var fs = 98; g.style.fontSize = fs + 'px';
  while (linhas(g) > 2 && fs > 74) { fs -= 4; g.style.fontSize = fs + 'px'; }
  rel.tituloLinhas = linhas(g); rel.tituloFonte = fs; rel.apoioLinhas = linhas(a);
  var area = document.querySelector('.heroarea'), h = document.querySelector('.hero');
  var cs = getComputedStyle(area), disp = area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 10, need = h.offsetHeight * 1.1, esc = 0.93;
  if (need * esc > disp) { esc = Math.max(0.5, disp / need); }
  h.style.setProperty('--escala', esc.toFixed(3));
  rel.heroEscala = +esc.toFixed(3); rel.heroAltura = h.offsetHeight; rel.areaDisponivel = Math.round(disp);
  rel.estouro = document.querySelector('.arte').scrollHeight > 1350;
  var p = document.createElement('pre'); p.id = 'rel'; p.style.display = 'none'; p.textContent = JSON.stringify(rel); document.body.appendChild(p);
});
"""


def montar(spec, marca):
    t = dict(marca)
    t["espessura_card"] = espessura(rampa(*marca["rampa"], 10))
    t["espessura_ouro"] = espessura(rampa("#b57a1c", "#2f1b06", 12))
    t["textura"] = TEXTURAS[spec.get("textura", "camurca")]
    css = CSS
    for k, v in t.items():
        css = css.replace("{{%s}}" % k, str(v))
    hero = spec["hero"]
    tipo = hero["tipo"]
    if tipo not in HEROS:
        sys.exit("Hero '%s' não existe. Use um de: %s" % (tipo, ", ".join(HEROS)))
    rodape = spec.get("rodape", "Já disponível para todos os usuários, confira")
    return """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>%(titulo_plano)s</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>%(css)s</style></head>
<body><div class="arte">
  <div class="topo"><div class="marca"><img src="%(logo)s" alt="%(nome)s"><span>%(nome)s</span></div><div class="selo"><i></i>%(selo)s</div></div>
  <div class="heroarea"><div class="hero %(tipo)s">%(hero)s</div></div>
  <div class="bloco"><div class="grande">%(titulo)s</div><div class="apoio">%(apoio)s</div></div>
  <div class="rodape"><div class="fim">%(rodape)s %(seta)s</div></div>
</div><script>%(js)s</script></body></html>""" % dict(
        titulo_plano=esc(sem_marcas(spec["titulo"])), css=css, logo="logo.png", nome=esc(marca["nome"]),
        selo=esc(spec.get("selo", "Novidade")), tipo=tipo, hero=HEROS[tipo](hero),
        titulo=fmt_titulo(spec["titulo"]), apoio=fmt_apoio(spec["apoio"]), rodape=esc(rodape), seta=ico("seta"), js=JS)


def chrome(args, timeout=120):
    base = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
            "--window-size=1080,1350", "--virtual-time-budget=12000"]
    return subprocess.run(base + args, capture_output=True, text=True, timeout=timeout)


def main():
    ap = argparse.ArgumentParser(description="Gera a arte de Novidade de Produto (1080x1350).")
    ap.add_argument("spec", help="arquivo .json com a especificação")
    ap.add_argument("--saida", help="pasta de saída (padrão: saida/ ao lado do spec)")
    a = ap.parse_args()

    spec_path = Path(a.spec).resolve()
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    produto = spec.get("produto", "blindagem")
    if produto not in MARCAS:
        sys.exit("Produto '%s' sem marca. Cadastre em MARCAS: %s" % (produto, ", ".join(MARCAS)))
    marca = MARCAS[produto]
    nome = spec.get("nome") or spec_path.stem
    saida = Path(a.saida).resolve() if a.saida else spec_path.parent / "saida"
    saida.mkdir(parents=True, exist_ok=True)
    shutil.copy(AQUI / marca["logo"], saida / "logo.png")

    html_path = saida / (nome + ".html")
    png_path = saida / (nome + ".png")
    html_path.write_text(montar(spec, marca), encoding="utf-8")

    r = chrome(["--dump-dom", "file://%s" % html_path])
    m = re.search(r'<pre id="rel"[^>]*>(.*?)</pre>', r.stdout, re.S)
    rel = json.loads(html.unescape(m.group(1))) if m else {}
    chrome(["--screenshot=%s" % png_path, "file://%s" % html_path])

    print("PNG:  %s\nHTML: %s" % (png_path, html_path))
    if not rel:
        print("AVISO: não consegui ler o relatório de conferência. Olhe a imagem com cuidado.")
        return
    print("Conferência: título %d linha(s) a %dpx, apoio %d linha(s), hero %dpx em área de %dpx (escala %.2f)" % (
        rel["tituloLinhas"], rel["tituloFonte"], rel["apoioLinhas"], rel["heroAltura"], rel["areaDisponivel"], rel["heroEscala"]))
    avisos = []
    if rel["tituloLinhas"] > 2:
        avisos.append("título passou de 2 linhas: encurte.")
    if rel["tituloFonte"] < 90:
        avisos.append("título encolheu para %dpx: prefira um título mais curto." % rel["tituloFonte"])
    if rel["apoioLinhas"] > 3:
        avisos.append("frase de apoio passou de 3 linhas: encurte.")
    if rel["heroEscala"] < 0.8:
        avisos.append("hero reduzido a %.2f: conteúdo demais, tire itens ou texto." % rel["heroEscala"])
    if rel["estouro"]:
        avisos.append("o conteúdo estourou a altura da arte.")
    for av in avisos:
        print("AVISO:", av)
    if not avisos:
        print("Sem avisos.")


if __name__ == "__main__":
    main()
