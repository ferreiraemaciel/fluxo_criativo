#!/usr/bin/env python3
"""
Reunião: gera o PDF de resumo e pauta com a identidade visual da FMN.

Lê um JSON com o conteúdo, monta um HTML nas cores e na fonte da FMN e converte
para PDF pelo Chrome, sem ferramenta extra. Tokens de cor vêm de
fmn-site/public/colors_and_type.css.

O documento abre com um aviso de confidencialidade (constante AVISO abaixo) e
repete "Documento confidencial" no rodapé de todas as páginas.

Uso:
  python3 scripts/reuniao-pdf.py conteudo.json saida.pdf

Formato do JSON (campos opcionais podem faltar):
{
  "titulo": "Apresentação do Khronus e parceria de afiliados",
  "data": "18 de setembro de 2026",
  "horario": "13h23",
  "destinatario": "Lucas Lermen",
  "participantes": ["Lucas Lermen", "Felipe Ferreira"],
  "resumo": ["parágrafo 1", "parágrafo 2"],
  "pauta": [
    {"titulo": "Instalação e licença",
     "descricao": "frase curta opcional",
     "pontos": ["ponto principal 1", "ponto principal 2"]}
  ],
  "decisoes": [{"titulo": "Comissão de 20%", "descricao": "..."}],
  "proximos_passos": [{"responsavel": "Lucas", "tarefa": "Instalar o app", "prazo": "opcional"}],
  "observacoes": "texto opcional no fim",
  "aviso": "texto opcional que substitui o aviso padrão de confidencialidade"
}

A "pauta" aparece duas vezes, de propósito: primeiro como lista compacta de
assuntos e depois, com a mesma numeração, como "Detalhes da reunião" (usa
"descricao" e "pontos"). Sem descricao nem pontos em nenhum item, os detalhes
não aparecem.
"""

import base64
import html
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ASSETS = RAIZ / ".claude" / "skills" / "reuniao" / "assets"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Artigos conferidos em 19/09/2026 no texto consolidado publicado pela Câmara dos
# Deputados: Lei 9.610/1998 (art. 29, I; art. 102), Código Penal (art. 153),
# Lei 9.279/1996 (art. 195, XI) e Código Civil (art. 186; art. 927).
AVISO = (
    "Este documento é sigiloso e foi elaborado exclusivamente para o destinatário nele indicado. "
    "Fica proibida a reprodução, total ou parcial, o encaminhamento, a publicação e qualquer forma "
    "de divulgação a terceiros sem autorização prévia e expressa do autor. A quebra da "
    "confidencialidade sujeita o responsável às sanções civis e penais cabíveis, além da reparação "
    "por perdas e danos, nos termos, entre outros, da Lei nº 9.610/1998 (art. 29, I; art. 102), do "
    "Código Penal (art. 153), da Lei nº 9.279/1996 (art. 195, XI) e do Código Civil (art. 186; art. 927)."
)


def esc(t) -> str:
    return html.escape(str(t or "")).replace("\n", "<br>")


def img_b64(nome: str) -> str:
    dados = (ASSETS / nome).read_bytes()
    return "data:image/png;base64," + base64.b64encode(dados).decode()


def secao(titulo: str, corpo: str) -> str:
    if not corpo.strip():
        return ""
    return f'<section><h2><span class="barra"></span>{esc(titulo)}</h2>{corpo}</section>'


