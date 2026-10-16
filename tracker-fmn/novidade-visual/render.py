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
CONTEXTO = {}  # preenchido no main: pasta do spec e pasta de saída
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
    "escudo": '<path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6z"/><path d="m8.8 12 2.4 2.4 4-4.4"/>',
    "xcirculo": '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    "upload": '<path d="M12 16V5M7.5 9.5 12 5l4.5 4.5"/><path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17"/>',
    "carregando": '<path d="M12 3a9 9 0 1 0 9 9"/>',
    "busca": '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
    "mensagem": '<path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V17H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
}


def ico(nome):
    return '<svg viewBox="0 0 24 24">%s</svg>' % ICONES.get(nome or "documento", ICONES["documento"])


def qr_simbolico(semente=7):
    """QR Code só para ilustrar (não lê, de propósito): três cantos de posição e miolo pseudoaleatório."""
    n = 25
    m = [[0] * n for _ in range(n)]
    def canto(r0, c0):
        for r in range(7):
            for c in range(7):
                borda = r in (0, 6) or c in (0, 6)
                miolo = 2 <= r <= 4 and 2 <= c <= 4
                m[r0 + r][c0 + c] = 1 if (borda or miolo) else 0
    canto(0, 0); canto(0, n - 7); canto(n - 7, 0)
    x = semente
    for r in range(n):
        for c in range(n):
            if (r < 8 and c < 8) or (r < 8 and c > n - 9) or (r > n - 9 and c < 8):
                continue
            x = (x * 1103515245 + 12345) & 0x7FFFFFFF
            m[r][c] = 1 if (x >> 16) % 100 < 48 else 0
    q = 2
    ret = "".join('<rect x="%d" y="%d" width="1" height="1"/>' % (c + q, r + q) for r in range(n) for c in range(n) if m[r][c])
    return '<svg viewBox="0 0 %d %d" shape-rendering="crispEdges"><rect width="%d" height="%d" rx="1.2" fill="#fff"/><g fill="#0b1020">%s</g></svg>' % (n + 2 * q, n + 2 * q, n + 2 * q, n + 2 * q, ret)


def esc(t):
    return html.escape(str(t if t is not None else ""), quote=False)


# ---------------------------------------------------------------- texto
def cola_curtas(h):
    """Palavra de 1 ou 2 letras (o, a, de, se...) fica junto da próxima, para não sobrar no fim da linha."""
    partes = re.split(r"(<[^>]+>)", h)
    return "".join(p if p.startswith("<") else re.sub(r"(?<![\wÀ-ÿ])([\wÀ-ÿ]{1,2}) ", "\\1\u00a0", p) for p in partes)


def fmt_titulo(t):
    """{ouro:palavra} vira dourado, {suave:trecho} vira cinza claro. O resto é branco."""
    s = esc(t)
    s = re.sub(r"\{ouro:(.*?)\}", r'<span class="ouro">\1</span>', s)
    s = re.sub(r"\{suave:(.*?)\}", r'<span class="suave-t">\1</span>', s)
    return cola_curtas(s)


