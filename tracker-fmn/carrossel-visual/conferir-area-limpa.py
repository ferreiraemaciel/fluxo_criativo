# -*- coding: utf-8 -*-
"""Confere se a área reservada de cada slide veio limpa o bastante pra receber texto.

O GPT costuma preencher espaço que a gente pediu vazio. Isso aparece tarde, com o
texto já montado por cima do desenho. Esta conferência aponta antes.

Uso:
    python3 conferir-area-limpa.py <pasta> [faixa]

<pasta>  tem os slides em PNG (slide-01.png, 1.png, qualquer nome, ordem alfabética)
[faixa]  a faixa reservada, em fração da altura. Padrão "0.62-0.97" (a metade de baixo).
         Pode passar por slide: "1:0.5-0.97,5:0.0-0.33"
"""
import sys, glob, re
from pathlib import Path
import numpy as np
from PIL import Image

pasta = Path(sys.argv[1]).resolve()
spec  = sys.argv[2] if len(sys.argv) > 2 else "0.62-0.97"

def faixas(spec, n):
    """Devolve {indice: (ini, fim)} em fração da altura."""
    if ':' not in spec:
        a, b = (float(x) for x in spec.split('-'))
        return {i: (a, b) for i in range(1, n + 1)}
    fora = {}
    for parte in spec.split(','):
        idx, intervalo = parte.split(':')
        a, b = (float(x) for x in intervalo.split('-'))
        fora[int(idx)] = (a, b)
    return fora

arquivos = sorted(glob.glob(str(pasta / '*.png')))
F = faixas(spec, len(arquivos))
print(f'{"slide":28s} {"faixa":>13s} {"variação":>9s} {"borda":>7s}  veredito')
for i, f in enumerate(arquivos, 1):
    a, b = F.get(i, (0.62, 0.97))
    im = np.array(Image.open(f).convert('L')).astype(float)
    h = im.shape[0]
    corte = im[int(h * a):int(h * b), 40:-40]
    # variação do tom: textura de parede fica baixa, desenho sobe
    variacao = corte.std()
    # densidade de borda: pega contorno de caneta, que textura nenhuma produz
    dx = np.abs(np.diff(corte, axis=1)); dy = np.abs(np.diff(corte, axis=0))
    borda = ((dx > 26).mean() + (dy > 26).mean()) / 2 * 100
    sujo = variacao > 16 or borda > 0.45
    nome = Path(f).name
    print(f'{nome:28s} {f"{a:.2f}-{b:.2f}":>13s} {variacao:9.1f} {borda:6.2f}%  '
          f'{"REGERAR, tem desenho na área" if sujo else "limpa"}')