def montar_html(d: dict) -> str:
    participantes = d.get("participantes") or []
    meta = []
    if d.get("data"):
        meta.append(("Data", d["data"] + (f", {d['horario']}" if d.get("horario") else "")))
    if d.get("destinatario"):
        meta.append(("Destinatário", d["destinatario"]))
    if participantes:
        meta.append(("Participantes", ", ".join(participantes)))
    meta_html = "".join(
        f'<div class="meta-item"><span>{esc(k)}</span><strong>{esc(v)}</strong></div>' for k, v in meta
    )

    resumo = "".join(f"<p>{esc(p)}</p>" for p in d.get("resumo") or [])

    itens = d.get("pauta") or []

    # Pauta compacta: só os assuntos, numerados, em duas colunas.
    pauta = "".join(
        f'<li><span class="num">{i:02d}</span><span>{esc(p.get("titulo"))}</span></li>'
        for i, p in enumerate(itens, 1)
    )
    pauta = f'<ol class="pauta">{pauta}</ol>' if pauta else ""

    # Detalhes: mesma numeração, com o principal de cada assunto.
    blocos = []
    for i, p in enumerate(itens, 1):
        pontos = "".join(f"<li>{esc(x)}</li>" for x in p.get("pontos") or [])
        desc = f'<p>{esc(p["descricao"])}</p>' if p.get("descricao") else ""
        if not (pontos or desc):
            continue
        blocos.append(
            f'<div class="detalhe"><div class="detalhe-cab"><span class="num">{i:02d}</span>'
            f'<h3>{esc(p.get("titulo"))}</h3></div>{desc}'
            + (f"<ul>{pontos}</ul>" if pontos else "")
            + "</div>"
        )
    detalhes = "".join(blocos)

    decisoes = "".join(
        f'<div class="cartao"><h3>{esc(x.get("titulo"))}</h3><p>{esc(x.get("descricao"))}</p></div>'
        for x in d.get("decisoes") or []
    )

    # próximos passos agrupados por responsável, na ordem em que aparecem
    grupos: dict = {}
    for p in d.get("proximos_passos") or []:
        grupos.setdefault(p.get("responsavel") or "A definir", []).append(p)
    passos = ""
    for resp, its in grupos.items():
        linhas = "".join(
            f'<li>{esc(i.get("tarefa"))}'
            + (f'<em>{esc(i.get("prazo"))}</em>' if i.get("prazo") else "")
            + "</li>"
            for i in its
        )
        passos += f'<div class="grupo"><h3>{esc(resp)}</h3><ul>{linhas}</ul></div>'
    passos = f'<div class="grupos">{passos}</div>' if passos else ""

    obs = f'<p>{esc(d["observacoes"])}</p>' if d.get("observacoes") else ""
    aviso = d.get("aviso") or AVISO

    return f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>{esc(d.get("titulo"))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;900&display=swap" rel="stylesheet">
<style>
:root {{
  --gold:#eaaa41; --gold-deep:#c88a2e; --orange:#e8600a; --cream:#f5f0e8; --charcoal:#3f3f3f;
  --black:#1a1a1a; --ink:#0d0d0d; --navy:#1a1f2e; --muted:#6b6b6b;
}}
@page {{ size: A4; margin: 0; }}
* {{ box-sizing:border-box; }}
html,body {{ margin:0; padding:0; }}
body {{ font-family:"Montserrat",sans-serif; color:var(--charcoal); font-size:11pt; line-height:1.55;
       -webkit-print-color-adjust:exact; print-color-adjust:exact; }}
.aviso {{ background:var(--ink); color:#fff; padding:6mm 18mm 5.5mm; border-bottom:1.4mm solid var(--orange); }}
.aviso-cab {{ display:flex; align-items:center; gap:3mm; margin-bottom:2.4mm; }}
.aviso-cab .selo {{ background:var(--orange); color:#fff; font-weight:900; font-size:8.5pt; letter-spacing:.14em;
                    text-transform:uppercase; padding:1.2mm 3mm; border-radius:1mm; }}
.aviso-cab .sub {{ font-weight:700; font-size:8pt; letter-spacing:.12em; text-transform:uppercase; color:var(--gold); }}
.aviso p {{ margin:0; font-size:7.6pt; line-height:1.5; color:rgba(255,255,255,.88); font-weight:400; }}
.capa {{ background:var(--navy); color:#fff; padding:13mm 18mm 13mm; position:relative; }}
.capa::after {{ content:""; position:absolute; left:0; right:0; bottom:0; height:2.2mm; background:var(--gold); }}
.capa img {{ height:22mm; display:block; margin-bottom:8mm; }}
.overline {{ font-weight:700; font-size:8.5pt; letter-spacing:.18em; text-transform:uppercase; color:var(--gold); margin:0 0 3mm; }}
.capa h1 {{ font-weight:900; font-size:24pt; line-height:1.08; letter-spacing:-.02em; margin:0 0 8mm; color:#fff; }}
.meta {{ display:flex; gap:10mm; flex-wrap:wrap; border-top:1px solid rgba(255,255,255,.18); padding-top:5mm; }}
.meta-item span {{ display:block; font-size:7.5pt; letter-spacing:.14em; text-transform:uppercase; color:var(--gold); font-weight:700; }}
.meta-item strong {{ font-weight:500; font-size:10pt; color:#fff; }}
table.fluxo {{ width:100%; border-collapse:collapse; }}
table.fluxo td {{ padding:0; }}
.esp-topo {{ height:11mm; }}
.esp-base {{ height:22mm; }}
main {{ padding:0 18mm; }}
section {{ margin-bottom:9mm; }}
h2 {{ font-weight:700; font-size:14pt; color:var(--black); margin:0 0 4mm; letter-spacing:-.01em; display:flex; align-items:center; gap:3mm; break-after:avoid; }}
.barra {{ width:1.6mm; height:6mm; background:var(--gold); border-radius:1mm; display:inline-block; }}
h3 {{ font-weight:700; font-size:10.5pt; color:var(--black); margin:0 0 1mm; }}
p {{ margin:0 0 3mm; }}
.num {{ font-weight:900; font-size:12pt; color:var(--gold-deep); min-width:9mm; line-height:1.3; }}
.pauta {{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:1fr 1fr; column-gap:8mm; }}
.pauta li {{ display:flex; gap:3mm; align-items:baseline; padding:2mm 0; border-bottom:1px solid rgba(26,26,26,.10); font-size:10pt; font-weight:500; color:var(--black); break-inside:avoid; }}
.detalhe {{ padding:4mm 0; border-bottom:1px solid rgba(26,26,26,.10); break-inside:avoid; }}
.detalhe:last-child {{ border-bottom:0; }}
.detalhe-cab {{ display:flex; gap:3mm; align-items:baseline; margin-bottom:1.5mm; }}
.detalhe-cab h3 {{ margin:0; font-size:11pt; }}
.detalhe p {{ margin:0 0 1.5mm 12mm; font-size:10pt; }}
.detalhe ul {{ margin:0 0 0 12mm; padding:0; list-style:none; }}
.detalhe li {{ position:relative; padding-left:4.5mm; margin-bottom:1.4mm; font-size:10pt; line-height:1.5; }}
.detalhe li::before {{ content:""; position:absolute; left:0; top:2.1mm; width:1.7mm; height:1.7mm; border-radius:50%; background:var(--gold); }}
.cartao {{ background:var(--cream); border-left:1.6mm solid var(--gold); border-radius:0 2mm 2mm 0; padding:4mm 5mm; margin-bottom:3.5mm; break-inside:avoid; }}
.cartao p {{ margin:0; }}
.grupos {{ display:grid; grid-template-columns:1fr 1fr; gap:4mm; }}
.grupo {{ border:1px solid rgba(26,26,26,.14); border-top:1.2mm solid var(--gold); border-radius:2mm; padding:4mm 5mm; break-inside:avoid; }}
.grupo ul {{ margin:0; padding:0; list-style:none; }}
.grupo li {{ position:relative; padding-left:5mm; margin-bottom:2.2mm; font-size:10pt; }}
.grupo li::before {{ content:""; position:absolute; left:0; top:2.1mm; width:2mm; height:2mm; border-radius:50%; background:var(--gold); }}
.grupo em {{ display:block; font-style:normal; font-size:8.5pt; color:var(--muted); }}
footer {{ position:fixed; left:0; right:0; bottom:0; padding:4mm 18mm; font-size:7.5pt; color:var(--muted);
         display:flex; justify-content:space-between; border-top:1px solid rgba(26,26,26,.10); background:#fff; }}
footer b {{ color:var(--orange); font-weight:700; letter-spacing:.06em; text-transform:uppercase; }}
</style></head><body>
<div class="aviso">
  <div class="aviso-cab"><span class="selo">Documento confidencial</span><span class="sub">Reprodução e divulgação proibidas</span></div>
  <p>{esc(aviso)}</p>
</div>
<header class="capa">
  <img src="{img_b64("logo-fmn-fundo-escuro.png")}" alt="Fotografia é o Meu Negócio">
  <p class="overline">Resumo e pauta da reunião</p>
  <h1>{esc(d.get("titulo"))}</h1>
  <div class="meta">{meta_html}</div>
</header>
<table class="fluxo"><thead><tr><td><div class="esp-topo"></div></td></tr></thead><tbody><tr><td><main>
{secao("Resumo", resumo)}
{secao("Pauta", pauta)}
{secao("Detalhes da reunião", detalhes)}
{secao("O que ficou decidido", decisoes)}
{secao("Próximos passos", passos)}
{secao("Observações", obs)}
</main></td></tr></tbody><tfoot><tr><td><div class="esp-base"></div></td></tr></tfoot></table>
<footer><span><b>Documento confidencial</b> · Reprodução proibida</span><span>Fotografia é o Meu Negócio · fotografiaeomeunegocio.com.br</span></footer>
</body></html>"""


def main():
    if len(sys.argv) != 3:
        sys.exit("Uso: python3 scripts/reuniao-pdf.py conteudo.json saida.pdf")
    dados = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    saida = Path(sys.argv[2]).expanduser().resolve()
    saida.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        arq_html = Path(tmp) / "reuniao.html"
        arq_html.write_text(montar_html(dados), encoding="utf-8")
        saida.unlink(missing_ok=True)
        cmd = [
            CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
            f"--user-data-dir={tmp}/perfil", "--virtual-time-budget=10000",
            f"--print-to-pdf={saida}", f"file://{arq_html}",
        ]
        # O Chrome grava o PDF e às vezes não encerra sozinho: espero o arquivo
        # parar de crescer e fecho o processo.
        proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
        tamanho, estavel, limite = -1, 0, time.time() + 90
        while time.time() < limite and proc.poll() is None:
            atual = saida.stat().st_size if saida.exists() else 0
            estavel = estavel + 1 if (atual > 0 and atual == tamanho) else 0
            tamanho = atual
            if estavel >= 3:
                break
            time.sleep(1)
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        erro = proc.stderr.read()[-800:] if proc.stderr else ""
    if not saida.exists() or saida.stat().st_size == 0:
        sys.exit(f"Chrome não gerou o PDF.\n{erro}")
    print(f"PDF gerado: {saida} ({saida.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
