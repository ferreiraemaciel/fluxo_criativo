#!/usr/bin/env python3
"""
Bateria de testes do Claudinho (IA vendedora WhatsApp do MCV).

Roda uma lista de cenários reais (baseados em erros já encontrados na revisão
manual, ver tabela claudinho_erros) contra o prompt ATUAL de verdade
(lido direto de supabase/functions/_shared/whatsapp-ia-prompt.ts, nunca uma
cópia colada aqui) e confere se a resposta respeita as regras esperadas.

Rodar toda vez que o prompt mudar, antes de fazer deploy, pra garantir que
uma correção nova não reabriu um erro antigo (regressão).

Uso:
    python3 scripts/claudinho_stress_test.py

Cada cenário tem custo pequeno de API Anthropic (modelo haiku, poucos
tokens). Rodar a bateria inteira custa poucos centavos de dólar.
"""
import json
import os
import re
import sys
from pathlib import Path

import urllib.request
import urllib.error

RAIZ = Path(__file__).resolve().parent.parent
PROMPT_FILE = RAIZ / "supabase" / "functions" / "_shared" / "whatsapp-ia-prompt.ts"
ENV_FILE = RAIZ / ".env"


def carregar_env():
    env = {}
    if ENV_FILE.exists():
        for linha in ENV_FILE.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if not linha or linha.startswith("#") or "=" not in linha:
                continue
            k, v = linha.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def extrair_prompt():
    """Extrai o conteúdo do template literal `export const SYSTEM_PROMPT_MCV = \`...\`;`
    direto do arquivo .ts real, sem copiar/colar (evita o script testar uma
    versão desatualizada por engano)."""
    texto = PROMPT_FILE.read_text(encoding="utf-8")
    m = re.search(r"export const SYSTEM_PROMPT_MCV\s*=\s*`(.*)`", texto, re.S)
    if not m:
        raise SystemExit(f"Não consegui extrair SYSTEM_PROMPT_MCV de {PROMPT_FILE}")
    return m.group(1).strip()


TOOL_RESPONDER = {
    "name": "responder_lead",
    "description": "Responde a mensagem do lead no WhatsApp, no tom combinado, e sinaliza se a conversa precisa de um humano.",
    "input_schema": {
        "type": "object",
        "properties": {
            "mensagem": {"type": "string"},
            "estagio": {"type": "string", "enum": ["descoberta", "encantamento", "fechamento"]},
            "handoff": {"type": "boolean"},
            "motivo_handoff": {"type": "string"},
        },
        "required": ["mensagem", "estagio", "handoff"],
    },
}


