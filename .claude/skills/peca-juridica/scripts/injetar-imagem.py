#!/usr/bin/env python3
"""
Injeta uma ou mais imagens locais como data URI base64 no lugar de placeholders
num arquivo HTML de peça jurídica. Evita colar base64 gigante direto no contexto
da conversa.

Uso (1 imagem):
  python3 injetar-imagem.py --html documento.html --placeholder CAPA_IMG_SRC --imagem capa.jpg

Uso (várias imagens na mesma chamada, na ordem):
  python3 injetar-imagem.py --html documento.html \
    --placeholder CAPA_IMG_SRC --imagem capa.jpg \
    --placeholder LOGO_IMG_SRC --imagem logo.png

Por padrão sobrescreve o próprio --html. Use --saida para gravar em outro arquivo.
"""
import argparse
import base64
import mimetypes
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", required=True, help="Arquivo HTML com os placeholders")
    parser.add_argument("--placeholder", action="append", required=True, help="Texto literal a substituir (repetível)")
    parser.add_argument("--imagem", action="append", required=True, help="Caminho da imagem local (repetível, na mesma ordem dos placeholders)")
    parser.add_argument("--saida", help="Arquivo de saída. Se omitido, sobrescreve --html")
    args = parser.parse_args()

    if len(args.placeholder) != len(args.imagem):
        sys.exit("Número de --placeholder e --imagem precisa ser igual")

    with open(args.html, "r", encoding="utf-8") as f:
        html = f.read()

    for placeholder, imagem in zip(args.placeholder, args.imagem):
        mime = mimetypes.guess_type(imagem)[0] or "image/jpeg"
        with open(imagem, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("ascii")
        data_uri = f"data:{mime};base64,{b64}"
        ocorrencias = html.count(placeholder)
        if ocorrencias == 0:
            print(f'aviso: placeholder "{placeholder}" não encontrado no HTML', file=sys.stderr)
        html = html.replace(placeholder, data_uri)
        print(f"{placeholder} -> {imagem} ({ocorrencias} ocorrência(s), {len(b64)} chars base64)")

    saida = args.saida or args.html
    with open(saida, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Arquivo salvo: {saida} ({len(html)} caracteres)")


if __name__ == "__main__":
    main()
