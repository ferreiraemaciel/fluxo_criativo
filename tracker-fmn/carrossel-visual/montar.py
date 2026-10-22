# -*- coding: utf-8 -*-
"""Monta um carrossel do Orgânico a partir das peças soltas (PNG com transparência).

O texto NUNCA vem da geração de imagem: a peça é desenho, o texto entra aqui,
que é onde o acento é garantido, o contador não erra e a ordem não troca.

Uso:
    python3 montar.py <pasta-do-carrossel>

A pasta precisa ter um carrossel.json (gabarito + slides) e as peças.
Depois:  node capturar.js <pasta-do-carrossel>
"""
import json, sys
from pathlib import Path
from PIL import Image as _Im

PASTA = Path(sys.argv[1] if len(sys.argv) > 1 else '.').resolve()
cfg = json.loads((PASTA / 'carrossel.json').read_text(encoding='utf-8'))
G, SLIDES = cfg['gabarito'], cfg['slides']
G.setdefault('tag_top', G['capa_top'] - 86)

CSS = """
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Patrick+Hand&family=Oswald:wght@600&family=Playfair+Display:wght@800&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{width:1080px;height:1350px;position:relative;overflow:hidden}
.fundo{position:absolute;inset:0;width:1080px;height:1350px;object-fit:cover}

/* ---- placa: peca do GPT, muda a cada slide. o texto por cima nunca muda ---- */
.conj{position:absolute;left:%(placa_left)spx;top:%(placa_top)spx;width:%(placa_w)spx}
.capa .conj{left:%(capa_left)spx;top:%(capa_top)spx;width:%(capa_w)spx}
.conj img.placa{display:block;width:100%%;position:relative;z-index:2}
.poste{z-index:1}
.naplaca{position:absolute;left:112px;right:112px;top:50%%;transform:translateY(-50%%);
  display:flex;flex-direction:column;justify-content:center;
  z-index:3;text-align:center;font-family:Anton,sans-serif;color:#15120c;text-transform:uppercase;
  line-height:1.2;letter-spacing:.004em;filter:url(#lasca)}
.naplaca span,.tit span{display:block}
.tag{position:absolute;left:0;right:0;top:%(tag_top)spx;z-index:3;text-align:center;font-family:Oswald,sans-serif;
  font-weight:600;font-size:28px;letter-spacing:.26em;text-transform:uppercase;color:#4d432f}
.poste{position:absolute;left:50%%;transform:translateX(-50%%)}

/* ---- historia: corpo 56, entrelinha medida nos slides dele ---- */
.hist{position:absolute;top:%(hist_top)spx;font-family:'Patrick Hand',cursive;
  font-size:%(hist_corpo)spx;line-height:%(hist_entrelinha)s;color:#211c15}
.hist.A{left:120px;right:120px;text-align:center}
.hist.B{left:140px;right:300px;text-align:left}

/* ---- ilustracao: inteira, alternando de lado ---- */
.ilustra{position:absolute;top:%(ilustra_top)spx;height:%(ilustra_h)spx;display:flex;
  align-items:flex-end}
.ilustra.A{left:140px} .ilustra.B{right:120px}
.ilustra img{max-height:%(ilustra_h)spx;max-width:600px}

.tit{position:absolute;left:78px;right:78px;text-align:center;font-family:Anton,sans-serif;
  text-transform:uppercase;line-height:1.08;letter-spacing:.004em;filter:url(#lasca)}
.tri{position:absolute;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:46px}
.tri img{max-height:240px}
.alerta{position:absolute;left:0;right:0;display:flex;justify-content:center}
.alerta img{max-height:250px}
.marca{position:absolute;left:62px;bottom:118px;width:380px;opacity:.16;
  transform:rotate(-7deg);pointer-events:none}
.marca2{position:absolute;right:58px;bottom:126px;width:150px;opacity:.16;
  transform:rotate(6deg);pointer-events:none}
.nota{position:absolute;left:200px;right:200px;bottom:150px;text-align:center;
  font-family:'Patrick Hand',cursive;font-size:44px;line-height:1.34;color:#3a3226}
.arroba{position:absolute;left:0;right:0;bottom:50px;text-align:center;
  font-family:'Patrick Hand',cursive;font-size:36px;color:#554b39}
.pontos{position:absolute;left:62px;top:%(rodape)spx;display:flex;gap:13px}
.pontos i{width:14px;height:14px;border-radius:50%%;border:3px solid #15120c;display:block}
.pontos i.on{background:#15120c}
.setas{position:absolute;right:62px;top:%(rodape)spx;margin-top:-14px;
  font-family:Anton,sans-serif;font-size:36px;color:#15120c;letter-spacing:.1em}

/* a virada e o fecho trocam de fundo, entao trocam de cor */
.virada .tri{top:214px}
.virada .tit{color:#F7C53D;top:470px;font-size:92px}
.virada .hist{color:#F7C53D;left:116px;right:116px;text-align:center;top:930px;font-size:46px}
.virada .pontos i{border-color:#F7C53D} .virada .pontos i.on{background:#F7C53D}
.virada .setas{color:#F7C53D}
.cta .alerta{top:250px}
.cta .tit{color:#B3261E;top:556px;font-family:'Playfair Display',serif;font-weight:800;
  text-transform:none;font-size:140px;line-height:1.1;filter:none}
.cta .hist{color:#7d2a24;left:140px;right:140px;text-align:center;top:764px;font-size:50px;
  line-height:1.38}
.cta .pontos i{border-color:#B3261E} .cta .pontos i.on{background:#B3261E}
.cta .arroba{color:#B3261E;font-family:Oswald,sans-serif;font-weight:600;font-size:30px;
  letter-spacing:.06em}
""" % G