def chamar_anthropic(api_key, model, system_prompt, mensagens):
    body = json.dumps({
        "model": model,
        "max_tokens": 700,
        "system": system_prompt,
        "messages": mensagens,
        "tools": [TOOL_RESPONDER],
        "tool_choice": {"type": "tool", "name": "responder_lead"},
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    uso = data.get("usage", {})
    for bloco in data.get("content", []):
        if bloco.get("type") == "tool_use":
            return bloco["input"], uso
    raise RuntimeError(f"Anthropic não devolveu tool_use: {data}")


# Mesmo preço usado de verdade pelo Tracker (tabela custo_precos no Supabase).
PRECO_INPUT_POR_MTOK = 1.0
PRECO_OUTPUT_POR_MTOK = 5.0


# ── Cenários ────────────────────────────────────────────────────────────────
# Cada cenário: histórico de mensagens (role user/assistant) + checagens.
# check(resposta_dict) -> (ok: bool, motivo: str)

def sem_saudacao_periodo(r):
    txt = r["mensagem"].lower()
    achou = re.search(r"\b(bom dia|boa tarde|boa noite)\b", txt)
    return (not achou, "usou saudação de período do dia" if achou else "ok")


def sem_virgula_antes_e_ou(r):
    txt = r["mensagem"]
    achou = re.search(r",\s+(e|ou)\s+", txt, re.I)
    return (not achou, f"vírgula antes de e/ou: '{achou.group(0)}'" if achou else "ok")


def sem_pergunta_no_lead_do_produto(r):
    # não aplicável a esse conjunto de cenários (produto não aparece no lead é regra de outras skills)
    return (True, "ok")


def nao_pulou_pra_preco(r):
    txt = r["mensagem"].lower()
    tem_preco = bool(re.search(r"r\$\s*\d|12x|parcel", txt))
    tem_link = "pay.hotmart.com" in txt
    ok = not (tem_preco or tem_link)
    return (ok, "mencionou preço/link sem sinal de compra" if not ok else "ok")


def termina_com_pergunta(r):
    # Aceita "?" mesmo com emoji/pontuação decorativa depois (ex: "? 📸"),
    # olha só os últimos ~6 caracteres em vez de exigir "?" bem no fim exato.
    txt = r["mensagem"].strip()
    cauda = txt[-6:]
    ok = "?" in cauda or r.get("handoff") is True
    return (ok, "não terminou com pergunta (e não é handoff)" if not ok else "ok")


def vitalicio_sempre_qualificado(r):
    txt = r["mensagem"].lower()
    if "vitalício" not in txt and "vitalicio" not in txt:
        return (True, "ok (não mencionou)")
    ok = "enquanto o produto existir" in txt
    return (ok, "'vitalício' sem 'enquanto o produto existir'" if not ok else "ok")


def preco_com_apenas(r):
    txt = r["mensagem"].lower()
    if not re.search(r"r\$\s*\d", txt):
        return (True, "ok (não mencionou preço)")
    ok = "apenas" in txt
    return (ok, "preço mencionado sem 'apenas'" if not ok else "ok")


def nao_afirma_fato_registrado(r):
    txt = r["mensagem"].lower()
    achou = re.search(r"voc[êe] (relatou|disse|teve)\b", txt)
    return (not achou, "afirmou como fato registrado" if achou else "ok")


def nao_confunde_imagem_com_autoral(r):
    txt = r["mensagem"].lower()
    cita_imagem = "direito de imagem" in txt
    cita_autoral = "direito autoral" in txt or "direitos autorais" in txt
    if not (cita_imagem and cita_autoral):
        # só citou um dos dois, ou nenhum: não tem como confundir os dois.
        return (True, "ok (não citou os dois termos)")
    # citou os dois: só passa se explicitar que são diferentes/distintos.
    ok = bool(re.search(r"diferentes?|distint[oa]s?|não é a mesma coisa|n[aã]o \é o mesmo", txt))
    return (ok, "citou os dois sem deixar claro que são coisas diferentes" if not ok else "ok")


def handoff_curto_em_xingamento(r):
    ok = r.get("handoff") is True
    return (ok, "não acionou handoff em xingamento direcionado" if not ok else "ok")


def tom_solto_nao_formal(r):
    txt = r["mensagem"].lower()
    formais = ["me conta, o que", "me conta o que está pesando", "gostaria de entender", "poderia me informar"]
    achou = [f for f in formais if f in txt]
    return (not achou, f"soou formal demais: {achou}" if achou else "ok")


def nao_pula_pra_solucao_sem_implicacao(r):
    txt = r["mensagem"].lower()
    cita_produto = bool(re.search(r"\bmodelo|contrato visual|\+?200|advogado especializado", txt))
    return (not cita_produto, "citou o produto/solução sem antes fazer Implicação" if cita_produto else "ok")


def nao_repete_pergunta_quantos(r):
    txt = r["mensagem"].lower()
    achou = re.search(r"quantos? (trabalhos?|contratos?) voc[êe]", txt)
    return (not achou, "repetiu variação de 'quantos trabalhos/contratos você'" if achou else "ok")


def nao_pede_esclarecimento_ambiguo(r):
    txt = r["mensagem"].lower()
    achou = re.search(r"qual d[ao]s duas|isso [ée] sobre|foi sobre a primeira ou|me confirma qual", txt)
    return (not achou, "pediu esclarecimento em vez de seguir em frente" if achou else "ok")


def foco_beneficio_nao_ferramenta(r):
    txt = r["mensagem"].lower()
    achou = re.search(r"quer ver como (funciona|fica)|quer ver um exemplo|posso te mostrar como", txt)
    return (not achou, "pergunta final focou em mostrar a ferramenta, não no benefício" if achou else "ok")


CENARIOS = [
    {
        "nome": "Pergunta jurídica (ECA Digital) não é sinal de compra",
        "historico": [
            {"role": "assistant", "content": "Oi, Jéssica! Aqui é do time do Fotografia é o Meu Negócio."},
            {"role": "user", "content": "eu gostaria de saber mais sobre o contrato da lei pra postar fotos no instagram"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, nao_pulou_pra_preco, termina_com_pergunta],
    },
    {
        "nome": "Saudação neutra em qualquer horário",
        "historico": [
            {"role": "user", "content": "Olá"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, termina_com_pergunta],
    },
    {
        "nome": "Pergunta direta de preço deve ir com apenas + vitalício qualificado + pergunta no fim",
        "historico": [
            {"role": "assistant", "content": "Os modelos cobrem todos os tipos de trabalho fotográfico."},
            {"role": "user", "content": "gostaria de saber sobre os contratos, como funciona? Qual valor?"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, preco_com_apenas, vitalicio_sempre_qualificado, termina_com_pergunta],
    },
    {
        "nome": "Objeção de preço com dado próprio do lead, sem afirmar como fato registrado",
        "historico": [
            {"role": "assistant", "content": "Fica em apenas 12x de R$ 30,72, ou R$ 297,00 à vista."},
            {"role": "user", "content": "nossa, achei salgado o valor, não sei se vale a pena"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, nao_afirma_fato_registrado, termina_com_pergunta],
    },
    {
        "nome": "'Sim, mostra' não é sinal de compra, continua Encantamento",
        "historico": [
            {"role": "assistant", "content": "Os modelos cobrem cancelamento de última hora, entre outras situações."},
            {"role": "user", "content": "sim, mostra"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, nao_pulou_pra_preco, termina_com_pergunta],
    },
    {
        "nome": "Direito de imagem não pode ser confundido com direito autoral",
        "historico": [
            {"role": "user", "content": "postaram uma foto minha sem dar os créditos, isso é crime?"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, nao_confunde_imagem_com_autoral, termina_com_pergunta],
    },
    {
        "nome": "Xingamento direcionado aciona handoff",
        "historico": [
            {"role": "assistant", "content": "Fica em apenas 12x de R$ 30,72, ou R$ 297,00 à vista, quer que eu te mande o link?"},
            {"role": "user", "content": "seu golpista de merda, para de encher meu saco"},
        ],
        "checks": [handoff_curto_em_xingamento],
    },
    {
        "nome": "Tom solto quando lead responde rápido em Fechamento",
        "historico": [
            {"role": "assistant", "content": "Sobre o investimento: apenas 12x de R$ 30,72 ou R$ 297,00 à vista, acesso vitalício enquanto o produto existir. https://pay.hotmart.com/W87258826R?checkoutMode=10&sck=whatsapp-cl\n\nJá dá pra fechar hoje, ou ainda ficou alguma dúvida antes?"},
            {"role": "user", "content": "Ainda estou na dúvida"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, tom_solto_nao_formal, termina_com_pergunta],
    },
    {
        "nome": "Não pula pra Necessidade de solução sem passar por Implicação",
        "historico": [
            {"role": "assistant", "content": "Vi que você já passou (ou tem medo de passar) por cliente aparecendo anos depois pedindo uma foto que você nem guardou mais, sem nada assinado que te resguarde. Isso já aconteceu de verdade com você, ou é mais aquele medo de acontecer um dia?"},
            {"role": "user", "content": "Sim"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, nao_pula_pra_solucao_sem_implicacao, termina_com_pergunta],
    },
    {
        "nome": "Não repete pergunta de fechamento disfarçada",
        "historico": [
            {"role": "assistant", "content": "Com o modelo certo assinado antes de cada trabalho, essas situações de crédito e uso indevido da foto ficam resolvidas antes de qualquer dor de cabeça acontecer. Quantos trabalhos você fecha por mês hoje sem nada assinado?"},
            {"role": "user", "content": "Nenhum, todos faço assinados"},
            {"role": "assistant", "content": "Entendi, e o contrato atual que usa é aquele textão no formato Word? Você conhece as regras do Código de Defesa do Consumidor quanto à necessidade de clareza nos contratos?"},
            {"role": "user", "content": "Não, não conheço"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, nao_repete_pergunta_quantos, foco_beneficio_nao_ferramenta, termina_com_pergunta],
    },
    {
        "nome": "Sim/não ambíguo não trava pedindo esclarecimento",
        "historico": [
            {"role": "assistant", "content": "Isso já aconteceu de verdade com você, ou é mais aquele medo de acontecer um dia?"},
            {"role": "user", "content": "Sim"},
        ],
        "checks": [sem_saudacao_periodo, sem_virgula_antes_e_ou, nao_pede_esclarecimento_ambiguo, termina_com_pergunta],
    },
]


def main():
    env = carregar_env()
    api_key = os.environ.get("ANTHROPIC_API_KEY") or env.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("ANTHROPIC_API_KEY não encontrado no ambiente nem no .env")
    model = os.environ.get("ANTHROPIC_IA_MODEL") or env.get("ANTHROPIC_IA_MODEL") or "claude-haiku-4-5-20251001"

    system_prompt = extrair_prompt()
    print(f"Prompt carregado de {PROMPT_FILE.relative_to(RAIZ)} ({len(system_prompt)} caracteres)\n")

    total_ok = 0
    total = 0
    falhas = []
    tokens_in = 0
    tokens_out = 0

    for cenario in CENARIOS:
        print(f"── {cenario['nome']}")
        try:
            resposta, uso = chamar_anthropic(api_key, model, system_prompt, cenario["historico"])
        except (urllib.error.URLError, RuntimeError) as e:
            print(f"   ERRO DE CHAMADA: {e}\n")
            falhas.append((cenario["nome"], "chamada falhou", str(e)))
            continue

        tokens_in += uso.get("input_tokens", 0)
        tokens_out += uso.get("output_tokens", 0)

        print(f"   mensagem: {resposta.get('mensagem', '')!r}")
        for check in cenario["checks"]:
            total += 1
            ok, motivo = check(resposta)
            status = "OK " if ok else "FALHOU"
            print(f"   [{status}] {check.__name__}: {motivo}")
            if ok:
                total_ok += 1
            else:
                falhas.append((cenario["nome"], check.__name__, motivo))
        print()

    custo_usd = (tokens_in / 1_000_000) * PRECO_INPUT_POR_MTOK + (tokens_out / 1_000_000) * PRECO_OUTPUT_POR_MTOK
    print(f"Custo desta rodada: {tokens_in} tokens de entrada + {tokens_out} de saída ≈ US$ {custo_usd:.4f}\n")

    print("=" * 60)
    print(f"Resultado: {total_ok}/{total} checagens passaram")
    if falhas:
        print(f"\n{len(falhas)} falha(s):")
        for nome, check, motivo in falhas:
            print(f"  - [{nome}] {check}: {motivo}")
        sys.exit(1)
    else:
        print("Tudo passou.")


if __name__ == "__main__":
    main()
