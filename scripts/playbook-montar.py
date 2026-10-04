"""
playbook-montar.py

Monta o HTML do playbook comercial de WhatsApp 1:1 a partir do perfil.md e do
idconsumidor.md do produto ativo. Preenche automaticamente as secoes estaticas
(1, 2, 3, 8, 9, 12) e deixa marcadores {{N.chave}} nas secoes criativas
(4, 5, 6, 7, 10, 11) para o modelo preencher depois via JSON.

Uso:
    py -3 scripts/playbook-montar.py
    py -3 scripts/playbook-montar.py --slug curso-tarot
    py -3 scripts/playbook-montar.py --slug curso-tarot --saida caminho/custom.html

Saida: escreve o HTML no caminho padrao
    meus-produtos/{slug}/entregas/comercial/playbook-{slug}.html
e imprime o caminho absoluto no stdout.
"""
from __future__ import annotations

import argparse
import io
import re
import sys
from pathlib import Path

# Garantir UTF-8 no Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")

RAIZ = Path(__file__).resolve().parent.parent
PASTA_PRODUTOS = RAIZ / "meus-produtos"
sys.path.insert(0, str(RAIZ / "scripts"))

# Importa o template (mesma pasta)
from playbook_template import (  # noqa: E402
    render_shell,
    render_indice,
    render_capa,
    render_identidade_produto,
    render_def,
    render_fechamento,
    render_dicionario,
    placeholder_criativa,
    render_secao_7_outbound,
    render_secao_8_inbound,
    render_secao_9_spin,
    render_secao_10_preco,
    render_secao_13_recuperacao,
    render_secao_14_follow_up,
)

# ============================================================================
# Utilitarios de parsing
# ============================================================================


def _secao(texto: str, titulos_regex: str, nivel: int = 2) -> str:
    """Extrai o bloco entre um titulo de nivel 2 (##) ou 3 (###) e o proximo do MESMO nivel ou superior.

    Exemplo: _secao(texto, r"Urgências Ocultas", nivel=2) pega de '## Urgências Ocultas' ate o proximo '##',
    incluindo subsecoes ### dentro.
    """
    if nivel == 2:
        # ## titulo ate proximo ## (nao ###)
        padrao = re.compile(
            rf"^##\s+{titulos_regex}[^\n]*$(.*?)(?=^##[^#]|\Z)",
            re.DOTALL | re.MULTILINE | re.IGNORECASE,
        )
    else:
        # ### titulo ate proximo ### ou ## (mesmo nivel ou acima)
        padrao = re.compile(
            rf"^###\s+{titulos_regex}[^\n]*$(.*?)(?=^##|\Z)",
            re.DOTALL | re.MULTILINE | re.IGNORECASE,
        )
    m = padrao.search(texto)
    return m.group(1).strip() if m else ""


def _linhas_bullet(bloco: str, indent_min: int = 0) -> list[str]:
    """Extrai itens de bullet (- xxx ou * xxx). Preserva ordem.

    Se indent_min > 0, aceita so bullets com pelo menos essa quantidade de espacos no inicio.
    """
    linhas = []
    for linha in bloco.splitlines():
        if indent_min > 0:
            m = re.match(rf"^[ \t]{{{indent_min},}}[-*]\s+(.+?)\s*$", linha)
        else:
            m = re.match(r"^[ \t]*[-*]\s+(.+?)\s*$", linha)
        if m:
            item = m.group(1).strip()
            linhas.append(item)
    return linhas


def _sub_bullets(bloco: str, label: str, indent_min: int = 2) -> list[str]:
    """Extrai sub-bullets que vem depois de uma linha '- **Label:**' (parando no proximo bullet top-level)."""
    # Captura o trecho logo apos o label ate a proxima linha que eh bullet top-level (0 indent) com **
    padrao = re.compile(
        rf"\*\*{re.escape(label)}[^*]*?\*\*\s*\n((?:[ \t]+[-*]\s+.+\n?)+)",
        re.IGNORECASE,
    )
    m = padrao.search(bloco)
    if not m:
        return []
    return _linhas_bullet(m.group(1), indent_min=indent_min)


def _valor_chave(bloco: str, chave: str) -> str:
    """Extrai valor de uma linha '**Chave:** valor' ou '- **Chave:** valor'."""
    padrao = re.compile(
        rf"^\s*[-*]?\s*\*\*{re.escape(chave)}\s*:?\s*\*\*\s*(.+?)\s*$",
        re.MULTILINE | re.IGNORECASE,
    )
    m = padrao.search(bloco)
    return m.group(1).strip() if m else ""