FILTRO = ('<svg width="0" height="0"><filter id="lasca">'
  '<feTurbulence type="fractalNoise" baseFrequency="0.07 0.11" numOctaves="4" seed="7" result="r"/>'
  '<feDisplacementMap in="SourceGraphic" in2="r" scale="5" '
  'xChannelSelector="R" yChannelSelector="G"/></filter></svg>')

AJUSTE = """<script>
  function largura(s){
    var r = document.createRange(); r.selectNodeContents(s);
    return r.getBoundingClientRect().width;
  }
  document.fonts.ready.then(function(){
    // na placa, cada linha recebe o corpo que faz ela encostar nas duas bordas:
    // a primeira e a segunda comecam e terminam no mesmo lugar
    document.querySelectorAll('.naplaca').forEach(function(el){
      var limite = el.clientWidth, teto = 124;
      el.querySelectorAll('span').forEach(function(s){
        var base = parseFloat(getComputedStyle(el).fontSize);
        s.style.fontSize = base + 'px';
        for (var i = 0; i < 8; i++) {
          var w = largura(s);
          if (!w) break;
          var novo = Math.min(teto, parseFloat(s.style.fontSize) * limite / w);
          if (Math.abs(novo - parseFloat(s.style.fontSize)) < 0.4) break;
          s.style.fontSize = novo + 'px';
        }
      });
      for (var v = 0; v < 30; v++) {
        var soma = 0;
        el.querySelectorAll('span').forEach(function(s){
          soma += s.getBoundingClientRect().height;
        });
        if (soma <= el.clientHeight) break;
        el.querySelectorAll('span').forEach(function(s){
          s.style.fontSize = (parseFloat(s.style.fontSize) * 0.96) + 'px';
        });
      }
    });
    // no slide preto e no fecho, o bloco inteiro encolhe ate caber
    document.querySelectorAll('.tit.encaixa').forEach(function(el){
      var limite = el.clientWidth;
      for (var i = 0; i < 60; i++) {
        var maior = 0;
        el.querySelectorAll('span').forEach(function(s){
          maior = Math.max(maior, largura(s));
        });
        if (maior <= limite) break;
        el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) - 2) + 'px';
      }
    });
    document.querySelectorAll('.ilustra').forEach(function(el){
      var h = document.querySelector('.hist');
      if (!h) return;
      var pe = h.getBoundingClientRect().bottom + 30;
      var topo = Math.max(pe, parseFloat(getComputedStyle(el).top));
      el.style.top = topo + 'px';
      el.style.height = Math.max(150, 1206 - topo) + 'px';
      el.querySelectorAll('img').forEach(function(i){ i.style.maxHeight = '100%'; });
    });
  });
</script>"""

