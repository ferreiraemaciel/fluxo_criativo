"""
transcrever-youtube.py

Busca a transcricao (legenda) de um video do YouTube e devolve o texto puro.
Usado pela skill gestor-pedagogico para transformar um link do YouTube em texto
antes de gerar os entregaveis pedagogicos.

Prioriza legenda em portugues (pt-BR, pt). Se nao existir, usa a primeira
legenda disponivel (inclusive as geradas automaticamente). Se o video nao tiver
nenhuma legenda, sai com codigo 2 e uma mensagem clara, para a skill pedir ao
mentorado que cole a transcricao manualmente.

Uso:
    python3 scripts/transcrever-youtube.py "<url ou id do video>"
    python3 scripts/transcrever-youtube.py "<url>" --out caminho/saida.txt

Sem --out, imprime a transcricao no stdout (a skill le a saida direto).
Com --out, salva no arquivo e imprime apenas um resumo (idioma + n de caracteres).

Dependencia: youtube-transcript-api. Se nao estiver instalada, o script tenta
instalar sozinha via pip, em modo silencioso (mantem o "tudo automatico" sem
poluir o chat com ruido de rede). Se a instalacao falhar, sai com codigo 3.

Codigos de saida:
    0  sucesso
    1  argumento invalido (faltou url, id nao identificado)
    2  video sem legenda disponivel (pedir transcricao manual ao mentorado)
    3  dependencia ausente e nao foi possivel instalar
    4  erro de rede ou video indisponivel
"""

import argparse
import re
import subprocess
import sys

# Ordem de preferencia de idioma
IDIOMAS_PREFERIDOS = ["pt-BR", "pt", "pt-PT", "en", "es"]


def extrair_id(entrada: str) -> str | None:
    """Extrai o id de 11 caracteres a partir de uma url ou do proprio id."""
    entrada = entrada.strip()
    if re.fullmatch(r"[0-9A-Za-z_-]{11}", entrada):
        return entrada
    padroes = [
        r"(?:v=|/v/|youtu\.be/|/embed/|/shorts/|/live/)([0-9A-Za-z_-]{11})",
        r"^([0-9A-Za-z_-]{11})$",
    ]
    for p in padroes:
        m = re.search(p, entrada)
        if m:
            return m.group(1)
    return None


def garantir_dependencia():
    """Importa youtube_transcript_api, instalando via pip (silencioso) se faltar."""
    try:
        import youtube_transcript_api  # noqa: F401
        return
    except ImportError:
        pass
    print(
        "Instalando dependencia de transcricao (primeira execucao, pode levar alguns segundos)...",
        file=sys.stderr,
    )
    proc = subprocess.run(
        [
            sys.executable, "-m", "pip", "install",
            "--quiet", "--disable-pip-version-check", "--no-warn-script-location",
            "youtube-transcript-api",
        ],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        print(
            "Nao foi possivel instalar youtube-transcript-api automaticamente. "
            "Rode manualmente: python3 -m pip install youtube-transcript-api",
            file=sys.stderr,
        )
        sys.exit(3)
    try:
        import youtube_transcript_api  # noqa: F401
    except ImportError:
        print(
            "Dependencia instalada mas nao importavel. Verifique o ambiente Python.",
            file=sys.stderr,
        )
        sys.exit(3)


def _texto_dos_trechos(dados) -> str:
    """Junta os trechos da legenda, aceitando objetos (>=1.0) ou dicts (<1.0)."""
    partes = []
    for s in dados:
        t = s.get("text") if isinstance(s, dict) else getattr(s, "text", None)
        if t and t.strip():
            partes.append(t.strip())
    return " ".join(partes)


def _via_instancia(video_id):
    """API de instancia (youtube-transcript-api >= 1.0)."""
    from youtube_transcript_api import YouTubeTranscriptApi

    api = YouTubeTranscriptApi()
    listagem = api.list(video_id)  # AttributeError em versoes antigas
    try:
        transcript = listagem.find_transcript(IDIOMAS_PREFERIDOS)
    except Exception:
        transcript = None
        for t in listagem:
            transcript = t
            break
        if transcript is None:
            raise
    dados = transcript.fetch()
    return _texto_dos_trechos(dados), transcript.language_code


def _via_estatica(video_id):
    """API estatica legada (youtube-transcript-api < 1.0)."""
    from youtube_transcript_api import YouTubeTranscriptApi

    listagem = YouTubeTranscriptApi.list_transcripts(video_id)
    try:
        transcript = listagem.find_transcript(IDIOMAS_PREFERIDOS)
    except Exception:
        transcript = next(iter(listagem))
    dados = transcript.fetch()
    return _texto_dos_trechos(dados), transcript.language_code


def _classificar_e_sair(e):
    """Mapeia a excecao para um codigo de saida, sem depender de importar
    classes de erro privadas (que mudam entre versoes da lib)."""
    nome = type(e).__name__.lower()
    msg = str(e).lower()
    if "disabled" in nome or "notranscriptfound" in nome or "no transcript" in msg:
        print(
            "Este video nao tem legenda disponivel. "
            "Peca ao mentorado a transcricao colada no chat.",
            file=sys.stderr,
        )
        sys.exit(2)
    if "unavailable" in nome or "private" in msg:
        print("Video indisponivel ou privado.", file=sys.stderr)
        sys.exit(4)
    print(f"Erro ao buscar a transcricao: {e}", file=sys.stderr)
    sys.exit(4)


def buscar_transcricao(video_id):
    """Retorna (texto, idioma). Tenta a API nova, cai para a antiga, e
    classifica qualquer erro de transcricao em codigo de saida apropriado."""
    try:
        return _via_instancia(video_id)
    except (AttributeError, TypeError):
        pass  # versao antiga: tenta a API estatica
    except Exception as e:
        _classificar_e_sair(e)

    try:
        return _via_estatica(video_id)
    except Exception as e:
        _classificar_e_sair(e)


def main():
    parser = argparse.ArgumentParser(description="Transcreve um video do YouTube.")
    parser.add_argument("video", help="URL completa ou id do video do YouTube")
    parser.add_argument("--out", help="Arquivo de saida (.txt). Sem isso, imprime no stdout.")
    args = parser.parse_args()

    video_id = extrair_id(args.video)
    if not video_id:
        print(
            "Nao consegui identificar o id do video. "
            "Passe a URL completa do YouTube ou o id de 11 caracteres.",
            file=sys.stderr,
        )
        sys.exit(1)

    garantir_dependencia()
    texto, idioma = buscar_transcricao(video_id)

    if not texto or not texto.strip():
        print(
            "A legenda veio vazia. Peca ao mentorado a transcricao colada no chat.",
            file=sys.stderr,
        )
        sys.exit(2)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(texto)
        print(f"OK | idioma={idioma} | {len(texto)} caracteres | salvo em {args.out}")
    else:
        print(f"[idioma={idioma} | {len(texto)} caracteres]", file=sys.stderr)
        sys.stdout.write(texto)


if __name__ == "__main__":
    main()
