#!/usr/bin/env python3
"""
Reunião: separa o documento "Anotações do Gemini" em partes legíveis.

O documento do Drive tem duas partes: as notas (Resumo, Decisões, Próximas etapas,
Detalhes) e a transcrição inteira, que passa de 80 mil caracteres. A leitura normal
da skill usa só as notas. A transcrição fica para consulta pontual.

Aceita como entrada o arquivo salvo pela ferramenta do Drive (JSON com o campo
"fileContent") ou um arquivo de texto comum.

Uso:
  python3 scripts/reuniao-extrair-notas.py ARQUIVO                 # só as notas
  python3 scripts/reuniao-extrair-notas.py ARQUIVO --transcricao   # transcrição inteira
  python3 scripts/reuniao-extrair-notas.py ARQUIVO --buscar "afiliado" [--contexto 6]
"""

import argparse
import json
import re
import sys
from pathlib import Path


def carregar(caminho: str) -> str:
    bruto = Path(caminho).read_text(encoding="utf-8", errors="replace")
    try:
        dados = json.loads(bruto)
        if isinstance(dados, dict) and "fileContent" in dados:
            return dados["fileContent"]
    except json.JSONDecodeError:
        pass
    return bruto


def limpar(texto: str) -> str:
    # os emojis dos títulos chegam quebrados (mojibake) e só atrapalham a leitura
    texto = re.sub(r"[ðÂ][\x80-\xbf]{1,3}", "", texto)
    texto = re.sub(r"\n{3,}", "\n\n", texto)
    return texto.strip()


def separar(texto: str):
    m = re.search(r"^#\s*\*{0,2}.{0,6}\s*Transcri[çc][ãa]o", texto, re.M)
    if not m:
        return texto, ""
    return texto[: m.start()], texto[m.start():]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("arquivo")
    ap.add_argument("--transcricao", action="store_true", help="imprime a transcrição inteira")
    ap.add_argument("--buscar", help="procura um termo na transcrição e mostra o entorno")
    ap.add_argument("--contexto", type=int, default=4, help="linhas ao redor de cada ocorrência")
    args = ap.parse_args()

    texto = carregar(args.arquivo)
    notas, transcricao = separar(texto)

    if args.transcricao:
        print(limpar(transcricao))
        return

    if args.buscar:
        linhas = transcricao.splitlines()
        termo = args.buscar.lower()
        achou = False
        for i, linha in enumerate(linhas):
            if termo in linha.lower():
                achou = True
                ini, fim = max(0, i - args.contexto), min(len(linhas), i + args.contexto + 1)
                print(f"--- linha {i} ---")
                print("\n".join(l for l in linhas[ini:fim] if l.strip()))
        if not achou:
            print(f"Nenhuma ocorrência de '{args.buscar}' na transcrição.", file=sys.stderr)
        return

    print(limpar(notas))
    print(f"\n[Notas: {len(notas)} caracteres. Transcrição separada: {len(transcricao)} caracteres.]")


if __name__ == "__main__":
    main()