TOTAL = len(SLIDES)

def linhas_span(txt):
    return ''.join(f'<span>{l}</span>' for l in txt.split('<br>'))

def altura_placa(caminho, larg):
    im = _Im.open(PASTA / caminho)
    return round(larg * im.height / im.width)

def html(s):
    cls = {'virada':'virada','cta':'cta','capa':'capa'}.get(s['tipo'],'')
    # o contador so existe a partir do slide 2, entao conta de 1 a 6
    # o contador existe so no miolo, do slide 2 ao 5, entao sao quatro bolinhas
    pontos = ('' if s['n'] in (1, TOTAL) else
              ''.join('<i class="on"></i>' if k < s['n']-1 else '<i></i>' for k in range(TOTAL-2)))
    setas = '' if s['n']==TOTAL else '<div class="setas">&gt;&gt;&gt;</div>'
    c=[f'<img class="fundo" src="{s["fundo"]}">']
    if s.get('marca'):
        # a camera de um lado e o filme do outro assinam o assunto sem roubar a cena
        c.append(f'<img class="marca" src="{s["marca"]}">')
        c.append('<img class="marca2" src="assets/ilustracoes/filme-35mm.png">')
    if s.get('placa'):
        larg = G['capa_w'] if s['tipo']=='capa' else G['placa_w']
        topo = G['capa_top'] if s['tipo']=='capa' else G['placa_top']
        alt = altura_placa(s['placa'], larg)
        c.append('<div class="conj">')
        if s.get('poste'):
            c.append(f'<img class="poste" src="biblioteca/poste-madeira.png" '
                     f'style="top:{alt-46}px;height:{1086-topo-alt}px">')
        c.append(f'<img class="placa" src="{s["placa"]}">')

        desl = 24 if s.get('tag') else 0
        n_linhas = s['titulo'].count('<br>') + 1
        corpo = 104 if n_linhas == 2 else 86
        c.append(f'<div class="naplaca" style="font-size:{corpo}px;'
                 f'height:{int(alt*0.60)}px">{linhas_span(s["titulo"])}</div>')
        c.append('</div>')
    if s.get('triangulos'):
        c.append('<div class="tri">' + ''.join(f'<img src="{t}">' for t in s['triangulos']) + '</div>')
    if s.get('alerta'):
        c.append(f'<div class="alerta"><img src="{s["alerta"]}"></div>')
    if s['tipo'] in ('virada','cta'):
        c.append(f'<div class="tit encaixa">{linhas_span(s["titulo"])}</div>')
    if s.get('hist'):
        v = s.get('var','A')
        c.append(f'<div class="hist {v}">{s["hist"]}</div>')
    if s.get('ilustra'):
        v = s.get('var','A')
        c.append(f'<div class="ilustra {v}"><img src="{s["ilustra"]}"></div>')
    if s.get('tag'): c.append(f'<div class="tag">{s["tag"]}</div>')
    if s.get('nota'): c.append(f'<div class="nota">{s["nota"]}</div>')
    if s.get('arroba'): c.append(f'<div class="arroba">{s["arroba"]}</div>')
    if pontos: c.append(f'<div class="pontos">{pontos}</div>')
    c.append(setas)
    return ('<!doctype html><meta charset="utf-8"><style>'+CSS+'</style>'+FILTRO+
            f'<body class="{cls}">'+''.join(c)+AJUSTE)

for s in SLIDES:
    (PASTA / f'{s["n"]}.html').write_text(html(s), encoding='utf-8')
print(f'{len(SLIDES)} páginas escritas em {PASTA}')