def _primeira_linha_nao_vazia(bloco: str) -> str:
    for linha in bloco.splitlines():
        if linha.strip():
            return linha.strip()
    return ""


# ============================================================================
# Parser do perfil.md
# ============================================================================


def parse_perfil(texto: str) -> dict:
    dados: dict = {}

    # Nome do produto (primeiro h1)
    m = re.search(r"^#\s+(.+?)\s*$", texto, re.MULTILINE)
    nome_h1 = m.group(1).strip() if m else ""
    # Remove prefixo tipo "Perfil do Negócio." se existir
    nome_produto = re.sub(r"^Perfil\s+do\s+(Neg[oó]cio|Produto)\.?\s*", "", nome_h1, flags=re.IGNORECASE).strip()
    dados["nome_produto"] = nome_produto or "Produto"

    # Quadro
    bloco_quadro = _secao(texto, r"Quadro.*?")
    dados["quadro"] = _primeira_linha_nao_vazia(bloco_quadro)

    # Furadeira
    bloco_furadeira = _secao(texto, r"Furadeira.*?")
    dados["furadeira_nome"] = _valor_chave(bloco_furadeira, "Nome do Método") or ""
    etapas = []
    padrao_etapa = re.compile(
        r"^\s*(\d+)\.\s+\*\*Ponte?\s*\d*\.?\s*(.+?)(?:\.?\s*\((.+?)\))?\.?\*\*\s*(.*?)(?=^\s*\d+\.\s+\*\*|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    for m in padrao_etapa.finditer(bloco_furadeira):
        num = m.group(1).strip()
        nome = m.group(2).strip()
        prazo = (m.group(3) or "").strip()
        resto = m.group(4).strip()
        resumo = resto.split("\n")[0].strip() if resto else ""
        etapas.append({"numero": num, "nome": nome, "prazo": prazo, "resumo": resumo})

    # Fallback mais generico: linhas numeradas em negrito
    if not etapas:
        padrao2 = re.compile(
            r"^\s*(\d+)\.\s+\*\*(.+?)\*\*\s*(.*?)(?=^\s*\d+\.\s+\*\*|\Z)",
            re.DOTALL | re.MULTILINE,
        )
        for m in padrao2.finditer(bloco_furadeira):
            titulo_bold = m.group(2).strip()
            prazo = ""
            par = re.match(r"(.+?)\s*\((.+?)\)\s*$", titulo_bold)
            if par:
                titulo_bold = par.group(1).strip()
                prazo = par.group(2).strip()
            etapas.append({
                "numero": m.group(1).strip(),
                "nome": titulo_bold,
                "prazo": prazo,
                "resumo": m.group(3).strip().split("\n")[0] if m.group(3).strip() else "",
            })
    dados["furadeira_etapas"] = etapas

    # Identidade do Produto (entregaveis, posicionamento, diferenciais, preco)
    bloco_id_produto = _secao(texto, r"Identidade\s+do\s+Produto")
    dados["preco_texto"] = _valor_chave(bloco_id_produto, "Preço") or _valor_chave(bloco_id_produto, "Valor") or ""
    dados["posicionamento"] = _valor_chave(bloco_id_produto, "Posicionamento") or ""

    # Entregaveis: sub-bullets apos "- **Entregáveis:**"
    dados["entregaveis"] = _sub_bullets(bloco_id_produto, "Entregáveis")

    # Diferenciais: sub-bullets de "- **Diferencial versus concorrentes:**" (com ou sem texto extra)
    diferenciais = _sub_bullets(bloco_id_produto, "Diferencial versus concorrentes")
    if not diferenciais:
        diferenciais = _sub_bullets(bloco_id_produto, "Diferenciais")
    # Campo único "- **Diferencial:** texto", padrão dos perfis gerados pelo /produto-concepcao
    if not diferenciais:
        diferencial_unico = _valor_chave(bloco_id_produto, "Diferencial")
        if diferencial_unico:
            diferenciais = [diferencial_unico]
    dados["diferenciais"] = diferenciais

    # Perfil com H1 genérico ("# Perfil do Negócio"): o nome vem de "- **Nome:**" na Identidade do Produto
    if dados["nome_produto"] == "Produto":
        nome_campo = _valor_chave(bloco_id_produto, "Nome")
        if nome_campo:
            dados["nome_produto"] = nome_campo

    # Argumentos Incontestaveis: todas as bullets da secao
    bloco_args = _secao(texto, r"Argumentos\s+Incontest[aá]veis")
    argumentos = []
    for linha in bloco_args.splitlines():
        m = re.match(r"^\s*[-*]\s+(.+?)\s*$", linha)
        if m:
            argumentos.append(m.group(1).strip())
    dados["argumentos_incontestaveis"] = argumentos

    # Identidade do Consumidor
    bloco_id_cons = _secao(texto, r"Identidade\s+do\s+Consumidor")
    demograficos = {}
    campos_dem = [
        ("Público-alvo", "publico_alvo"),
        ("Publico-alvo", "publico_alvo"),
        ("Renda", "renda"),
        ("Situação civil", "situacao_civil"),
        ("Filhos", "filhos"),
        ("Escolaridade", "escolaridade"),
        ("Localização", "localizacao"),
        ("Nicho", "nicho"),
        ("Nível de consciência", "consciencia"),
    ]
    for label, _ in campos_dem:
        val = _valor_chave(bloco_id_cons, label)
        if val:
            demograficos[label] = val
    dados["demograficos"] = demograficos

    # Paliativos do perfil (pode ser override pelo idconsumidor depois)
    paliativos = _sub_bullets(bloco_id_cons, "Paliativos")
    dados["paliativos"] = paliativos

    # Frases que o publico diria (do perfil)
    frases = _sub_bullets(bloco_id_cons, "Frases que ela")
    if not frases:
        frases = _sub_bullets(bloco_id_cons, "Frases que o consumidor")
    dados["frases_publico"] = [x.strip('"').strip("'").strip("“").strip("”") for x in frases]

    # Identidade do Comunicador
    bloco_comm = _secao(texto, r"Identidade\s+do\s+Comunicador")
    dados["tom_voz"] = _valor_chave(bloco_comm, "Tom de voz") or ""
    dados["posicionamento_comunicador"] = _valor_chave(bloco_comm, "Posicionamento pessoal") or ""

    # Mantras (sub-bullets de '- **Mantras...:**')
    mantras_raw = _sub_bullets(bloco_comm, "Mantras")
    dados["mantras"] = [x.strip('"').strip("'").strip("“").strip("”") for x in mantras_raw]

    # Palavras que conectam: derivar do Vocabulario base + mantras
    conectar_texto = _valor_chave(bloco_comm, "Vocabulário base") or ""
    palavras_conectar: list[str] = []
    if conectar_texto:
        # Tenta pegar trecho entre parenteses se houver
        m = re.search(r"\((.+?)\)", conectar_texto)
        fonte = m.group(1) if m else conectar_texto
        # Divide por virgulas e pega as primeiras 10-14
        cands = [p.strip() for p in re.split(r"[,;]", fonte) if p.strip()]
        palavras_conectar = cands[:14]
    dados["palavras_conectar"] = palavras_conectar

    # Palavras que afastam: da linha "Evitar na comunicação"
    afastar_texto = _valor_chave(bloco_comm, "Evitar na comunicação") or _valor_chave(bloco_comm, "Evitar") or ""
    palavras_afastar: list[str] = []
    if afastar_texto:
        # Extrai termos entre aspas; se nao tiver, divide por virgulas
        aspas = re.findall(r'["\u201c\u201d](.+?)["\u201c\u201d]', afastar_texto)
        if aspas:
            palavras_afastar = aspas[:12]
        else:
            palavras_afastar = [p.strip() for p in re.split(r"[,;]", afastar_texto) if p.strip()][:12]
    dados["palavras_afastar"] = palavras_afastar

    # Urgencias Ocultas (para as 10 dores e 10 desejos)
    bloco_urg = _secao(texto, r"Urg[eê]ncias\s+Ocultas")
    categorias = {
        "dores": r"Dores",
        "duvidas": r"D[uú]vidas",
        "desejos": r"Desejos",
        "assuntos": r"Assuntos\s+Relacionados",
        "quentes": r"Urg[eê]ncias\s+Quentes",
        "frias": r"Urg[eê]ncias\s+Frias",
        "inusitadas": r"Urg[eê]ncias\s+Inusitadas",
    }
    urgencias: dict[str, list[str]] = {}
    for chave, regex_titulo in categorias.items():
        bloco_cat = _secao(bloco_urg, regex_titulo + r"[^\n]*", nivel=3)
        urgencias[chave] = _linhas_bullet(bloco_cat)
    dados["urgencias"] = urgencias
    dados["dores"] = urgencias.get("dores", [])
    dados["desejos"] = urgencias.get("desejos", [])

    # Decorados (50 beneficios)
    bloco_dec = _secao(texto, r"Decorados.*?")
    decorados = []
    for linha in bloco_dec.splitlines():
        m = re.match(r"^\s*[-*]\s+(.+?)\s*$", linha)
        if m:
            decorados.append(m.group(1).strip())
    dados["decorados"] = decorados

    return dados


# ============================================================================
# Parser do idconsumidor.md
# ============================================================================


def parse_idconsumidor(texto: str) -> dict:
    dados: dict = {}

    # Baldes de Para Quem E
    bloco_baldes = _secao(texto, r"Baldes\s+de\s+Para\s+Quem\s+[ÉE]")
    baldes = []
    padrao_balde = re.compile(
        r"^###\s*.?\s*Pra\s+quem\s+[eé]\.?\s*(.+?)\s*$(.*?)(?=^###\s+|\Z)",
        re.DOTALL | re.MULTILINE | re.IGNORECASE,
    )
    for m in padrao_balde.finditer(bloco_baldes):
        titulo = m.group(1).strip()
        corpo = m.group(2)
        itens = []
        for linha in corpo.splitlines():
            mm = re.match(r"^\s*\d+\.\s+(.+?)\s*$", linha)
            if mm:
                itens.append(mm.group(1).strip())
        if titulo and itens:
            baldes.append({"titulo": titulo, "itens": itens})
    dados["baldes"] = baldes

    # Objecoes de Compra (Framework dos 7 Argumentos) — delegamos para extrair-objecoes.py
    # Aqui so sinalizamos se existe ou nao, pra montar HTML final.
    tem_objecoes = bool(re.search(r"^##\s+Obje[cç][oõ]es\s+de\s+Compra", texto, re.MULTILINE | re.IGNORECASE))
    dados["tem_objecoes_framework"] = tem_objecoes

    # Paliativos (se explicitos no idconsumidor)
    bloco_pal = _secao(texto, r"Paliativos.*?")
    paliativos = _linhas_bullet(bloco_pal) if bloco_pal else []
    dados["paliativos_idc"] = paliativos

    # 10 frases que o consumidor diria
    bloco_frases = _secao(texto, r"Frases\s+que\s+(ela|o\s+consumidor).*?")
    frases = _linhas_bullet(bloco_frases) if bloco_frases else []
    dados["frases_consumidor"] = [x.strip('"').strip("'") for x in frases]

    # Tom, Como se comunicar (complementa)
    bloco_tom = _secao(texto, r"Como\s+se\s+comunicar.*?")
    if bloco_tom:
        dados["tom_complemento"] = bloco_tom.strip()

    return dados


# ============================================================================
# Extracao de objecoes (delega para playbook-extrair-objecoes.py)
# ============================================================================


def extrair_objecoes_html(slug: str) -> tuple[str, bool]:
    """Retorna (html, ok). Se o idconsumidor nao tiver as 7 quebras, ok=False."""
    try:
        from playbook_extrair_objecoes_lib import render_objecoes_html
        return render_objecoes_html(slug)
    except Exception:
        pass

    # Fallback: executa o script como subprocesso
    import subprocess
    try:
        proc = subprocess.run(
            [sys.executable, str(RAIZ / "scripts" / "playbook-extrair-objecoes.py"), "--slug", slug],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout, True
        return "", False
    except Exception as exc:
        sys.stderr.write(f"Falha ao extrair objeções: {exc}\n")
        return "", False


# ============================================================================
# Montagem do HTML
# ============================================================================


def montar_html(slug: str, perfil: dict, idc: dict) -> str:
    # Merge do perfil e idconsumidor em um dict unico
    dados = dict(perfil)
    # idconsumidor overrides e complementa
    if idc.get("paliativos_idc"):
        dados["paliativos"] = idc["paliativos_idc"]
    if idc.get("frases_consumidor"):
        dados["frases_consumidor"] = idc["frases_consumidor"]
    else:
        dados["frases_consumidor"] = dados.get("frases_publico", [])
    dados["baldes"] = idc.get("baldes", [])

    # Para quem e: primeiro balde (titulo) se existir
    if dados["baldes"]:
        dados["para_quem"] = dados["baldes"][0].get("titulo", "")

    # Seção 9. Objecoes (Framework dos 7 Argumentos)
    if idc.get("tem_objecoes_framework"):
        objecoes_html, ok_obj = extrair_objecoes_html(slug)
        if not ok_obj:
            objecoes_html = placeholder_criativa(
                9,
                "Quebra de objeções pelo Framework dos 7 Argumentos",
                "O script playbook-extrair-objecoes.py falhou. Verifique se o idconsumidor.md tem a seção '## Objeções de Compra (Framework dos 7 Argumentos)' no formato esperado.",
            )
        else:
            # O script devolve <section class="secao-objecoes"> com h2 "9. ...".
            # Ajustamos para id=secao-9 e reescrevemos a numeracao no h2.
            objecoes_html = objecoes_html.replace(
                '<section class="secao-objecoes">',
                '<section class="secao-objecoes" id="secao-9">',
                1,
            )
            objecoes_html = re.sub(
                r"<h2>\s*\d+\.\s*",
                "<h2>9. ",
                objecoes_html,
                count=1,
            )
    else:
        objecoes_html = f"""<section id="secao-9">
  <h2>9. Quebra de objeções pelo Framework dos 7 Argumentos</h2>
  <div class="placeholder-criativa">
    <strong>Objeções não cadastradas no idconsumidor.md</strong>
    Rode /produto-concepcao para gerar as 5 objeções com as 7 quebras (2 parágrafos cada) no Framework dos 7 Argumentos. Depois rode este script novamente.
  </div>
</section>
"""

    # Estrutura HTML fixa. Os agentes devolvem JSON plano {"N.chave": "texto"}
    # e playbook-aplicar-criativas.py substitui os marcadores {{chave}} pelo texto.
    secao_4 = render_secao_7_outbound(dados)
    secao_5 = render_secao_8_inbound(dados)
    secao_6 = render_secao_9_spin(dados)
    secao_7 = render_secao_10_preco(dados)
    secao_10 = render_secao_13_recuperacao(dados)
    secao_11 = render_secao_14_follow_up(dados)

    # Monta conteudo completo (12 secoes)
    partes = [
        render_indice(),
        render_capa(dados),                     # 1
        render_identidade_produto(dados),       # 2
        render_def(dados),                      # 3
        secao_4,                                # 4  (CREATIVE) Outbound
        secao_5,                                # 5  (CREATIVE) Inbound
        secao_6,                                # 6  (CREATIVE) SPIN
        secao_7,                                # 7  (CREATIVE) Preço
        render_fechamento(dados),               # 8
        objecoes_html,                          # 9
        secao_10,                               # 10 (CREATIVE) Recuperação
        secao_11,                               # 11 (CREATIVE) Follow-up
        render_dicionario(),                    # 12
    ]

    titulo = f"Playbook comercial WhatsApp · {dados.get('nome_produto', 'Produto')}"
    ctx = {
        "nome_produto": dados.get("nome_produto", ""),
        "quadro": dados.get("quadro", ""),
        "preco_texto": dados.get("preco_texto", ""),
    }
    return render_shell(titulo, "\n".join(partes), ctx)


# ============================================================================
# CLI
# ============================================================================


def descobrir_slug_ativo() -> str:
    arquivo = PASTA_PRODUTOS / ".ativo"
    if not arquivo.exists():
        raise SystemExit("meus-produtos/.ativo não existe. Rode /produto-novo ou /produto-trocar primeiro.")
    slug = arquivo.read_text(encoding="utf-8").strip()
    if not slug:
        raise SystemExit("meus-produtos/.ativo está vazio. Rode /produto-trocar.")
    return slug


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", help="Slug do produto (default: .ativo)")
    parser.add_argument("--saida", help="Caminho de saída custom")
    args = parser.parse_args()

    slug = args.slug or descobrir_slug_ativo()
    pasta_produto = PASTA_PRODUTOS / slug
    if not pasta_produto.exists():
        raise SystemExit(f"Pasta não existe: {pasta_produto}")

    perfil_path = pasta_produto / "perfil.md"
    if not perfil_path.exists():
        raise SystemExit(f"perfil.md não encontrado em {pasta_produto}. Rode /produto-concepcao antes.")
    idc_path = pasta_produto / "idconsumidor.md"
    if not idc_path.exists():
        raise SystemExit(f"idconsumidor.md não encontrado em {pasta_produto}. Rode /produto-concepcao antes.")

    perfil_texto = perfil_path.read_text(encoding="utf-8")
    idc_texto = idc_path.read_text(encoding="utf-8")

    perfil = parse_perfil(perfil_texto)
    idc = parse_idconsumidor(idc_texto)

    html_final = montar_html(slug, perfil, idc)

    if args.saida:
        destino = Path(args.saida)
    else:
        destino = pasta_produto / "entregas" / "comercial" / f"playbook-{slug}.html"
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(html_final, encoding="utf-8")

    print(str(destino))
    return 0


if __name__ == "__main__":
    sys.exit(main())
