#!/usr/bin/env python3
"""Carimba no index.html a versão de cada arquivo do painel.

Antes disso o ?v=N de cada script era escrito à mão, e em 34 das 183
publicações alguém esqueceu de subir o número: o time ficava rodando uma
mistura de versões, uma tela nova conversando com um shared.jsx velho. Como
tudo no painel divide o mesmo escopo, isso não dava erro, dava número errado.
Auditoria de 12/09/2026.

Agora o carimbo é o resumo do próprio conteúdo do arquivo: mudou o arquivo,
muda o carimbo, e o navegador baixa de novo sozinho.
"""
import hashlib
import pathlib
import re
import sys

raiz = pathlib.Path(__file__).resolve().parent.parent / "frontend"
indice = raiz / "index.html"
html = indice.read_text(encoding="utf-8")

def carimbo(arquivo: pathlib.Path) -> str:
    return hashlib.md5(arquivo.read_bytes()).hexdigest()[:8]

trocados = 0
faltando = []

def substituir(m):
    global trocados
    caminho, _ = m.group(1), m.group(2)
    arquivo = raiz / caminho
    if not arquivo.exists():
        faltando.append(caminho)
        return m.group(0)
    trocados += 1
    return f'src="{caminho}?v={carimbo(arquivo)}"'

html_novo = re.sub(r'src="(app/[^"?]+)\?v=([^"]*)"', substituir, html)

if faltando:
    print("arquivos citados no index.html que não existem:", ", ".join(faltando), file=sys.stderr)
    sys.exit(1)

if html_novo != html:
    indice.write_text(html_novo, encoding="utf-8")
    print(f"carimbadas {trocados} entradas em {indice.name}")
else:
    print(f"nada a carimbar ({trocados} entradas já estavam em dia)")
