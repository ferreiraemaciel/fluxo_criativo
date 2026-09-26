#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fatiar.py — corta a tira larga exportada do Canva em slides soltos de carrossel.

O Canva exporta o carrossel inteiro numa imagem só, lado a lado. Este script
corta essa tira em fatias do tamanho de um slide, sem reamostrar nada (cada
pixel sai igual ao que entrou), e salva em JPG na qualidade máxima.

- Aceita um arquivo, vários arquivos ou uma pasta (ordem alfabética).
- Descobre sozinho a largura do slide pela altura (4:5), ou use --largura.
- Recusa cortar se a largura da tira não for múltipla exata da do slide,
  porque aí o corte cairia no meio do texto.
- Descarta as fatias em branco que sobram no fim da última tira.
- Numera tudo em sequência contínua, mesmo vindo de vários arquivos.

Uso:
  python3 fatiar.py --entrada "/caminho/da/pasta" --saida "/caminho/cards" --prefixo "ORG 081 slide"
  python3 fatiar.py --entrada a.png b.png --largura 1080
"""
import argparse, sys
from pathlib import Path

try:
    from PIL import Image, ImageStat
except ImportError:
    sys.exit("Falta o Pillow. Instale com: python3 -m pip install --user Pillow")

EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def entradas(paths):
    arquivos = []
    for p in paths:
        p = Path(p).expanduser()
        if p.is_dir():
            arquivos += sorted(x for x in p.iterdir() if x.suffix.lower() in EXTS)
        elif p.suffix.lower() in EXTS:
            arquivos.append(p)
    if not arquivos:
        sys.exit("Nenhuma imagem encontrada na entrada.")
    return arquivos


def em_branco(img, tolerancia=2.0):
    """Fatia sem conteúdo: desvio padrão praticamente zero nos três canais."""
    stat = ImageStat.Stat(img.convert("RGB"))
    return max(stat.stddev) < tolerancia


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", nargs="+", required=True, help="arquivo(s) ou pasta")
    ap.add_argument("--saida", help="pasta de destino (padrão: <entrada>/cards)")
    ap.add_argument("--largura", type=int, help="largura de um slide em px (padrão: altura x 0,8, que é 4:5)")
    ap.add_argument("--prefixo", default="slide", help="prefixo do nome dos arquivos")
    ap.add_argument("--qualidade", type=int, default=100)
    ap.add_argument("--manter-vazios", action="store_true", help="não descarta as fatias em branco")
    a = ap.parse_args()

    arquivos = entradas(a.entrada)
    destino = Path(a.saida).expanduser() if a.saida else arquivos[0].parent / "cards"
    destino.mkdir(parents=True, exist_ok=True)

    n = 0
    vazios = 0
    salvos = []
    for arq in arquivos:
        img = Image.open(arq)
        larg_slide = a.largura or round(img.height * 0.8)
        if img.width % larg_slide:
            sys.exit(f"{arq.name}: largura {img.width} não é múltiplo exato de {larg_slide}. "
                     f"Confira a exportação do Canva ou passe --largura.")
        fatias = img.width // larg_slide
        print(f"{arq.name}: {img.width}x{img.height} = {fatias} fatia(s) de {larg_slide}x{img.height}")
        for i in range(fatias):
            corte = img.crop((i * larg_slide, 0, (i + 1) * larg_slide, img.height))
            if not a.manter_vazios and em_branco(corte):
                vazios += 1
                continue
            n += 1
            nome = destino / f"{a.prefixo} {n:02d}.jpg"
            corte.convert("RGB").save(nome, "JPEG", quality=a.qualidade,
                                      subsampling=0, optimize=True, progressive=False)
            salvos.append(nome)

    print(f"\nOK: {n} slide(s) em {destino}")
    if vazios:
        print(f"{vazios} fatia(s) em branco descartada(s).")
    for s in salvos:
        print(" ", s.name)


if __name__ == "__main__":
    main()
