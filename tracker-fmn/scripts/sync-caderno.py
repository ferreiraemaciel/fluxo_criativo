# -*- coding: utf-8 -*-
"""Leva o caderno da Black (BLACK-FRIDAY-2026.md) para dentro do Tracker.

Quebra o arquivo nas partes (# PARTE ...), converte cada uma em HTML simples e
gera o SQL que atualiza a tabela pico_caderno. Rodar depois de escrever no caderno:

    python3 scripts/sync-caderno.py && npx supabase db query --linked -f /tmp/caderno.sql
"""
import html
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
MD = RAIZ / "BLACK-FRIDAY-2026.md"
SAIDA = Path("/tmp/caderno.sql")


def inline(t):
    """Negrito, itálico, código, link e o resto escapado."""
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<i>\1</i>", t)
    return t


def para_html(linhas):
    out, i = [], 0
    while i < len(linhas):
        l = linhas[i].rstrip()
        if not l.strip():
            i += 1
            continue
        if l.startswith("|") and i + 1 < len(linhas) and set(linhas[i + 1].replace("|", "").strip()) <= set("-: "):
            cabec = [c.strip() for c in l.strip("|").split("|")]
            i += 2
            corpo = []
            while i < len(linhas) and linhas[i].lstrip().startswith("|"):
                corpo.append([c.strip() for c in linhas[i].strip().strip("|").split("|")])
                i += 1
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in cabec) +
                       "</tr></thead><tbody>" +
                       "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in linha) + "</tr>" for linha in corpo) +
                       "</tbody></table>")
            continue
        if l.startswith("```"):
            i += 1
            bloco = []
            while i < len(linhas) and not linhas[i].startswith("```"):
                bloco.append(linhas[i])
                i += 1
            i += 1
            out.append("<pre>" + html.escape("\n".join(bloco)) + "</pre>")
            continue
        m = re.match(r"^(#{2,4})\s+(.*)$", l)
        if m:
            n = len(m.group(1)) + 1
            out.append(f"<h{n}>{inline(m.group(2))}</h{n}>")
            i += 1
            continue
        if l.strip() in ("---", "***"):
            out.append("<hr>")
            i += 1
            continue
        if re.match(r"^\s*[-*]\s+\[[ x]\]", l):      # checklist vira item comum
            l = re.sub(r"^(\s*[-*]\s+)\[[ x]\]\s*", r"\1", l)
        if re.match(r"^\s*([-*]|\d+\.)\s+", l):
            ordenada = bool(re.match(r"^\s*\d+\.", l))
            itens = []
            while i < len(linhas) and re.match(r"^\s*([-*]|\d+\.)\s+", linhas[i]):
                itens.append(re.sub(r"^\s*([-*]|\d+\.)\s+", "", linhas[i].rstrip()))
                i += 1
            tag = "ol" if ordenada else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in itens) + f"</{tag}>")
            continue
        if l.startswith(">"):
            cit = []
            while i < len(linhas) and linhas[i].startswith(">"):
                cit.append(linhas[i].lstrip("> ").rstrip())
                i += 1
            out.append("<blockquote>" + inline(" ".join(cit)) + "</blockquote>")
            continue
        paragrafo = []
        while i < len(linhas) and linhas[i].strip() and not re.match(r"^(#{2,4}\s|\||>|\s*([-*]|\d+\.)\s|---$)", linhas[i]):
            paragrafo.append(linhas[i].rstrip())
            i += 1
        out.append("<p>" + inline(" ".join(paragrafo)) + "</p>")
    return "".join(out)


def main():
    texto = MD.read_text(encoding="utf-8")
    linhas = texto.split("\n")
    partes, atual = [], {"numero": 0, "titulo": "Abertura", "linhas": []}
    for l in linhas:
        m = re.match(r"^#\s+(?:PARTE\s+(\d+)\.?\s*)?(.*)$", l)
        if m:
            partes.append(atual)
            atual = {"numero": int(m.group(1)) if m.group(1) else 0, "titulo": m.group(2).strip(), "linhas": []}
        else:
            atual["linhas"].append(l)
    partes.append(atual)
    partes = [p for p in partes if "".join(p["linhas"]).strip()]

    q = lambda s: "'" + s.replace("'", "''") + "'"
    sql = ["delete from pico_caderno;",
           "insert into pico_caderno (numero, titulo, html, texto, ordem) values"]
    vals = []
    for ordem, p in enumerate(partes):
        corpo = "\n".join(p["linhas"])
        vals.append("  ({}, {}, {}, {}, {})".format(
            p["numero"], q(p["titulo"]), q(para_html(p["linhas"])),
            q(re.sub(r"\s+", " ", re.sub(r"[#*`|>]", " ", corpo))[:20000]), ordem))
    sql.append(",\n".join(vals) + ";")
    SAIDA.write_text("\n".join(sql) + "\n", encoding="utf-8")
    print(f"{len(partes)} partes, {SAIDA} com {SAIDA.stat().st_size // 1024} KB")
    for p in partes:
        print(f"  {p['numero']:>2} {p['titulo'][:70]}")


if __name__ == "__main__":
    sys.exit(main())
