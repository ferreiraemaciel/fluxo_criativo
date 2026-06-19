"""
dividir-fonte.py

Divide um arquivo de texto em blocos de no maximo N caracteres, cortando em
fronteira de frase para nao quebrar no meio de uma ideia. Usado pela skill
gestor-pedagogico para processar material longo (curso, palestra) sem estourar
o contexto de um unico sub-agente: cada bloco e resumido por um sub-agente e os
resumos viram um digest que alimenta os entregaveis pesados.

Uso:
    python3 scripts/dividir-fonte.py <arquivo> --out-dir <pasta> --max-chars 40000

Gera _bloco-01.txt, _bloco-02.txt, ... na pasta indicada e imprime no stdout
apenas a quantidade de blocos gerados (so o numero), para a skill ler.
"""

import argparse
import os
import re
import sys


def dividir(texto: str, max_chars: int):
    """Quebra o texto em blocos <= max_chars, preferindo fronteira de frase."""
    frases = re.split(r"(?<=[.!?])\s+", texto.strip())
    blocos = []
    atual = ""
    for f in frases:
        f = f.strip()
        if not f:
            continue
        if atual and len(atual) + len(f) + 1 > max_chars:
            blocos.append(atual.strip())
            atual = f
        else:
            atual = (atual + " " + f).strip() if atual else f
        # Frase unica maior que o limite: corta forcado em pedacos.
        while len(atual) > max_chars:
            blocos.append(atual[:max_chars])
            atual = atual[max_chars:].strip()
    if atual.strip():
        blocos.append(atual.strip())
    return blocos


def main():
    parser = argparse.ArgumentParser(description="Divide um texto em blocos por frase.")
    parser.add_argument("arquivo", help="Arquivo de texto a dividir")
    parser.add_argument("--out-dir", required=True, help="Pasta de saida dos blocos")
    parser.add_argument("--max-chars", type=int, default=40000, help="Tamanho maximo por bloco")
    args = parser.parse_args()

    if not os.path.isfile(args.arquivo):
        print(f"Arquivo nao encontrado: {args.arquivo}", file=sys.stderr)
        sys.exit(1)

    with open(args.arquivo, encoding="utf-8") as f:
        texto = f.read()

    os.makedirs(args.out_dir, exist_ok=True)
    blocos = dividir(texto, args.max_chars)
    for i, bloco in enumerate(blocos, 1):
        caminho = os.path.join(args.out_dir, f"_bloco-{i:02d}.txt")
        with open(caminho, "w", encoding="utf-8") as out:
            out.write(bloco)

    print(len(blocos))


if __name__ == "__main__":
    main()