def fmt_apoio(t):
    return cola_curtas(re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", esc(t)))


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
        elif tipo == "qr":
            ctrl = '<div class="qr">%s</div>' % qr_simbolico()
        elif tipo == "selo":
            ctrl = '<div class="selo-verde">%s %s</div>' % (ico("check"), esc(ln.get("valor", "")))
        linhas.append(
            '<div class="linha%s">%s<div class="icone peq">%s</div><div class="texto"><b>%s</b>%s</div>%s</div>' % (
                (" destaque verde" if ln.get("destaque") == "verde" else " destaque") if ln.get("destaque") else "",
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
    def previa(pv):
        if not pv:
            return ""
        capa = ('<img src="logo.png" alt="">' if pv.get("capa") == "marca" else ico("camera"))
        estilo = ""
        if pv.get("imagem"):
            src = Path(pv["imagem"])
            if not src.is_absolute():
                src = (CONTEXTO["spec_dir"] / src).resolve()
            dest = "img-" + re.sub(r"[^A-Za-z0-9._-]+", "_", src.name)
            shutil.copy(src, CONTEXTO["saida"] / dest)
            estilo = " style=\"background-image:url('%s'); background-size:cover; background-position:%s\"" % (dest, pv.get("posicao", "50% 30%"))
            capa = ""
        return ('<div class="previa"><div class="capa %s"%s>%s</div><div class="pt"><b>%s</b><small>%s</small></div></div>') % (
            "marca" if pv.get("capa") == "marca" else "foto", estilo, capa, esc(pv.get("titulo", "")), esc(pv.get("sub", "")))

    def lado(x, novo):
        return ('<div class="cartao col%s">%s<div class="icone">%s</div><div class="rot">%s</div>'
                '<div class="texto"><b>%s</b>%s</div>%s</div>') % (
            " destaque" if novo else "",
            '<div class="etiqueta">%s</div>' % esc(x["etiqueta"]) if x.get("etiqueta") else "",
            ico(x.get("icone")), esc(x.get("rotulo", "")), esc(x["titulo"]),
            "<small>%s</small>" % esc(x["sub"]) if x.get("sub") else "", previa(x.get("previa")))
    return '<div class="duplo">%s<div class="vai">%s</div>%s</div>' % (
        lado(d["antes"], False), ico("seta"), lado(d["agora"], True))


def hero_demo(d):
    """Demonstração em movimento de uma função do produto, dentro de uma janela de navegador.
    Cena disponível: "verificacao" (conferência de autenticidade). Os dados são de exemplo."""
    if d.get("cena") == "contrato":
        return hero_demo_contrato(d)
    if d.get("cena", "verificacao") != "verificacao":
        sys.exit("Cena de demo desconhecida: %s" % d.get("cena"))
    cod = d.get("codigo", "BLD-7K2M-9QXD")
    pessoa1 = d.get("contratante", "Maria S.")
    pessoa2 = d.get("estudio", "Estúdio Ipê Fotografia")
    arq1 = d.get("arquivo_ok", "contrato-maria.pdf")
    arq2 = d.get("arquivo_alterado", "contrato-maria-editado.pdf")
    linhas = "".join('<div class="ln %s"></div>' % c for c in "m s m m s m s m m s m s m s m m s m s m m s".split())
    ok = ico("check")
    def elo(n, titulo, ator, carimbo=""):
        return ('<div class="elo4 b-e%d"><span class="n">%d</span><b>%s</b><span class="at">%s</span>%s<span class="ck">%s</span></div>'
                % (n, n, esc(titulo), esc(ator), '<em>%s</em>' % esc(carimbo) if carimbo else "", ok))
    return (
        '<div class="cartao dtela">'
        '<div class="dbarra"><i></i><i></i><i></i><span class="url">blindagem.fotografiaeomeunegocio.com.br/verificar</span></div>'
        '<div class="dclip">'
        # cena A: o contrato com o QR e a câmera lendo
        '<div class="cena cenaA"><div class="papel"><div class="ph">CONTRATO DE PRESTAÇÃO DE SERVIÇOS</div>%(linhas)s'
        '<div class="assin">%(p1)s</div><div class="qrbox">%(qr)s</div><div class="cod">%(cod)s</div>'
        '<div class="rod">Documento %(cod)s · página 1 de 3</div></div>'
        '<div class="mira"><i></i><i></i><i></i><i></i><b class="scan"></b></div><div class="ping"></div></div>'
        # cena B: a página de conferência
        '<div class="cena cenaB">'
        '<div class="rcard verde b-card"><div class="ic">%(escudo)s</div><div><b>Documento autêntico e assinado por todas as partes</b>'
        '<small>O registro mostra cada etapa, na ordem em que aconteceu.</small></div></div>'
        '<div class="sec b-corr">%(elo)s Corrente de evidências'
        '<span class="st wait">%(carr)s Conferindo no seu aparelho</span><span class="st ok">%(ok)s Íntegra, conferida no seu aparelho</span></div>'
        '%(e1)s%(e2)s%(e3)s%(e4)s</div>'
        # cena C: conferir o arquivo
        '<div class="cena cenaC"><div class="sec">%(busca)s Confira o seu arquivo</div>'
        '<div class="zona">%(up)s<span>Arraste o PDF aqui ou clique para escolher</span>'
        '<div class="arq arq1">%(doc)s%(a1)s</div><div class="arq arq2">%(doc)s%(a2)s</div>'
        '<div class="calc calc1"><span class="spin">%(carr)s</span> Conferindo no seu aparelho</div>'
        '<div class="calc calc2"><span class="spin">%(carr)s</span> Conferindo no seu aparelho</div></div>'
        '<div class="resbox">'
        '<div class="res res1 rcard verde"><div class="ic">%(escudo)s</div><div><b>Arquivo íntegro e autêntico</b>'
        '<small>“%(a1)s” é idêntico ao PDF assinado. Nada foi alterado.</small></div></div>'
        '<div class="res res2 rcard verm"><div class="ic">%(xc)s</div><div><b>Arquivo diferente do registrado</b>'
        '<small>“%(a2)s” foi alterado. Não confie no conteúdo dele.</small></div></div>'
        '</div></div>'
        '</div></div>') % dict(
            linhas=linhas, p1=esc(pessoa1), p2=esc(pessoa2), qr=qr_simbolico(11), cod=esc(cod), escudo=ico("escudo"), busca=ico("busca"),
            ok=ok, elo=ico("elo"), carr=ico("carregando"), up=ico("upload"), doc=ico("documento"), xc=ico("xcirculo"),
            a1=esc(arq1), a2=esc(arq2),
            e1=elo(1, "Documento criado", "Fotógrafo"),
            e2=elo(2, "E-mail confirmado por código", "Contratante 1"),
            e3=elo(3, "Assinatura eletrônica", "Contratante 1", "2 carimbos de tempo"),
            e4=elo(4, "Assinatura eletrônica", "Fotógrafo", "2 carimbos de tempo"))


def hero_demo_contrato(d):
    """Demo do fluxo inteiro: a promessa, os contratos visuais passando de lado, personalizar, link,
    o cliente preenche os dados e assina (aceite eletrônico), validade jurídica e os decorados.
    Textos e rótulos são os do app. Dados de exemplo (fictícios)."""
    ok = ico("check")
    imgs = d.get("modelos", [])
    foco = int(d.get("foco", 3))
    paginas = "".join('<div class="pg"><img src="%s" alt=""><i class="gl"></i></div>' % _copia_img(m) for m in imgs)
    foto_foco = _copia_img(imgs[foco]) if imgs else ""
    campos = [("Nome do contrato", d.get("nome_contrato", "Casamento Rafael e Thiago")), ("Contratante 1", d.get("contratante", "Rafael Moraes Tavares")),
              ("Data da celebração", d.get("data_evento", "07/05/2027")), ("Local", d.get("local", "Jardim Botânico, Salvador - BA")),
              ("Entregáveis", d.get("entregaveis", "Galeria digital com 200 fotos tratadas")), ("Pagamento", d.get("pagamento", "A prazo, Pix, 3 parcelas"))]
    linhas = "".join('<div class="cp"><label>%s</label><div class="val"><span>%s</span></div>%s</div>' % (
        esc(r), esc(v), '<em class="padrao">do seu padrão</em>' if r == "Entregáveis" else "") for r, v in campos)
    url = d.get("link", "blindagem.fotografiaeomeunegocio.com.br/c/Xk3m9")
    prom = ["Contrato visual pronto", "Envio em minutos", "Validade jurídica"]
    prom_h = "".join('<div class="prom k0r"><span class="ck">%s</span><b>%s</b></div>' % (ok, esc(t)) for t in prom)
    regs = ["Nome e CPF", "Data e hora", "Endereço IP", "Impressão digital SHA-256"]
    regs_h = "".join('<div class="reg k5r"><span class="ck">%s</span>%s</div>' % (ok, esc(t)) for t in regs)
    deco = [("dinheiro", "Sinal de 30% a 50% antes do evento"), ("calendario", "Multa de cancelamento prevista"), ("imagem", "Uso de imagem cobrado à parte")]
    deco_h = "".join('<div class="dec k6c"><div class="icone">%s</div><div class="texto"><b>%s</b></div></div>' % (ico(ic), esc(t)) for ic, t in deco)
    return (
        '<div class="cartao dtela"><div class="dbarra"><i></i><i></i><i></i><span class="url">blindagem.fotografiaeomeunegocio.com.br</span></div>'
        '<div class="dclip">'
        # 0 promessa: o contrato visual com o escudo
        '<div class="cena k0"><div class="k0p"><img src="%(foco)s" alt=""><div class="carimbo">%(escudo)s</div></div><div class="k0l">%(prom)s</div></div>'
        # 1 os contratos visuais passando de lado
        '<div class="cena k1"><div class="sec k1t">%(busca)s Novo contrato</div>'
        '<div class="car2" style="--foco:%(fi)s"><div class="trilho2">%(paginas)s</div></div><div class="rotfoco k1r">Casamento</div></div>'
        # 2 personalizar
        '<div class="cena k2"><div class="sec k2t"><span class="chipm">Casamento</span> Personalize os dados</div>%(linhas)s'
        '<div class="botao k2b">Salvar contrato</div></div>'
        # 3 link
        '<div class="cena k3"><div class="toast k3a">%(ok)s<span>Contrato criado. Envie o link para o cliente assinar.</span></div>'
        '<div class="lcard k3b"><div class="sec">%(elo)s Link de coleta</div><div class="status">Aguardando assinatura</div>'
        '<div class="urlbox"><span>%(url)s</span></div><div class="botao copiar"><span class="b1">%(cop)s Copiar link</span><span class="b2">%(ok)s Link copiado</span></div></div></div>'
        # 4 o cliente no celular: preenche os dados, depois lê e assina
        '<div class="cena k4"><div class="fone"><div class="entalhe"></div>'
        '<div class="tela t1"><h5>Preencha seus dados</h5>'
        '<div class="fc"><label>Nome</label><div class="val"><span>Rafael Moraes Tavares</span></div></div>'
        '<div class="fc"><label>CPF</label><div class="val"><span>104.204.304-04</span></div></div>'
        '<div class="fc"><label>E-mail</label><div class="val"><span>rafael@exemplo.com.br</span></div></div>'
        '<div class="fbtn b1">Confirmar informações</div></div>'
        '<div class="tela t2"><h5>Leia o contrato e assine</h5>'
        '<div class="docc"><div class="prev"><img src="%(foco)s" alt=""></div><div><b>Contrato de Casamento</b><small>Prévia para conferência</small></div></div>'
        '<div class="vbtn"><span class="v1">Visualizar documento</span><span class="v2">%(ok)s Documento visualizado</span></div>'
        '<div class="termo"><div class="th">%(escudo2)s Termo de aceite</div><div class="tl"><span class="cx"><i>%(ok)s</i></span>'
        '<span>Li e concordo com todas as cláusulas deste contrato.</span></div></div>'
        '<div class="fbtn b2"><span class="a1">Assinar</span></div></div></div></div>'
        # 5 validade jurídica
        '<div class="cena k5"><div class="grande-ok"><div class="anel"></div>%(escudo)s</div>'
        '<div class="rcard verde k5a"><div class="ic">%(ok)s</div><div><b>Contrato assinado por todas as partes</b></div></div>'
        '<div class="regs">%(regs)s</div></div>'
        # 6 decorados
        '<div class="cena k6">%(deco)s<div class="pill k6p">Está no contrato.</div></div>'
        '</div></div>') % dict(busca=ico("busca"), paginas=paginas, fi=foco, foco=foto_foco, linhas=linhas, ok=ok, elo=ico("elo"), url=esc(url), cop=ico("documento"),
                               escudo=ico("escudo"), escudo2=ico("escudo"), prom=prom_h, regs=regs_h, deco=deco_h)


def _copia_img(caminho):
    src = Path(caminho)
    if not src.is_absolute():
        src = (CONTEXTO["spec_dir"] / src).resolve()
    dest = "img-" + re.sub(r"[^A-Za-z0-9._-]+", "_", src.name)
    shutil.copy(src, CONTEXTO["saida"] / dest)
    return dest


def hero_vitrine(d):
    """Faixas de capas de contrato passando como num catálogo de streaming, mais um pôster em foco.
    `faixas`: lista de {imagem, desloca} (a imagem é uma faixa larga de capas lado a lado).
    `poster`: {imagem, rotulo} (a página vertical inteira de um contrato, em destaque)."""
    linhas = []
    for f in d["faixas"]:
        im = _copia_img(f["imagem"])
        linhas.append('<div class="vrow"><div class="vtril" style="--d:%spx"><img src="%s" alt=""><img src="%s" alt=""></div></div>'
                      % (f.get("desloca", 0), im, im))
    poster = ""
    if d.get("poster"):
        pi = _copia_img(d["poster"]["imagem"])
        poster = ('<div class="vposter"><img src="%s" alt="">%s</div>' % (
            pi, '<div class="etiqueta">%s</div>' % esc(d["poster"]["rotulo"]) if d["poster"].get("rotulo") else ""))
    return '<div class="vit">%s%s</div>' % ("".join(linhas), poster)



def hero_carrossel(d):
    """Uma fileira de páginas inteiras de contrato lado a lado, cortadas nas pontas (dá a ideia de que tem mais),
    uma em foco (dourada) e uma setinha convidando a passar para o lado.
    `paginas`: lista de {imagem, rotulo}; `foco`: índice da página em destaque."""
    foco = d.get("foco", len(d["paginas"]) // 2)
    cards = []
    for k, pg in enumerate(d["paginas"]):
        im = _copia_img(pg["imagem"])
        cards.append('<div class="pag%s"><img src="%s" alt="">%s</div>' % (
            " foco" if k == foco else "", im,
            '<div class="etiqueta">%s</div>' % esc(pg["rotulo"]) if pg.get("rotulo") else ""))
    return '<div class="car"><div class="trilho">%s</div><div class="seta">%s</div></div>' % ("".join(cards), ico("seta"))



def LOGO_FOTOGRAFO(iniciais):
    """Logo fictícia de um fotógrafo: monograma com abertura de lente e a palavra Fotografia."""
    return ('<svg viewBox="0 0 100 100" class="lg"><circle cx="50" cy="50" r="49" fill="#0d1130"/><circle cx="50" cy="50" r="44" fill="none" stroke="#f9b64f" stroke-width="1.2"/>'
            '<g fill="none" stroke="#f9b64f" stroke-width="1.6" stroke-linecap="round"><circle cx="50" cy="29" r="9"/>'
            '<path d="M50 20 L55 25 M59 29 L53 31 M54 37 L49 33 M41 32 L47 33 M43 22 L48 26"/></g>'
            '<text x="50" y="62" text-anchor="middle" font-family="Georgia,Times New Roman,serif" font-size="25" font-weight="700" fill="#ffe3b3" letter-spacing="1">%s</text>'
            '<line x1="30" y1="69" x2="70" y2="69" stroke="#f9b64f" stroke-width=".8"/>'
            '<text x="50" y="79" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="6.2" font-weight="600" fill="#f9b64f" letter-spacing="2.2">FOTOGRAFIA</text></svg>') % esc(iniciais)


def hero_linkcliente(d):
    """O link que o cliente recebe: foto de capa, foto de perfil, nome do estúdio e o botão de assinar.
    `capa` e `perfil`: {imagem, posicao, zoom?}; `nome`, `sub`, `etiqueta_capa`, `etiqueta_perfil`, `medida`."""
    def foto(f, extra=""):
        im = _copia_img(f["imagem"])
        return "background-image:url('%s'); background-position:%s; background-size:%s;%s" % (im, f.get("posicao", "50% 30%"), f.get("zoom", "cover"), extra)
    return (
        '<div class="cartao lc"><div class="dbarra"><i></i><i></i><i></i><span class="url">%(url)s</span></div>'
        '<div class="lc-capa" style="%(capa)s"><div class="etiqueta">%(et_capa)s</div><div class="medida">%(medida)s</div></div>'
        '<div class="lc-corpo"><div class="lc-avatar%(cls)s" style="%(perfil)s">%(logo)s<div class="etiqueta peq">%(et_perfil)s</div></div>'
        '<div class="lc-nome"><b>%(nome)s</b><small>%(sub)s</small></div>'
        '<div class="lc-campos"><i></i><i></i></div><div class="lc-botao">%(botao)s</div></div></div>') % dict(
            url=esc(d.get("url", "seu-estudio.blindagem.app/contrato")), capa=foto(d["capa"]),
            perfil="" if d["perfil"].get("logo") else foto(d["perfil"]), cls=" logo" if d["perfil"].get("logo") else "",
            logo=LOGO_FOTOGRAFO(d["perfil"]["logo"]) if d["perfil"].get("logo") else "",
            et_capa=esc(d.get("etiqueta_capa", "Foto de capa")), et_perfil=esc(d.get("etiqueta_perfil", "Foto de perfil")),
            medida=esc(d.get("medida", "1920 × 540")), nome=esc(d.get("nome", "")), sub=esc(d.get("sub", "")),
            botao=esc(d.get("botao", "Preencher e assinar")))


HEROS = {"linkcliente": hero_linkcliente, "carrossel": hero_carrossel, "vitrine": hero_vitrine, "demo": hero_demo, "corrente": hero_corrente, "tela": hero_tela, "lista": hero_lista,
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
.linha.destaque.verde { border-color:rgba(130,230,165,.9);
  background:linear-gradient(200deg, rgba(90,210,140,.26), rgba(46,160,90,.08)), {{base_card}};
  box-shadow:-12px 18px 40px rgba(0,0,0,.55), 0 20px 70px rgba(60,200,120,.28); }
.linha.destaque.verde .icone { background:linear-gradient(135deg,#9af2bc,#2fbf71); border:none; box-shadow:0 12px 28px rgba(60,200,120,.5), 0 6px 0 #1c8a50, inset 0 2px 0 rgba(255,255,255,.55); }
.linha.destaque.verde .icone svg { stroke:#06210f; stroke-width:2.4; }
.selo-verde { flex:none; display:inline-flex; align-items:center; gap:8px; font-size:22px; font-weight:800; color:#c6f6d8; padding:10px 18px; border-radius:999px;
  background:rgba(46,160,90,.22); border:1px solid rgba(130,230,165,.7); box-shadow:0 8px 20px rgba(0,0,0,.4); }
.selo-verde svg { width:22px; height:22px; stroke:#7ff0a8; fill:none; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; }
.qr { flex:none; width:96px; height:96px; padding:6px; border-radius:16px; background:#fff; box-shadow:0 10px 24px rgba(0,0,0,.5); transform:translateZ(14px); }
.qr svg { width:100%; height:100%; display:block; }
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
.duplo .col .texto b { font-size:36px; }
.previa { width:100%; margin-top:10px; border-radius:20px; overflow:hidden; background:rgba(0,0,0,.32); border:1px solid var(--borda); transform:translateZ(18px); box-shadow:0 14px 30px rgba(0,0,0,.45); }
.previa .capa { height:170px; display:grid; place-items:center; }
.previa .capa.marca { background:linear-gradient(135deg, rgba(255,255,255,.08), rgba(255,255,255,.02)); }
.previa .capa.marca img { height:118px; width:auto; }
.previa .capa.foto { background:linear-gradient(135deg,#4a3a2c,#b98d62 55%,#f1d9b5); }
.previa .capa.foto svg { width:64px; height:64px; stroke:rgba(255,255,255,.9); fill:none; stroke-width:1.6; stroke-linecap:round; stroke-linejoin:round; }
.previa .pt { padding:14px 18px 16px; }
.previa .pt b { display:block; font-size:24px; font-weight:700; letter-spacing:-.01em; }
.previa .pt small { display:block; margin-top:3px; font-size:19px; color:var(--suave); font-weight:500; }
.duplo .col .texto small { font-size:26px; }


/* ===== demo em movimento (janela de navegador) ===== */
.glow { position:absolute; border-radius:50%; filter:blur(70px); pointer-events:none; z-index:0; }
.glow.g1 { width:520px; height:520px; right:-140px; top:280px; background:rgba(249,182,79,.20); }
.glow.g2 { width:460px; height:460px; left:-170px; top:640px; background:rgba(67,97,238,.26); }
.cartao.dtela { display:block; padding:0; height:620px; min-height:620px; }
.dtela .dbarra { position:absolute; left:0; right:0; top:0; height:56px; display:flex; align-items:center; gap:10px; padding:0 22px; border-bottom:1px solid var(--borda); z-index:3; }
.dtela .dbarra i { width:13px; height:13px; border-radius:50%; background:rgba(255,255,255,.22); }
.dtela .url { margin:0 auto; padding:7px 22px; border-radius:999px; background:rgba(0,0,0,.30); border:1px solid var(--borda); font-family:"SF Mono",Menlo,monospace; font-size:19px; color:var(--suave); transform:translateX(-30px); }
.dtela .dclip { position:absolute; left:0; right:0; top:56px; bottom:0; border-radius:0 0 28px 28px; overflow:hidden; }
.dtela .cena { position:absolute; inset:0; }
.papel { position:absolute; left:50%; top:22px; width:440px; height:500px; margin-left:-220px; border-radius:10px; background:linear-gradient(180deg,#fbf8f1,#efe9db); box-shadow:0 24px 60px rgba(0,0,0,.55); color:#2a2a32; padding:26px 28px; }
.papel .ph { font-size:15px; font-weight:800; letter-spacing:.08em; text-align:center; color:#33333c; margin-bottom:12px; }
.papel .ln { height:8px; border-radius:4px; background:rgba(60,60,70,.16); margin-top:11px; }
.papel .ln:nth-child(n+16) { display:none; }
.papel .ln.s { width:68%; } .papel .ln.m { width:92%; }
.papel .assin { position:absolute; left:28px; bottom:52px; width:160px; border-top:1.5px solid rgba(60,60,70,.45); padding-top:6px; font-size:13px; color:#555; }
.papel .qrbox { position:absolute; right:26px; bottom:56px; width:118px; height:118px; }
.papel .qrbox svg { width:100%; height:100%; display:block; }
.papel .cod { position:absolute; right:22px; bottom:28px; font-family:"SF Mono",Menlo,monospace; font-size:14px; font-weight:700; color:#2a2a32; }
.papel .rod { position:absolute; left:28px; bottom:10px; font-size:11px; color:#8a8a92; }
.mira { position:absolute; left:499px; top:327px; width:160px; height:160px; transform-origin:50% 50%; }
.mira i { position:absolute; width:36px; height:36px; border:5px solid var(--ouro); filter:drop-shadow(0 0 10px rgba(249,182,79,.8)); }
.mira i:nth-child(1) { left:0; top:0; border-right:0; border-bottom:0; border-radius:12px 0 0 0; }
.mira i:nth-child(2) { right:0; top:0; border-left:0; border-bottom:0; border-radius:0 12px 0 0; }
.mira i:nth-child(3) { left:0; bottom:0; border-right:0; border-top:0; border-radius:0 0 0 12px; }
.mira i:nth-child(4) { right:0; bottom:0; border-left:0; border-top:0; border-radius:0 0 12px 0; }
.scan { position:absolute; left:8px; right:8px; top:78px; height:5px; border-radius:3px; background:linear-gradient(90deg,transparent,var(--ouro),transparent); box-shadow:0 0 18px 6px rgba(249,182,79,.55); }
.ping { position:absolute; left:499px; top:327px; width:160px; height:160px; border-radius:22px; border:4px solid #7ff0a8; box-shadow:0 0 30px rgba(127,240,168,.6); }
.cenaB { padding:26px 28px; display:flex; flex-direction:column; gap:14px; }
.cenaC { padding:26px 28px; display:flex; flex-direction:column; gap:14px; }
.rcard { display:flex; align-items:center; gap:20px; padding:20px 24px; border-radius:20px; border:1.5px solid; }
.rcard .ic { flex:none; width:70px; height:70px; border-radius:50%; display:grid; place-items:center; }
.rcard .ic svg { width:40px; height:40px; fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
.rcard b { display:block; font-size:31px; font-weight:700; line-height:1.18; letter-spacing:-.01em; }
.rcard small { display:block; margin-top:6px; font-size:21px; color:rgba(244,246,255,.74); line-height:1.3; }
.rcard.verde { border-color:rgba(130,230,165,.55); background:rgba(46,160,90,.15); } .rcard.verde .ic { background:rgba(46,160,90,.28); } .rcard.verde .ic svg { stroke:#7ff0a8; }
.rcard.verm { border-color:rgba(255,125,125,.7); background:rgba(220,70,70,.17); } .rcard.verm .ic { background:rgba(220,70,70,.30); } .rcard.verm .ic svg { stroke:#ff9a9a; }
.sec { display:flex; align-items:center; gap:12px; font-size:27px; font-weight:700; margin-top:4px; }
.sec svg { width:26px; height:26px; stroke:var(--suave); fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.sec .st { margin-left:auto; font-size:19px; font-weight:600; display:inline-flex; align-items:center; gap:6px; }
.sec .st + .st { position:absolute; right:26px; }
.sec .st svg { width:20px; height:20px; }
.st.ok { color:#7ff0a8; } .st.ok svg { stroke:#7ff0a8; stroke-width:3; } .st.wait { color:var(--suave); }
.pessoa { display:flex; align-items:center; gap:12px; padding:9px 16px; border-radius:14px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.10); font-size:16px; color:var(--suave); }
.pessoa b { font-size:18px; color:var(--branco); } .pessoa small { margin-left:auto; font-size:15px; }
.ck svg { width:28px; height:28px; stroke:#7ff0a8; fill:none; stroke-width:3.2; stroke-linecap:round; stroke-linejoin:round; display:block; }
.elo4 { display:flex; align-items:center; gap:14px; padding:12px 18px; border-radius:16px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); font-size:23px; }
.elo4 .n { width:36px; height:36px; border-radius:50%; display:grid; place-items:center; font-size:19px; font-weight:800; background:rgba(124,147,255,.18); color:var(--icone); }
.elo4 b { font-weight:700; } .elo4 .at { color:var(--suave); font-size:19px; }
.elo4 em { margin-left:auto; font-style:normal; font-size:16px; color:#bfe7c8; background:rgba(46,160,90,.16); border:1px solid rgba(120,220,150,.35); padding:3px 12px; border-radius:999px; }
.elo4 .ck { margin-left:8px; } .elo4 em + .ck { margin-left:8px; } .elo4 .at + .ck { margin-left:auto; }
.peq { font-size:16.5px; color:var(--suave); line-height:1.35; }
.zona { position:relative; margin-top:6px; height:200px; border-radius:18px; border:2px dashed rgba(255,255,255,.28); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:var(--suave); font-size:25px; }
.zona > svg { width:50px; height:50px; stroke:var(--suave); fill:none; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.arq { position:absolute; left:50%; top:50%; width:420px; height:84px; margin:-42px 0 0 -210px; border-radius:16px; background:#fff; color:#222; display:flex; align-items:center; gap:14px; padding:0 20px; font-size:24px; font-weight:700; box-shadow:0 18px 40px rgba(0,0,0,.55); }
.arq svg { width:36px; height:36px; stroke:#d33; fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; flex:none; }
.calc { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; gap:14px; font-size:26px; font-weight:600; color:var(--ouro); background:rgba(7,10,24,.80); border-radius:16px; }
.calc .spin { display:inline-flex; } .calc svg { width:38px; height:38px; stroke:var(--ouro); fill:none; stroke-width:2.6; stroke-linecap:round; }
.resbox { position:relative; height:170px; margin-top:4px; }
.res { position:absolute; left:0; right:0; top:0; }


/* ===== vitrine (faixas de capas + pôster em foco) ===== */
.hero.vitrine { max-width:1080px; margin:0 -96px; width:1080px; }
.vit { position:relative; transform-style:preserve-3d; }
.vrow { height:206px; overflow:hidden; border-radius:16px; margin-bottom:16px; position:relative; transform-style:flat;
  box-shadow:-14px 20px 40px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.10); }
.vrow::after { content:""; position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(90deg, rgba(7,10,24,.78), rgba(7,10,24,0) 18%, rgba(7,10,24,0) 82%, rgba(7,10,24,.78)); }
.vtril { display:flex; width:max-content; transform:translateX(var(--d,0px)); will-change:transform; }
.vtril img { height:206px; width:auto; display:block; filter:brightness(.78) saturate(.92); }
.vposter { position:absolute; left:50%; top:50%; width:340px; transform:translate3d(-50%,-50%,90px); border-radius:10px; border:3px solid rgba(255,214,140,.95);
  box-shadow:-10px 14px 0 #8f5d16, -22px 30px 70px rgba(0,0,0,.7), 0 0 90px rgba(249,182,79,.38); background:#fff; }
.vposter img { display:block; width:100%; border-radius:7px; }
.vposter .etiqueta { top:-20px; right:auto; left:50%; transform:translate(-50%,0) translateZ(40px); font-size:19px; padding:8px 20px; }

/* ===== formato reels 1080x1920 (vídeo vertical): folga em cima e embaixo para a interface do Reels ===== */
@property --rx { syntax:"<angle>"; inherits:false; initial-value:6deg; }
@property --ry { syntax:"<angle>"; inherits:false; initial-value:10deg; }
html.reels, html.reels body { width:1080px; height:1920px; }
html.reels .arte { width:1080px; height:1920px; padding:200px 72px 310px; }
html.reels .heroarea { padding:0 0 30px; }
html.reels .hero { max-width:888px; transform:perspective(1900px) scale(1.05) rotateX(var(--rx)) rotateY(var(--ry)) rotateZ(-.8deg); transform-origin:50% 50%; }
html.reels .glow.g1 { top:380px; } html.reels .glow.g2 { top:1100px; }
html.reels .rodape { margin-top:20px; }

.apoio:empty { display:none; }
.bloco.pilha { display:grid; }
.bloco.pilha .tb { grid-area:1/1; }
/* demo no formato reels: janela mais alta, cenas centradas na vertical, respiro dos lados */
html.reels .arte { padding:190px 72px 240px; }
html.reels .cartao.dtela { height:800px; min-height:800px; }
html.reels .papel { height:660px; top:42px; }
html.reels .papel .ln:nth-child(n+16) { display:block; }
html.reels .mira, html.reels .ping { top:507px; }
html.reels .cenaB, html.reels .cenaC { justify-content:center; padding-top:20px; padding-bottom:20px; gap:20px; }
html.reels .hero { transform:perspective(1900px) scale(.94) rotateX(var(--rx)) rotateY(var(--ry)) rotateZ(-.6deg); }
html.reels .heroarea { padding:0 0 10px; }


/* ===== carrossel (páginas de contrato lado a lado, cortadas nas pontas) ===== */
.hero.carrossel { max-width:none; width:1080px; margin:0 -96px; transform:perspective(2600px) rotateY(7deg) rotateZ(-.6deg) scale(1.02) !important; }
.car { position:relative; height:640px; display:flex; align-items:center; }
.trilho { display:flex; gap:26px; align-items:center; width:max-content; margin-left:0; }
.pag { position:relative; flex:none; width:392px; height:570px; overflow:hidden; border-radius:12px; background:#fff;
  box-shadow:-12px 18px 0 rgba(0,0,0,.28), -26px 34px 60px rgba(0,0,0,.6); filter:brightness(.8); }
.pag img { display:block; width:100%; }
.pag.foco { height:640px; width:442px; filter:none; overflow:visible; border-radius:12px; border:3px solid rgba(255,214,140,.95);
  box-shadow:-12px 16px 0 #8f5d16, -26px 34px 70px rgba(0,0,0,.7), 0 0 100px rgba(249,182,79,.42); z-index:2; }
.pag.foco img { height:100%; object-fit:cover; object-position:top; border-radius:9px; }
.pag .etiqueta { top:-20px; right:auto; left:50%; transform:translateX(-50%); }
.seta { position:absolute; right:66px; top:50%; margin-top:-44px; width:88px; height:88px; border-radius:50%; display:grid; place-items:center; z-index:5;
  background:linear-gradient(135deg,#ffd48a,var(--ouro) 60%,var(--ouro-escuro)); box-shadow:0 10px 0 #8f5d16, 0 18px 40px rgba(0,0,0,.55), 0 0 50px rgba(249,182,79,.5); }
.seta svg { width:46px; height:46px; stroke:#1a1204; fill:none; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; }

/* ===== formato capa 1920x1080 (capa de tutorial / thumbnail do YouTube): texto à esquerda, janela à direita ===== */
html.capa, html.capa body { width:1920px; height:1080px; }
html.capa .arte { width:1920px; height:1080px; display:grid; grid-template-columns:820px 1fr; grid-template-rows:auto 1fr; column-gap:20px; padding:70px 96px 70px; }
html.capa .topo { grid-column:1; grid-row:1; position:static; }
html.capa .selo { position:absolute; right:96px; top:70px; }
html.capa .bloco { grid-column:1; grid-row:2; align-self:center; }
html.capa .rodape { display:none; }
html.capa .heroarea { grid-column:2; grid-row:1 / 3; padding:0; }
html.capa .hero { max-width:888px; transform:perspective(1900px) scale(1.12) rotateX(7deg) rotateY(13deg) rotateZ(-.8deg) !important; transform-origin:50% 50%; }
html.capa .apoio { font-size:38px; max-width:760px; }
html.capa .glow.g1 { right:60px; top:60px; }

/* ===== link do cliente (capa, perfil e nome do estúdio) ===== */
.cartao.lc { display:block; padding:0; min-height:0; overflow:visible; }
.lc .dbarra { display:flex; align-items:center; gap:10px; height:56px; padding:0 22px; border-bottom:1px solid var(--borda); }
.lc .dbarra i { width:13px; height:13px; border-radius:50%; background:rgba(255,255,255,.22); }
.lc .url { margin:0 auto; padding:7px 22px; border-radius:999px; background:rgba(0,0,0,.30); border:1px solid var(--borda); font-family:"SF Mono",Menlo,monospace; font-size:19px; color:var(--suave); transform:translateX(-30px); }
.lc-capa { position:relative; height:300px; background-repeat:no-repeat; }
.lc-capa::after { content:""; position:absolute; inset:0; background:linear-gradient(180deg, rgba(7,10,24,0) 55%, rgba(7,10,24,.55)); }
.lc-capa .etiqueta { top:18px; right:22px; z-index:4; }
.lc-capa .medida { position:absolute; right:22px; bottom:16px; z-index:4; font-family:"SF Mono",Menlo,monospace; font-size:21px; font-weight:700; color:#ffe3b3;
  background:rgba(7,10,24,.72); border:1px solid rgba(249,182,79,.6); padding:6px 14px; border-radius:10px; }
.lc-corpo { position:relative; padding:0 36px 34px; }
.lc-avatar { position:absolute; left:36px; top:-62px; width:132px; height:132px; border-radius:50%; background-repeat:no-repeat; z-index:3;
  border:5px solid var(--ouro); box-shadow:0 14px 34px rgba(0,0,0,.6), 0 0 40px rgba(249,182,79,.4); }
.lc-avatar.logo { background:#0d1130; } .lc-avatar .lg { position:absolute; inset:0; width:100%; height:100%; border-radius:50%; }
.lc-avatar .etiqueta { color:#1a1204 !important; text-shadow:none; top:auto; bottom:-14px; right:auto; left:50%; transform:translateX(-50%); white-space:nowrap; font-size:15px; padding:5px 12px; }
.lc-nome { padding:90px 0 0 0; margin-left:0; }
.lc-nome b { display:block; font-size:36px; font-weight:800; letter-spacing:-.02em; }
.lc-nome small { display:block; margin-top:4px; font-size:22px; color:var(--suave); font-weight:500; }
.lc-campos { display:flex; gap:16px; margin-top:22px; }
.lc-campos i { flex:1; height:46px; border-radius:12px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.10); }
.lc-botao { margin-top:20px; text-align:center; font-weight:800; font-size:26px; color:#1a1204; padding:18px; border-radius:16px;
  background:linear-gradient(135deg,#ffd48a,var(--ouro) 60%,var(--ouro-escuro)); box-shadow:0 8px 0 #8f5d16, 0 16px 34px rgba(249,182,79,.35); }

/* ===== demo do contrato (modelo, dados, link, cliente, assinado) ===== */
.fakebusca { padding:16px 22px; border-radius:14px; background:rgba(0,0,0,.28); border:1px solid var(--borda); color:var(--suave); font-size:24px; }
.mods { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:6px; }
.mod { position:relative; display:flex; align-items:center; gap:16px; padding:20px 20px; border-radius:18px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); }
.mod .texto b { font-size:27px; } .mod .texto small { font-size:20px; margin-top:3px; }
.mod.foco { border:1.5px solid rgba(255,214,140,.95); background:linear-gradient(200deg, rgba(255,205,120,.30), rgba(249,182,79,.10)); box-shadow:0 0 50px rgba(249,182,79,.35); }
.mod .sel { position:absolute; right:16px; top:16px; width:34px; height:34px; border-radius:50%; background:var(--ouro); display:grid; place-items:center; }
.mod .sel svg { width:20px; height:20px; stroke:#1a1204; fill:none; stroke-width:3.4; stroke-linecap:round; stroke-linejoin:round; }
.chipm { font-size:19px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:#1a1204; background:var(--ouro); padding:6px 14px; border-radius:999px; }
.cp { position:relative; display:flex; flex-direction:column; gap:6px; }
.cp label { font-size:19px; color:var(--suave); font-weight:600; }
.cp .val { padding:15px 20px; border-radius:14px; background:rgba(0,0,0,.28); border:1px solid var(--borda); font-size:26px; font-weight:600; overflow:hidden; white-space:nowrap; }
.cp .padrao { position:absolute; right:14px; top:30px; font-style:normal; font-size:16px; color:#bfe7c8; background:rgba(46,160,90,.18); border:1px solid rgba(120,220,150,.4); padding:4px 12px; border-radius:999px; }
.botao { text-align:center; font-weight:800; font-size:27px; color:#1a1204; padding:18px; border-radius:16px; background:linear-gradient(135deg,#ffd48a,var(--ouro) 60%,var(--ouro-escuro)); box-shadow:0 8px 0 #8f5d16, 0 16px 34px rgba(249,182,79,.35); }
.k2 .botao { margin-top:auto; }
.k3 { padding:26px 28px; display:flex; flex-direction:column; gap:20px; justify-content:center; }
.toast { display:flex; align-items:center; gap:14px; padding:20px 24px; border-radius:18px; background:rgba(46,160,90,.20); border:1.5px solid rgba(130,230,165,.55); font-size:25px; font-weight:700; }
.toast svg { width:34px; height:34px; stroke:#7ff0a8; fill:none; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; flex:none; }
.lcard { position:relative; padding:24px 26px 28px; border-radius:20px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); display:flex; flex-direction:column; gap:18px; }
.lcard .status { position:absolute; right:22px; top:22px; font-size:18px; font-weight:700; color:#ffe3b3; background:rgba(249,182,79,.16); border:1px solid rgba(249,182,79,.5); padding:6px 14px; border-radius:999px; }
.urlbox { padding:18px 20px; border-radius:14px; background:rgba(0,0,0,.34); border:1px solid var(--borda); font-family:"SF Mono",Menlo,monospace; font-size:21px; color:#ffe3b3; overflow:hidden; white-space:nowrap; }
.copiar { position:relative; } .copiar .b1, .copiar .b2 { display:inline-flex; align-items:center; gap:10px; }
.copiar .b2 { position:absolute; left:0; right:0; top:18px; justify-content:center; }
.copiar svg { width:28px; height:28px; stroke:#1a1204; fill:none; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round; }
.k4 { display:grid; place-items:center; }
.fone { position:relative; width:392px; height:690px; border-radius:50px; border:6px solid #2a2f4a; background:#0b0f26; box-shadow:0 30px 70px rgba(0,0,0,.6), inset 0 0 0 2px rgba(255,255,255,.06); overflow:hidden; }
.entalhe { position:absolute; left:50%; top:12px; width:110px; height:28px; margin-left:-55px; border-radius:20px; background:#04050f; z-index:4; }
.tela { position:absolute; inset:0; padding:70px 24px 24px; display:flex; flex-direction:column; gap:14px; background:linear-gradient(180deg,#141a3d,#0b0f26); }
.tela h5 { font-size:30px; font-weight:800; letter-spacing:-.02em; margin-bottom:6px; }
.fc label { display:block; font-size:17px; color:var(--suave); margin-bottom:5px; font-weight:600; }
.fc div { padding:14px 16px; border-radius:12px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); font-size:21px; font-weight:600; white-space:nowrap; overflow:hidden; }
.fbtn { margin-top:auto; text-align:center; font-weight:800; font-size:23px; color:#1a1204; padding:16px; border-radius:14px; background:linear-gradient(135deg,#ffd48a,var(--ouro) 60%,var(--ouro-escuro)); }
.mini { padding:20px; border-radius:12px; background:linear-gradient(180deg,#fbf8f1,#efe9db); display:flex; flex-direction:column; gap:10px; }
.mini i { height:8px; border-radius:4px; background:rgba(60,60,70,.2); } .mini i.s { width:64%; }
.assin2 { position:relative; margin-top:6px; height:130px; border-radius:12px; background:rgba(255,255,255,.07); border:1.5px dashed rgba(255,255,255,.3); }
.assin2 svg { position:absolute; inset:10px 14px 28px; width:calc(100% - 28px); height:calc(100% - 38px); }
.assin2 .traco { fill:none; stroke:#ffd48a; stroke-width:5; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:700; stroke-dashoffset:700; }
.assin2 span { position:absolute; left:0; right:0; bottom:6px; text-align:center; font-size:15px; color:var(--suave); }
.k5 { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:18px; padding:20px 30px; }
.grande-ok { position:relative; width:170px; height:170px; border-radius:50%; display:grid; place-items:center; background:radial-gradient(circle at 35% 30%, #3fcf86, #1c7a4a); box-shadow:0 0 70px rgba(63,207,134,.5); }
.grande-ok svg { width:96px; height:96px; fill:none; stroke:#eafff3; stroke-width:2.3; stroke-linecap:round; stroke-linejoin:round; }
.grande-ok .anel { position:absolute; inset:-14px; border-radius:50%; border:4px solid rgba(127,240,168,.7); }
.k5 .rcard { width:100%; }
.quem { width:100%; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 22px; border-radius:14px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); font-size:23px; font-weight:700; }
.quem em { font-style:normal; font-weight:500; font-size:20px; color:var(--suave); }
.codigo2 { font-family:"SF Mono",Menlo,monospace; font-size:24px; font-weight:800; color:#ffe3b3; background:rgba(7,10,24,.72); border:1px solid rgba(249,182,79,.6); padding:10px 22px; border-radius:12px; }
html.reels .k1, html.reels .k2 { padding:26px 28px; display:flex; flex-direction:column; gap:16px; justify-content:center; }
html.reels .k2 { justify-content:flex-start; gap:11px; padding-top:34px; padding-bottom:22px; }
.k2 .cp .val { padding:11px 18px; font-size:24px; }
.k2 .cp label { font-size:17px; }
.k2 .cp .padrao { top:24px; }
.k2 .botao { padding:15px; font-size:25px; }
.k2 .sec { font-size:25px; margin:0 0 2px; }

/* ===== demo do contrato: promessa, celular com aceite, validade, decorados ===== */
.k0 { display:flex; flex-direction:row; align-items:center; justify-content:center; gap:26px; padding:20px 26px; }
.escudo-g { align-self:center; width:150px; height:150px; border-radius:50%; display:grid; place-items:center; margin-bottom:10px; background:radial-gradient(circle at 35% 30%, #ffd48a, #c98a1d); box-shadow:0 0 70px rgba(249,182,79,.5); }
.escudo-g svg { width:84px; height:84px; fill:none; stroke:#1a1204; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
.prom { display:flex; align-items:center; gap:16px; padding:20px 24px; border-radius:18px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); font-size:27px; }
.ck svg { width:32px; height:32px; stroke:#7ff0a8; fill:none; stroke-width:3.2; stroke-linecap:round; stroke-linejoin:round; display:block; flex:none; }
.docc { display:flex; align-items:center; gap:14px; padding:16px; border-radius:14px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); }
.docc .di { width:54px; height:54px; border-radius:14px; display:grid; place-items:center; background:rgba(249,182,79,.16); }
.docc .di svg { width:30px; height:30px; stroke:var(--ouro); fill:none; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.docc b { display:block; font-size:21px; } .docc small { display:block; margin-top:3px; font-size:16px; color:var(--suave); }
.vbtn { position:relative; text-align:center; padding:14px; border-radius:12px; border:1.5px solid rgba(255,255,255,.28); font-size:20px; font-weight:700; height:56px; }
.vbtn .v1, .vbtn .v2 { position:absolute; left:0; right:0; top:14px; }
.vbtn .v2 { display:inline-flex; align-items:center; justify-content:center; gap:8px; color:#7ff0a8; }
.vbtn .v2 svg { width:22px; height:22px; stroke:#7ff0a8; fill:none; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; }
.termo { padding:16px; border-radius:14px; background:rgba(249,182,79,.07); border:1px solid rgba(249,182,79,.4); font-size:17px; line-height:1.4; }
.termo .th { display:flex; align-items:center; gap:8px; font-weight:800; font-size:19px; margin-bottom:10px; }
.termo .th svg { width:22px; height:22px; stroke:var(--ouro); fill:none; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
.termo .tl { display:flex; gap:12px; align-items:flex-start; color:rgba(244,246,255,.85); }
.cx { flex:none; width:30px; height:30px; border-radius:8px; border:2px solid rgba(255,255,255,.4); display:grid; place-items:center; margin-top:2px; }
.cx i svg { width:20px; height:20px; stroke:#1a1204; fill:none; stroke-width:3.6; stroke-linecap:round; stroke-linejoin:round; display:block; }
.cx i { display:grid; place-items:center; width:100%; height:100%; border-radius:6px; background:var(--ouro); }
.fbtn .a1 { display:block; }
.regs { width:100%; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.reg { display:flex; align-items:center; gap:10px; padding:16px 18px; border-radius:14px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); font-size:21px; font-weight:700; }
.reg .ck svg { width:26px; height:26px; }
.k6 { display:flex; flex-direction:column; gap:16px; justify-content:center; padding:20px 28px; }
.dec { display:flex; align-items:center; gap:18px; padding:20px 22px; border-radius:18px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); }
.dec .texto b { font-size:26px; } .dec .texto small { font-size:20px; margin-top:4px; }
.dec .icone { background:linear-gradient(135deg,#ffd48a,var(--ouro)); border:none; }
.dec .icone svg { stroke:#1a1204; }
.pill { align-self:center; margin-top:8px; font-weight:800; font-size:34px; color:#1a1204; padding:16px 38px; border-radius:999px; background:linear-gradient(135deg,#ffd48a,var(--ouro) 60%,var(--ouro-escuro)); box-shadow:0 8px 0 #8f5d16, 0 0 50px rgba(249,182,79,.45); }
.k4 .tela { padding-top:64px; gap:12px; }

.k0p { position:relative; flex:none; width:330px; height:560px; border-radius:12px; overflow:hidden; border:3px solid rgba(255,214,140,.95); background:#fff; box-shadow:0 0 60px rgba(249,182,79,.35), 0 24px 50px rgba(0,0,0,.5); }
.k0p img { display:block; width:100%; }
.carimbo { position:absolute; right:14px; bottom:14px; width:104px; height:104px; border-radius:50%; display:grid; place-items:center; background:radial-gradient(circle at 35% 30%, #ffd48a, #c98a1d); box-shadow:0 0 40px rgba(249,182,79,.6); }
.carimbo svg { width:60px; height:60px; fill:none; stroke:#1a1204; stroke-width:2.2; stroke-linecap:round; stroke-linejoin:round; }
.k0l { flex:1; display:flex; flex-direction:column; gap:16px; }
.k0l .prom { font-size:25px; padding:18px 20px; }
.k1 { padding-top:26px; }
.car2 { position:absolute; left:0; right:0; top:112px; height:560px; overflow:hidden; }
.k1t { position:relative; z-index:3; }
.trilho2 { position:absolute; left:50%; top:20px; display:flex; gap:22px; transform:translateX(calc(var(--foco) * -352px - 165px)); }
.pg { position:relative; flex:none; width:330px; height:500px; border-radius:12px; overflow:hidden; background:#fff; box-shadow:-10px 14px 40px rgba(0,0,0,.5); }
.pg img { display:block; width:100%; }
.pg .gl { position:absolute; inset:0; border-radius:12px; border:3px solid rgba(255,214,140,.95); box-shadow:inset 0 0 0 1px rgba(255,255,255,.2); opacity:0; }
.rotfoco { position:absolute; left:50%; bottom:34px; transform:translateX(-50%); font-weight:800; font-size:26px; letter-spacing:.08em; text-transform:uppercase; color:#1a1204; padding:10px 28px; border-radius:999px; background:linear-gradient(135deg,#ffd48a,var(--ouro) 60%,var(--ouro-escuro)); box-shadow:0 8px 24px rgba(249,182,79,.45); }
.rotfoco { margin-left:0; }
.docc .prev { flex:none; width:70px; height:86px; border-radius:8px; overflow:hidden; background:#fff; }
.docc .prev img { display:block; width:100%; }
.fc .val { padding:14px 16px; border-radius:12px; background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.14); font-size:21px; font-weight:600; white-space:nowrap; overflow:hidden; }
.fbtn.b1 { margin-top:auto; }

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
  var dc = document.documentElement.classList, CAPA = dc.contains('capa'), P = dc.contains('reels') || CAPA, MAXL = CAPA ? 4 : (P ? 3 : 2);
  var gs = [].slice.call(document.querySelectorAll('.grande')), as = [].slice.call(document.querySelectorAll('.apoio'));
  function maxl(l) { return Math.max.apply(null, l.map(linhas)); }
  var fs = CAPA ? 118 : (P ? 104 : 98); gs.forEach(function (x) { x.style.fontSize = fs + 'px'; });
  while (maxl(gs) > MAXL && fs > (CAPA ? 84 : (P ? 70 : 74))) { fs -= 4; gs.forEach(function (x) { x.style.fontSize = fs + 'px'; }); }
  rel.tituloLinhas = maxl(gs); rel.tituloFonte = fs; rel.apoioLinhas = maxl(as);
  var tr = document.querySelector('.trilho'), fo = tr && tr.querySelector('.foco');
  if (fo) { tr.style.transform = 'translateX(' + (tr.parentElement.clientWidth / 2 - (fo.offsetLeft + fo.offsetWidth / 2)) + 'px)'; }
  var area = document.querySelector('.heroarea'), h = document.querySelector('.hero');
  var cs = getComputedStyle(area), disp = area.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 10, need = h.offsetHeight * 1.1, esc = 0.93;
  if (need * esc > disp) { esc = Math.max(0.5, disp / need); }
  h.style.setProperty('--escala', esc.toFixed(3));
  rel.heroEscala = +esc.toFixed(3); rel.heroAltura = h.offsetHeight; rel.areaDisponivel = Math.round(disp);
  var ar = document.querySelector('.arte'); rel.estouro = ar.scrollHeight > ar.clientHeight + 1; rel.maxLinhas = MAXL;
  var p = document.createElement('pre'); p.id = 'rel'; p.style.display = 'none'; p.textContent = JSON.stringify(rel); document.body.appendChild(p);
});
"""



# Roteiro de movimento: só entra com --video. Cada animação é pausada e controlada por tempo (window.__ir),
# para o capturar.js tirar um quadro por instante. Usa as propriedades individuais translate/scale/rotate,
# que somam ao transform 3D da arte sem desfazê-lo.
MOTION_JS = r"""
(function () {
  var anims = [], contadores = [];
  var EASE = 'cubic-bezier(.2,.8,.2,1)', POP = 'cubic-bezier(.34,1.56,.64,1)';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function A(el, kf, t0, dur, ease, opt) {
    if (!el) return null;
    var o = Object.assign({ duration: dur * 1000, delay: t0 * 1000, fill: 'both', easing: ease || EASE }, opt || {});
    var a = el.animate(kf, o); a.pause(); anims.push(a); return a;
  }
  function entra(el, t0, dx, dy, dur) { return A(el, [{ opacity: 0, translate: dx + 'px ' + dy + 'px' }, { opacity: 1, translate: '0 0' }], t0, dur || .7); }

  window.__ir = function (t) {
    anims.forEach(function (a) { a.currentTime = t * 1000; });
    contadores.forEach(function (c) {
      var p = Math.min(1, Math.max(0, (t - c.t0) / c.dur)); p = 1 - Math.pow(1 - p, 3);
      c.el.textContent = Math.round(c.de + (c.ate - c.de) * p) + c.sufixo;
    });
  };

  window.__montar = function () {
    var hero = $('.hero'), t = 1.5;
    // topo
    A($('.marca img'), [{ opacity: 0, scale: .5, translate: '-40px 0' }, { opacity: 1, scale: 1, translate: '0 0' }], 0, .8, POP);
    entra($('.marca span'), .25, -30, 0, .6);
    A($('.selo'), [{ opacity: 0, scale: .6, translate: '60px 0' }, { opacity: 1, scale: 1, translate: '0 0' }], .35, .7, POP);
    // o título é o gancho: entra primeiro, o bloco se monta depois
    A($('.grande'), [{ clipPath: 'inset(0 100% 0 0)', translate: '0 26px', opacity: 0 }, { clipPath: 'inset(0 0% 0 0)', translate: '0 0', opacity: 1 }], .5, .8);
    entra($('.apoio'), 1.1, 0, 22, .6);
    // o bloco respira durante todo o vídeo
    A(hero, [{ translate: '0 0' }, { translate: '0 -9px' }, { translate: '0 0' }], 0, 5, 'ease-in-out', { iterations: Infinity });

    if (hero.classList.contains('corrente')) {
      var cards = $$('.hero > .cartao'), elos = $$('.hero > .elo');
      cards.forEach(function (c, i) {
        var dest = c.classList.contains('destaque');
        A(c, dest
          ? [{ opacity: 0, translate: '0 30px -260px', scale: .9 }, { opacity: 1, translate: '0 0 0', scale: 1 }]
          : [{ opacity: 0, translate: '-140px 30px', scale: .94 }, { opacity: 1, translate: '0 0', scale: 1 }], t, dest ? .9 : .8, dest ? POP : EASE);
        A($('.icone', c), [{ scale: .3, opacity: 0 }, { scale: 1, opacity: 1 }], t + .3, .5, POP);
        entra($('.chip', c), t + .5, 20, 0, .5);
        A($('.etiqueta', c), [{ opacity: 0, scale: 2.4, rotate: '-14deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], t + .7, .45, POP);
        A($('.tags em', c), [{ opacity: 0, scale: .4 }, { opacity: 1, scale: 1.12 }, { opacity: 1, scale: 1 }], t + .9, .6);
        var cod = $$('.codigo span', c);
        cod.forEach(function (s, k) { A(s, [{ opacity: 0, scale: 1.7, translate: '0 -14px' }, { opacity: 1, scale: 1, translate: '0 0' }], t + .9 + k * .14, .3, POP); });
        t += dest ? .9 + cod.length * .14 + .35 : 1.0;
        if (elos[i]) {
          A(elos[i], [{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], t, .5, EASE, { pseudoElement: '::before' });
          A($('svg', elos[i]), [{ scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }], t + .15, .45, POP);
          t += .45;
        }
      });
    } else if (hero.classList.contains('tela')) {
      var jan = $('.janela');
      A(jan, [{ opacity: 0, translate: '0 80px' }, { opacity: 1, translate: '0 0' }], t, .8);
      $$('.linha').forEach(function (l, i) {
        var d = l.classList.contains('destaque'), t0 = t + .5 + i * .42;
        A(l, [{ opacity: 0, translate: '-60px 0' }, { opacity: 1, translate: '0 0' }], t0, .6);
        A($('.icone', l), [{ scale: .3, opacity: 0 }, { scale: 1, opacity: 1 }], t0 + .25, .45, POP);
        A($('.etiqueta', l), [{ opacity: 0, scale: 2.4, rotate: '-14deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], t0 + .5, .45, POP);
        A($('.tog i', l), [{ translate: '-40px 0' }, { translate: '0 0' }], t0 + .7, .4, POP);
        A($('.qr', l), [{ opacity: 0, scale: .3, rotate: '-20deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], t0 + .4, .6, POP);
        A($('.selo-verde', l), [{ opacity: 0, scale: .4 }, { opacity: 1, scale: 1.1 }, { opacity: 1, scale: 1 }], t0 + .8, .6);
        A($('.chip', l), [{ opacity: 0 }, { opacity: 1 }], t0 + .4, .5);
      });
      t += .5 + $$('.linha').length * .42 + .6;
    } else if (hero.classList.contains('carrossel')) {
      A($('.trilho'), [{ translate: '0 0' }, { translate: '-70px 0' }], 0, 9, 'ease-in-out');
      A($('.seta'), [{ translate: '0 0' }, { translate: '14px 0' }, { translate: '0 0' }], t + 1, 1.1, 'ease-in-out', { iterations: 4 });
      t += 1.4;
    } else if (hero.classList.contains('vitrine')) {
      $$('.vrow').forEach(function (r, i) {
        A(r, [{ opacity: 0, translate: (i % 2 ? '240px' : '-240px') + ' 0' }, { opacity: 1, translate: '0 0' }], t + i * .2, .9);
        A($('.vtril', r), [{ translate: '0 0' }, { translate: (i % 2 ? '' : '-') + '520px 0' }], 0, 14, 'linear');
      });
      A($('.vposter'), [{ opacity: 0, scale: .6, translate: '0 40px' }, { opacity: 1, scale: 1, translate: '0 0' }], t + 1.0, .8, POP);
      A($('.vposter .etiqueta'), [{ opacity: 0, scale: 2.2 }, { opacity: 1, scale: 1 }], t + 1.7, .45, POP);
      t += 2.4;
    } else if (hero.classList.contains('lista')) {
      $$('.cartao.mini').forEach(function (c, i) {
        A(c, [{ opacity: 0, translate: '0 60px', scale: .92 }, { opacity: 1, translate: '0 0', scale: 1 }], t + i * .16, .6, POP);
        A($('.icone', c), [{ scale: .3, opacity: 0 }, { scale: 1, opacity: 1 }], t + i * .16 + .25, .4, POP);
      });
      t += $$('.cartao.mini').length * .16 + .7;
    } else if (hero.classList.contains('numero')) {
      var card = $('.cartao.numero');
      A(card, [{ opacity: 0, translate: '0 40px -240px', scale: .92 }, { opacity: 1, translate: '0 0 0', scale: 1 }], t, .9, POP);
      var gn = $('.grande-num'), txt = gn.textContent, m = txt.match(/^(\D*)(\d+)(\D*)$/);
      if (m) contadores.push({ el: gn, de: 0, ate: +m[2], sufixo: m[3], t0: t + .5, dur: 1.4 });
      entra($('.rot', card), t + .3, 0, 20, .6); entra($('.sub-num', card), t + 1.3, 0, 20, .6);
      $$('.passo').forEach(function (p, i) { A(p, [{ opacity: 0, scale: .5, translate: '0 20px' }, { opacity: 1, scale: 1, translate: '0 0' }], t + 1.7 + i * .3, .45, POP); });
      t += 1.7 + $$('.passo').length * .3 + .4;
    } else if (hero.classList.contains('comparativo')) {
      var col = $$('.cartao.col'), vai = $('.vai');
      A(col[0], [{ opacity: 0, translate: '-140px 20px' }, { opacity: 1, translate: '0 0' }], t, .8);
      A(vai, [{ scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }], t + 1.0, .5, POP);
      A(col[1], [{ opacity: 0, translate: '140px 20px', scale: .94 }, { opacity: 1, translate: '0 0', scale: 1 }], t + 1.4, .9, POP);
      A($('.etiqueta', col[1]), [{ opacity: 0, scale: 2.4, rotate: '-14deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], t + 2.1, .45, POP);
      $$('.previa').forEach(function (p, i) { A(p, [{ opacity: 0, translate: '0 30px' }, { opacity: 1, translate: '0 0' }], t + .5 + i * 1.4, .7); });
      t += 2.5;
    }
    // rodapé fecha a peça
    entra($('.rodape'), t, 0, 30, .6);
    A($('.rodape .fim svg'), [{ translate: '0 0' }, { translate: '10px 0' }, { translate: '0 0' }], t + .7, 1.2, 'ease-in-out', { iterations: 3 });
    return t + 2.2;
  };
})();
"""

# Roteiro da demonstração em laço (16 s). Cada elemento tem UMA animação que cobre o laço inteiro, e o fim
# volta ao estado do início, para o vídeo repetir sem corte. A moldura de texto não se mexe.
DEMO_JS = r"""
(function () {
  var L = 16, anims = [];
  var E = 'cubic-bezier(.4,0,.2,1)', POP = 'cubic-bezier(.34,1.56,.64,1)', MOVE = 'cubic-bezier(.3,.7,.2,1)';
  function $(s, r) { return (r || document).querySelector(s); }
  function S(o, tr, sc) { return { opacity: o, translate: tr || '0 0', scale: sc == null ? 1 : sc }; }
  function K(el, pts) {
    if (!el) return;
    var kf = pts.map(function (p) { return Object.assign({ offset: p[0] / L, easing: p[2] || E }, p[1]); });
    if (kf[0].offset > 0) kf.unshift(Object.assign({}, kf[0], { offset: 0 }));
    if (kf[kf.length - 1].offset < 1) kf.push(Object.assign({}, kf[kf.length - 1], { offset: 1 }));
    var a = el.animate(kf, { duration: L * 1000, fill: 'both', easing: 'linear' }); a.pause(); anims.push(a);
  }
  window.__ir = function (t) { anims.forEach(function (a) { a.currentTime = (t % L) * 1000; }); };
  window.__montar = function () {
    var A = $('.cenaA'), B = $('.cenaB'), C = $('.cenaC');
    // cena A: a câmera lê o QR Code do contrato
    K(A, [[0, S(1)], [2.55, S(1)], [3.15, S(0, '0 -20px', .96)], [15.0, S(0, '0 -20px', .96)], [15.9, S(1)]]);
    K($('.mira'), [[0, S(0, '0 0', 3.4)], [.5, S(0, '0 0', 3.4)], [.9, S(1, '0 0', 3.4)], [2.1, S(1, '0 0', 1)], [2.6, S(1, '0 0', 1)], [2.9, S(0, '0 0', 1.2)], [15.9, S(0, '0 0', 3.4)]]);
    K($('.scan'), [[0, S(0, '0 -66px')], [2.0, S(0, '0 -66px')], [2.1, S(1, '0 -66px')], [2.55, S(1, '0 66px')], [2.65, S(0, '0 66px')], [15.9, S(0, '0 -66px')]]);
    K($('.ping'), [[0, S(0)], [2.55, S(0)], [2.6, S(.9)], [3.2, S(0, '0 0', 2.2)], [15.9, S(0)]]);
    // cena B: a página de conferência se monta
    K(B, [[0, S(0, '0 40px')], [3.0, S(0, '0 40px')], [3.6, S(1)], [8.0, S(1)], [8.5, S(0, '0 -30px')], [8.6, S(0, '0 40px')]]);
    [['.b-card', 3.8], ['.b-quem', 4.3], ['.b-p1', 4.5], ['.b-p2', 4.8], ['.b-corr', 5.2], ['.b-e1', 5.4], ['.b-e2', 5.75], ['.b-e3', 6.1], ['.b-e4', 6.45]].forEach(function (x) {
      K($(x[0]), [[0, S(0, '0 18px')], [x[1], S(0, '0 18px')], [x[1] + .45, S(1)], [8.0, S(1)], [8.5, S(0)], [8.6, S(0, '0 18px')]]);
      var ck = $('.ck', $(x[0]));
      if (ck) K(ck, [[0, S(0, '0 0', 0)], [x[1] + .3, S(0, '0 0', 0)], [x[1] + .75, S(1, '0 0', 1), POP], [8.5, S(1)], [8.6, S(0, '0 0', 0)]]);
    });
    K($('.st.wait'), [[0, S(0)], [5.3, S(0)], [5.5, S(1)], [6.9, S(1)], [7.05, S(0)]]);
    K($('.st.ok'), [[0, S(0)], [7.0, S(0, '0 0', .8)], [7.3, S(1, '0 0', 1), POP], [8.0, S(1)], [8.5, S(0)]]);
    // cena C: arrastar o PDF, primeiro o original, depois o alterado
    K(C, [[0, S(0, '0 40px')], [8.3, S(0, '0 40px')], [8.9, S(1)], [15.0, S(1)], [15.6, S(0, '0 -20px')], [15.7, S(0, '0 40px')]]);
    K($('.zona'), [[0, S(1)], [9.4, S(1)], [9.7, S(1, '0 0', 1.03)], [10.1, S(1)], [12.2, S(1)], [12.5, S(1, '0 0', 1.03)], [12.9, S(1)]]);
    K($('.arq1'), [[0, S(0, '430px -90px')], [8.9, S(0, '430px -90px')], [9.05, S(1, '430px -90px')], [9.6, S(1, '0 0'), MOVE], [9.85, S(0, '0 12px', .6)]]);
    K($('.calc1'), [[0, S(0)], [9.85, S(0)], [10.0, S(1)], [10.5, S(1)], [10.65, S(0)]]);
    K($('.res1'), [[0, S(0, '0 24px', .96)], [10.55, S(0, '0 24px', .96)], [11.0, S(1, '0 0', 1), POP], [11.9, S(1)], [12.3, S(0, '0 -8px')]]);
    K($('.arq2'), [[0, S(0, '430px -90px')], [11.8, S(0, '430px -90px')], [11.95, S(1, '430px -90px')], [12.5, S(1, '0 0'), MOVE], [12.75, S(0, '0 12px', .6)]]);
    K($('.calc2'), [[0, S(0)], [12.75, S(0)], [12.9, S(1)], [13.2, S(1)], [13.35, S(0)]]);
    K($('.res2'), [[0, S(0, '0 24px', .96)], [13.2, S(0, '0 24px', .96)], [13.5, S(1, '0 0', 1), POP], [13.55, S(1, '-10px 0')], [13.63, S(1, '10px 0')],
      [13.71, S(1, '-7px 0')], [13.79, S(1, '5px 0')], [13.87, S(1, '0 0')], [15.0, S(1)], [15.5, S(0, '0 -8px')]]);
    Array.prototype.slice.call(document.querySelectorAll('.spin')).forEach(function (el) {
      var a = el.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 900, iterations: Infinity }); a.pause(); anims.push(a);
    });
    // profundidade barata: o brilho passeia e o bloco respira
    K($('.glow.g1'), [[0, { translate: '0 0' }], [8, { translate: '-60px 50px' }], [16, { translate: '0 0' }]]);
    K($('.glow.g2'), [[0, { translate: '0 0' }], [8, { translate: '70px -40px' }], [16, { translate: '0 0' }]]);
    // título e apoio trocam com a cena: cada um entra subindo e sai subindo, no tempo da cena
    var tbs = [].slice.call(document.querySelectorAll('.tb')), JAN = [[0, 3.05], [3.05, 8.4], [8.4, 12.3], [12.3, 15.7]];
    tbs.forEach(function (el, i) {
      var j = JAN[i] || [0, 0], dn = S(0, '0 18px'), up = S(0, '0 -18px');
      if (i === 0) { K(el, [[0, S(1)], [j[1] - .15, S(1)], [j[1] + .25, up], [15.5, dn], [15.9, S(1)]]); }
      else { K(el, [[0, dn], [j[0] + .1, dn], [j[0] + .55, S(1)], [j[1] - .15, S(1)], [j[1] + .25, up], [16, up]]); }
    });
    if (document.documentElement.classList.contains('reels')) {
      var c0 = { '--ry': '10deg', '--rx': '6deg', scale: 1, translate: '0 0' };
      K($('.hero'), [[0, c0],
        [4, { '--ry': '8deg', '--rx': '5deg', scale: 1.02, translate: '-4px 3px' }],
        [8, { '--ry': '11.5deg', '--rx': '6.5deg', scale: 1, translate: '0 -5px' }],
        [12, { '--ry': '8.5deg', '--rx': '5deg', scale: 1.025, translate: '-4px 3px' }],
        [16, c0]]);
    } else {
      K($('.hero'), [[0, { scale: .985, translate: '0 0' }], [8, { scale: 1.015, translate: '0 -8px' }], [16, { scale: .985, translate: '0 0' }]]);
    }
    return L;
  };
})();
"""

# Roteiro da demo "contrato" (22 s): modelo, dados, link, cliente assina, pronto. Começa e termina com a janela vazia (fade),
# então o laço fecha sem salto.
DEMO2_JS = r"""
(function () {
  // Durações das cenas (s). Tudo é calculado a partir daqui, então mudar o ritmo é mexer só nesta lista.
  var D = [6.0, 8.4, 8.4, 5.8, 12.4, 6.2, 6.0], B = [], acc = 0;
  D.forEach(function (d) { B.push(acc); acc += d; });
  var L = Math.ceil(acc + .6), anims = [];
  var E = 'cubic-bezier(.4,0,.2,1)', POP = 'cubic-bezier(.34,1.56,.64,1)', SLIDE = 'cubic-bezier(.22,.7,.25,1)';
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function S(o, tr, sc) { return { opacity: o, translate: tr || '0 0', scale: sc == null ? 1 : sc }; }
  function K(el, pts) {
    if (!el) return;
    var kf = pts.map(function (p) { return Object.assign({ offset: p[0] / L, easing: p[2] || E }, p[1]); });
    if (kf[0].offset > 0) kf.unshift(Object.assign({}, kf[0], { offset: 0 }));
    if (kf[kf.length - 1].offset < 1) kf.push(Object.assign({}, kf[kf.length - 1], { offset: 1 }));
    var a = el.animate(kf, { duration: L * 1000, fill: 'both', easing: 'linear' }); a.pause(); anims.push(a);
  }
  function ENT(el, t, f, de) { var h = S(0, de || '0 20px', .96); K(el, [[0, h], [t, h], [t + .55, S(1), POP], [f, S(1)], [f + .45, S(0, '0 -14px')], [L, S(0, '0 -14px')]]); }
  function CENA(el, a, b) { K(el, [[0, S(0)], [a, S(0)], [a + .4, S(1)], [b, S(1)], [b + .4, S(0)], [L, S(0)]]); }
  function PRESS(el, t) { K(el, [[0, S(1)], [t, S(1)], [t + .15, S(1, '0 0', .95)], [t + .35, S(1)], [L, S(1)]]); }
  function TYPE(el, t, dur) { K(el, [[0, { clipPath: 'inset(0 100% 0 0)' }], [t, { clipPath: 'inset(0 100% 0 0)' }], [t + dur, { clipPath: 'inset(0 0 0 0)' }, 'linear'], [L, { clipPath: 'inset(0 0 0 0)' }]]); }
  window.__ir = function (t) { anims.forEach(function (x) { x.currentTime = (t % L) * 1000; }); };
  window.__montar = function () {
    var b0 = B[0], b1 = B[1], b2 = B[2], b3 = B[3], b4 = B[4], b5 = B[5], b6 = B[6], fim = acc;
    K($('.dclip'), [[0, S(0)], [.5, S(1)], [fim - .4, S(1)], [fim + .2, S(0)]]);
    // 0) a promessa: o contrato visual com o escudo
    var e0 = b0 + D[0] - .4; CENA($('.k0'), b0, e0);
    K($('.k0p'), [[0, S(0, '-30px 30px', .9)], [.5, S(0, '-30px 30px', .9)], [1.1, S(1), POP], [e0, S(1)], [e0 + .4, S(0)], [L, S(0)]]);
    K($('.carimbo'), [[0, S(0, '0 0', 2.4)], [1.9, S(0, '0 0', 2.4)], [2.4, S(1), POP], [e0, S(1)], [e0 + .4, S(0)], [L, S(0)]]);
    $$('.k0r').forEach(function (r, i) { ENT(r, 3.3 + .7 * i, e0); });
    // 1) os contratos visuais passando de um lado para o outro, e o Casamento fica em foco
    var e1 = b1 + D[1] - .4; CENA($('.k1'), b1, e1);
    ENT($('.k1t'), b1 + .4, e1);
    K($('.car2'), [[0, S(0)], [b1 + .6, S(0)], [b1 + 1.0, S(1)], [e1, S(1)], [e1 + .4, S(0)], [L, S(0)]]);
    var tr = $('.trilho2'); if (tr) {
      var kf = [{ offset: 0, translate: '1060px 0' }, { offset: (b1 + .6) / L, translate: '1060px 0' }, { offset: (b1 + 5.8) / L, translate: '0 0', easing: SLIDE }, { offset: 1, translate: '0 0' }];
      kf[1].easing = SLIDE; var a = tr.animate(kf, { duration: L * 1000, fill: 'both', easing: 'linear' }); a.pause(); anims.push(a);
    }
    $$('.pg').forEach(function (pg, i) {
      var foco = (i === parseInt(getComputedStyle($('.car2')).getPropertyValue('--foco'), 10));
      K(pg, [[0, S(1)], [b1 + 5.8, S(1)], [b1 + 6.3, S(foco ? 1 : .45, '0 0', foco ? 1.04 : 1)], [e1, S(foco ? 1 : .45, '0 0', foco ? 1.04 : 1)], [e1 + .4, S(1)], [L, S(1)]]);
      if (foco) K($('.gl', pg), [[0, S(0)], [b1 + 5.8, S(0)], [b1 + 6.3, S(1)], [e1, S(1)], [e1 + .4, S(0)], [L, S(0)]]);
    });
    K($('.k1r'), [[0, S(0, '0 16px', .9)], [b1 + 6.2, S(0, '0 16px', .9)], [b1 + 6.7, S(1), POP], [e1, S(1)], [e1 + .4, S(0)], [L, S(0)]]);
    // 2) personalizar
    var e2 = b2 + D[2] - .4; CENA($('.k2'), b2, e2);
    ENT($('.k2t'), b2 + .4, e2);
    $$('.cp').forEach(function (c, i) { var t = b2 + .8 + 1.0 * i; ENT(c, t, e2); TYPE($('.val span', c), t + .4, 1.3); });
    K($('.padrao'), [[0, S(0, '0 0', .8)], [b2 + 6.2, S(0, '0 0', .8)], [b2 + 6.6, S(1), POP], [e2, S(1)], [e2 + .4, S(0)], [L, S(0)]]);
    K($('.k2b'), [[0, S(0, '0 20px', .96)], [b2 + 6.9, S(0, '0 20px', .96)], [b2 + 7.4, S(1), POP], [b2 + 7.6, S(1, '0 0', .95)], [b2 + 7.8, S(1)], [e2, S(1)], [e2 + .4, S(0)], [L, S(0)]]);
    // 3) salvar e copiar o link
    var e3 = b3 + D[3] - .4; CENA($('.k3'), b3, e3);
    ENT($('.k3a'), b3 + .5, e3, '0 -30px'); ENT($('.k3b'), b3 + 1.3, e3);
    K($('.copiar .b1'), [[0, S(1)], [b3 + 3.3, S(1)], [b3 + 3.4, S(0)], [L, S(0)]]);
    K($('.copiar .b2'), [[0, S(0)], [b3 + 3.3, S(0)], [b3 + 3.45, S(1)], [e3, S(1)], [e3 + .4, S(0)], [L, S(0)]]);
    PRESS($('.copiar'), b3 + 3.1);
    // 4) o cliente no celular: preenche os dados, confirma, lê e assina
    var e4 = b4 + D[4] - .4, m = b4 + 6.0; CENA($('.k4'), b4, e4);
    K($('.fone'), [[0, S(0, '0 50px', .94)], [b4 + .3, S(0, '0 50px', .94)], [b4 + .9, S(1), POP], [e4, S(1)], [e4 + .4, S(0)], [L, S(0)]]);
    K($('.t1'), [[0, S(0)], [b4 + .8, S(0)], [b4 + 1.2, S(1)], [m - .3, S(1)], [m + .1, S(0, '-40px 0')], [L, S(0, '-40px 0')]]);
    ENT($('.t1 h5'), b4 + 1.3, m - .3);
    $$('.t1 .fc').forEach(function (c, i) { var t = b4 + 1.8 + 1.0 * i; ENT(c, t, m - .3); TYPE($('.val span', c), t + .35, 1.2); });
    K($('.t1 .fbtn'), [[0, S(0, '0 16px', .96)], [b4 + 4.7, S(0, '0 16px', .96)], [b4 + 5.1, S(1), POP], [b4 + 5.3, S(1, '0 0', .95)], [b4 + 5.5, S(1)], [m - .3, S(1)], [m + .1, S(0)], [L, S(0)]]);
    K($('.t2'), [[0, S(0, '40px 0')], [m, S(0, '40px 0')], [m + .4, S(1)], [e4, S(1)], [e4 + .4, S(0)], [L, S(0)]]);
    ENT($('.t2 h5'), m + .5, e4); ENT($('.docc'), m + .9, e4); ENT($('.vbtn'), m + 1.3, e4);
    K($('.vbtn .v1'), [[0, S(1)], [m + 2.6, S(1)], [m + 2.7, S(0)], [L, S(0)]]);
    K($('.vbtn .v2'), [[0, S(0)], [m + 2.6, S(0)], [m + 2.8, S(1)], [e4, S(1)], [L, S(1)]]);
    PRESS($('.vbtn'), m + 2.4);
    ENT($('.termo'), m + 3.2, e4);
    K($('.cx i'), [[0, S(0, '0 0', 0)], [m + 4.4, S(0, '0 0', 0)], [m + 4.8, S(1), POP], [e4, S(1)], [e4 + .4, S(0)], [L, S(0)]]);
    K($('.t2 .fbtn'), [[0, S(0, '0 16px', .96)], [m + 1.5, S(0, '0 16px', .96)], [m + 2.0, S(.4), POP], [m + 4.8, S(.4)], [m + 5.2, S(1)], [m + 5.5, S(1)], [m + 5.65, S(1, '0 0', .95)], [m + 5.85, S(1)], [e4, S(1)], [e4 + .4, S(0)], [L, S(0)]]);
    // 5) validade jurídica
    var e5 = b5 + D[5] - .4; CENA($('.k5'), b5, e5);
    K($('.grande-ok'), [[0, S(0, '0 0', .3)], [b5 + .3, S(0, '0 0', .3)], [b5 + .9, S(1), POP], [e5, S(1)], [e5 + .4, S(0)], [L, S(0)]]);
    K($('.grande-ok .anel'), [[0, S(0, '0 0', .8)], [b5 + .8, S(0, '0 0', .8)], [b5 + 1.0, S(.9)], [b5 + 2.0, S(0, '0 0', 1.35)], [L, S(0, '0 0', 1.35)]]);
    ENT($('.k5a'), b5 + 1.5, e5);
    $$('.k5r').forEach(function (r, i) { ENT(r, b5 + 2.4 + .6 * i, e5); });
    // 6) o que isso muda (decorados)
    var e6 = b6 + D[6] - .4; CENA($('.k6'), b6, e6);
    $$('.k6c').forEach(function (c, i) { ENT(c, b6 + .5 + .9 * i, e6); });
    ENT($('.k6p'), b6 + 3.5, e6);
    // título por cena (cada título, a janela em que aparece)
    var tbs = $$('.tb'), JAN = [[b0 + .1, b0 + 2.9], [b0 + 2.9, b1], [b1, b2], [b2, b3], [b3, b4], [b4, m], [m, b5], [b5, b6], [b6, fim - .3]];
    tbs.forEach(function (el, i) {
      var j = JAN[i] || [0, 0], dn = S(0, '0 18px'), up = S(0, '0 -18px');
      K(el, [[0, dn], [j[0] + .1, dn], [j[0] + .6, S(1)], [j[1] - .15, S(1)], [j[1] + .3, up], [L, up]]);
    });
    var c0 = { '--ry': '10deg', '--rx': '6deg', scale: 1, translate: '0 0' }, cam = [c0], n = 0;
    for (var t = 8; t < fim; t += 8) { n++; cam.push([t, n % 2 ? { '--ry': '8.5deg', '--rx': '5deg', scale: 1.022, translate: '-4px 3px' } : { '--ry': '11.5deg', '--rx': '6.5deg', scale: 1, translate: '0 -5px' }]); }
    cam = [[0, c0]].concat(cam.slice(1)).concat([[L, c0]]);
    K($('.hero'), cam);
    return L;
  };
})();
"""

PREVIEW_JS = r"""
document.fonts.ready.then(function () { setTimeout(function () {
  if (window.__preview != null) { window.__montar(); window.__ir(window.__preview); }
}, 120); });
"""


def montar(spec, marca, movimento=False):
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
<html lang="pt-BR" class="%(classe_html)s"><head><meta charset="utf-8"><title>%(titulo_plano)s</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>%(css)s</style></head>
<body><div class="arte">%(glows)s
  <div class="topo"><div class="marca"><img src="%(logo)s" alt="%(nome)s"><span>%(nome)s</span></div><div class="selo"><i></i>%(selo)s</div></div>
  <div class="heroarea"><div class="hero %(tipo)s">%(hero)s</div></div>
  %(bloco)s
  <div class="rodape"><div class="fim">%(rodape)s %(seta)s</div></div>
</div><script>%(js)s</script>%(movimento)s</body></html>""" % dict(
        glows='<div class="glow g1"></div><div class="glow g2"></div>' if tipo == "demo" else "",
        movimento=(("<script>%s</script>" % (DEMO2_JS if hero.get("cena") == "contrato" else DEMO_JS) + ("" if movimento else "<script>window.__preview=%s;</script>" % hero.get("quadro", 14.0)) + "<script>%s</script>" % PREVIEW_JS)
                   if tipo == "demo" else (("<script>%s</script>" % MOTION_JS) if movimento else "")),
        classe_html=spec.get("formato") if spec.get("formato") in ("reels", "capa") else "", titulo_plano=esc(sem_marcas(spec["titulo"])), css=css, logo="logo.png", nome=esc(marca["nome"]),
        selo=esc(spec.get("selo", "Novidade")), tipo=tipo, hero=HEROS[tipo](hero),
        bloco=('<div class="bloco pilha">%s</div>' % "".join('<div class="tb"><div class="grande">%s</div><div class="apoio">%s</div></div>' % (fmt_titulo(x["titulo"]), fmt_apoio(x["apoio"])) for x in hero["titulos"]))
              if tipo == "demo" and hero.get("titulos") else '<div class="bloco"><div class="grande">%s</div><div class="apoio">%s</div></div>' % (fmt_titulo(spec["titulo"]), fmt_apoio(spec["apoio"])), rodape=esc(rodape), seta=ico("seta"), js=JS)


TAMANHO = {"w": 1080, "h": 1350}


def chrome(args, timeout=120):
    base = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
            "--window-size=%d,%d" % (TAMANHO["w"], TAMANHO["h"]), "--virtual-time-budget=12000"]
    return subprocess.run(base + args, capture_output=True, text=True, timeout=timeout)


def main():
    ap = argparse.ArgumentParser(description="Gera a arte de Novidade de Produto (1080x1350, ou 1080x1920 vertical para Reels com \"formato\": \"reels\" no spec).")
    ap.add_argument("spec", help="arquivo .json com a especificação")
    ap.add_argument("--saida", help="pasta de saída (padrão: saida/ ao lado do spec)")
    ap.add_argument("--video", action="store_true", help="gera também o vídeo MP4 animado (precisa do node e do ffmpeg)")
    ap.add_argument("--fps", type=int, default=30, help="quadros por segundo do vídeo (padrão 30)")
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
    CONTEXTO["spec_dir"], CONTEXTO["saida"] = spec_path.parent, saida
    shutil.copy(AQUI / marca["logo"], saida / "logo.png")

    if spec.get("formato") == "reels":
        TAMANHO["w"], TAMANHO["h"] = 1080, 1920
    elif spec.get("formato") == "capa":
        TAMANHO["w"], TAMANHO["h"] = 1920, 1080
    html_path = saida / (nome + ".html")
    png_path = saida / (nome + ".png")
    html_path.write_text(montar(spec, marca), encoding="utf-8")

    r = chrome(["--dump-dom", "file://%s" % html_path])
    m = re.search(r'<pre id="rel"[^>]*>(.*?)</pre>', r.stdout, re.S)
    rel = json.loads(html.unescape(m.group(1))) if m else {}
    chrome(["--screenshot=%s" % png_path, "file://%s" % html_path])

    print("PNG:  %s\nHTML: %s" % (png_path, html_path))
    if a.video:
        mov_html = saida / (nome + "-movimento.html")
        mov_html.write_text(montar(spec, marca, movimento=True), encoding="utf-8")
        node = AQUI / "motion" / "capturar.js"
        print("Gerando o vídeo (pode levar alguns minutos)...")
        r = subprocess.run(["node", str(node), str(mov_html), str(saida), nome + "-movimento", str(a.fps), str(TAMANHO["w"]), str(TAMANHO["h"])], text=True)
        if r.returncode != 0:
            print("AVISO: o vídeo não saiu, veja o erro acima.")
    if not rel:
        print("AVISO: não consegui ler o relatório de conferência. Olhe a imagem com cuidado.")
        return
    print("Conferência: título %d linha(s) a %dpx, apoio %d linha(s), hero %dpx em área de %dpx (escala %.2f)" % (
        rel["tituloLinhas"], rel["tituloFonte"], rel["apoioLinhas"], rel["heroAltura"], rel["areaDisponivel"], rel["heroEscala"]))
    avisos = []
    if rel["tituloLinhas"] > rel.get("maxLinhas", 2):
        avisos.append("título passou do limite de linhas: encurte.")
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
