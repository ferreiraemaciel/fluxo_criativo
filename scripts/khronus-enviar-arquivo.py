#!/usr/bin/env python3
"""
Khronus: enviar um arquivo (PDF, imagem, documento) para um contato do WhatsApp.

Faz o mesmo caminho que a tela de Atendimentos: sobe o arquivo para o armazenamento
`whatsapp-midia` (pasta saida/) e coloca uma linha na fila `crm_whatsapp_fila_envio`.
Quem envia de verdade é a ponte do programa Khronus aberto no computador, pelo
WhatsApp do estúdio escolhido. A ponte apaga o arquivo do armazenamento depois de
entregar.

SEGURANÇA
  - Sem --confirmar o script só SIMULA: mostra contato, estúdio, arquivo e estado da
    ponte, e não grava nada.
  - Se o contato existir em mais de um estúdio (ex: Ferreira & Maciel e Fotografia é o
    Meu Negócio), o script para e pede --estudio. Nunca escolhe sozinho.
  - Se a ponte do estúdio estiver fora do ar, recusa: a mensagem ficaria na fila e sairia
    horas depois, quando alguém abrisse o programa.
  - Credenciais vêm de ~/Documents/khronus/.env e nunca são impressas.

Uso:
  python3 scripts/khronus-enviar-arquivo.py --contato "Lucas" --estudio fmn \\
      --arquivo ~/Documents/reunioes/AAAA-MM-DD-tema/resumo-pauta.pdf \\
      --nome "Resumo e pauta da reunião.pdf" --legenda "texto curto" [--confirmar]

  --contato TEXTO       parte do nome do contato
  --telefone DIGITOS    alternativa: final ou número completo, só dígitos
  --contato-id UUID     usa o contato exato (depois de uma listagem)
  --estudio fem|fmn|TEXTO   filtra o estúdio pelo nome (fem = Ferreira & Maciel,
                        fmn = Fotografia é o Meu Negócio)
"""

import argparse
import json
import mimetypes
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ENV = Path.home() / "Documents" / "khronus" / ".env"
BUCKET = "whatsapp-midia"
LIMITE_BYTES = 50 * 1024 * 1024  # limite do bucket
ALIAS_ESTUDIO = {"fem": "ferreira", "fmn": "neg"}  # trecho do nome do estúdio
PING_MAX_SEG = 90


def carregar_env():
    if not ENV.exists():
        sys.exit(f"Não encontrei {ENV}.")
    v = {}
    for linha in ENV.read_text(encoding="utf-8").splitlines():
        linha = linha.strip()
        if "=" in linha and not linha.startswith("#"):
            k, val = linha.split("=", 1)
            v[k.strip()] = val.strip().strip('"').strip("'")
    if not v.get("SUPABASE_URL") or not v.get("SUPABASE_SERVICE_KEY"):
        sys.exit("SUPABASE_URL ou SUPABASE_SERVICE_KEY ausentes no .env do Khronus.")
    return v["SUPABASE_URL"].rstrip("/"), v["SUPABASE_SERVICE_KEY"]


URL, KEY = carregar_env()


def chamar(metodo, caminho, corpo=None, cabecalhos=None, bruto=False):
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    h.update(cabecalhos or {})
    dados = None
    if corpo is not None:
        dados = corpo if isinstance(corpo, bytes) else json.dumps(corpo).encode("utf-8")
    req = urllib.request.Request(URL + caminho, data=dados, headers=h, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            texto = r.read()
            if bruto:
                return texto
            return json.loads(texto) if texto else None
    except urllib.error.HTTPError as e:
        detalhe = e.read().decode("utf-8", "replace")[:400]
        sys.exit(f"Erro {e.code} em {metodo} {caminho.split('?')[0]}: {detalhe}")
    except urllib.error.URLError as e:
        sys.exit(f"Sem conexão com o banco: {e.reason}")


def tabela(nome, params):
    q = urllib.parse.urlencode(params, safe="*,.:()")
    return chamar("GET", f"/rest/v1/{nome}?{q}", cabecalhos={"Accept-Profile": "khronus"})


def final_tel(t):
    d = re.sub(r"\D", "", t or "")
    return f"...{d[-4:]}" if d else "(sem número)"


def buscar_contatos(args, estudios):
    if args.contato_id:
        cs = tabela("crm_whatsapp_contatos", {
            "select": "id,studio_id,nome,telefone,ultima_msg_em", "id": f"eq.{args.contato_id}"})
    else:
        p = {"select": "id,studio_id,nome,telefone,ultima_msg_em",
             "order": "ultima_msg_em.desc.nullslast", "limit": "20"}
        if args.contato:
            p["nome"] = f"ilike.*{args.contato}*"
        elif args.telefone:
            p["telefone"] = f"like.*{re.sub(r'[^0-9]', '', args.telefone)}*"
        else:
            sys.exit("Informe --contato, --telefone ou --contato-id.")
        cs = tabela("crm_whatsapp_contatos", p)
    if args.estudio:
        alvo = ALIAS_ESTUDIO.get(args.estudio.lower(), args.estudio.lower())
        ids = {e["id"] for e in estudios if alvo in (e["nome"] or "").lower()}
        cs = [c for c in cs if c["studio_id"] in ids]
    return cs


def estado_da_ponte(studio_id):
    linhas = tabela("crm_whatsapp_ponte_status", {
        "select": "ultimo_ping,whatsapp_conectado,numero_whatsapp,maquina_nome,versao_extensao",
        "studio_id": f"eq.{studio_id}", "order": "ultimo_ping.desc", "limit": "5"})
    agora = datetime.now(timezone.utc)
    for l in linhas:
        ping = datetime.fromisoformat(l["ultimo_ping"].replace("Z", "+00:00"))
        idade = (agora - ping).total_seconds()
        if idade <= PING_MAX_SEG and l.get("whatsapp_conectado"):
            return True, (
                f"no ar (máquina {l.get('maquina_nome') or '?'}, "
                f"número final {final_tel(l.get('numero_whatsapp'))}, "
                f"versão {l.get('versao_extensao')}, último sinal há {int(idade)}s)"
            ), l
    if linhas:
        idade = int((agora - datetime.fromisoformat(
            linhas[0]["ultimo_ping"].replace("Z", "+00:00"))).total_seconds())
        return False, f"fora do ar (último sinal há {idade // 60} min)", linhas[0]
    return False, "sem registro de ponte para esse estúdio", None


def main():
    ap = argparse.ArgumentParser(description="Envia um arquivo pelo WhatsApp do Khronus.")
    ap.add_argument("--contato")
    ap.add_argument("--telefone")
    ap.add_argument("--contato-id", dest="contato_id")
    ap.add_argument("--estudio")
    ap.add_argument("--arquivo", required=True)
    ap.add_argument("--nome", help="nome do arquivo como o cliente vai ver")
    ap.add_argument("--legenda", default="")
    ap.add_argument("--confirmar", action="store_true", help="envia de verdade")
    args = ap.parse_args()

    arquivo = Path(args.arquivo).expanduser().resolve()
    if not arquivo.is_file():
        sys.exit(f"Arquivo não encontrado: {arquivo}")
    tamanho = arquivo.stat().st_size
    if tamanho > LIMITE_BYTES:
        sys.exit(f"Arquivo com {tamanho // 1024 // 1024} MB passa do limite de 50 MB.")
    nome_exibicao = args.nome or arquivo.name

    estudios = tabela("crm_studios", {"select": "id,nome"})
    nomes_estudio = {e["id"]: e["nome"] for e in estudios}
    cands = buscar_contatos(args, estudios)

    if len(cands) != 1:
        if not cands:
            sys.exit("Nenhum contato encontrado com esses critérios.")
        print(f"{len(cands)} contatos possíveis. Nada foi enviado. Escolha um e rode de novo "
              "com --contato-id (ou filtre com --estudio):\n")
        for c in cands:
            print(f"  {c['id']}  {c['nome'] or '(sem nome)'}  |  {nomes_estudio.get(c['studio_id'], '?')}"
                  f"  |  tel {final_tel(c['telefone'])}  |  última msg {str(c.get('ultima_msg_em') or '-')[:16]}")
        sys.exit(2)

    c = cands[0]
    estudio = nomes_estudio.get(c["studio_id"], "?")
    no_ar, txt_ponte, _ = estado_da_ponte(c["studio_id"])

    print("PRONTO PARA ENVIAR" if args.confirmar else "SIMULAÇÃO (nada foi gravado)")
    print(f"  Contato:  {c['nome'] or '(sem nome)'}  (tel {final_tel(c['telefone'])})")
    print(f"  Estúdio:  {estudio}  (o WhatsApp desse estúdio é quem envia)")
    print(f"  Arquivo:  {nome_exibicao}  ({tamanho // 1024} KB)")
    print(f"  Legenda:  {args.legenda or '(sem legenda)'}")
    print(f"  Ponte:    {txt_ponte}")

    if not no_ar:
        sys.exit("\nA ponte desse estúdio não está respondendo. Abra o programa Khronus, confira que o "
                 "WhatsApp está conectado e rode de novo. Recusei para a mensagem não ficar parada na fila "
                 "e sair depois, sem ninguém ver.")
    if not args.confirmar:
        print("\nPara enviar de verdade, rode o mesmo comando com --confirmar.")
        return

    seguro = re.sub(r"[^a-zA-Z0-9._-]", "_", nome_exibicao)
    caminho = f"saida/{int(time.time() * 1000)}_0_{seguro}"
    mime = mimetypes.guess_type(arquivo.name)[0] or "application/octet-stream"

    chamar("POST", f"/storage/v1/object/{BUCKET}/{urllib.parse.quote(caminho)}",
           corpo=arquivo.read_bytes(),
           cabecalhos={"Content-Type": mime, "x-upsert": "false"}, bruto=True)

    try:
        linha = chamar("POST", "/rest/v1/crm_whatsapp_fila_envio", corpo={
            "studio_id": c["studio_id"], "contato_id": c["id"], "telefone": c["telefone"],
            "tipo": "documento", "corpo": args.legenda or None,
            "midia_url": caminho, "midia_nome": nome_exibicao,
        }, cabecalhos={"Content-Type": "application/json", "Content-Profile": "khronus",
                       "Prefer": "return=representation"})
    except SystemExit:
        # não deixa o arquivo órfão no armazenamento
        try:
            chamar("DELETE", f"/storage/v1/object/{BUCKET}/{urllib.parse.quote(caminho)}", bruto=True)
        except SystemExit:
            pass
        raise
    fila_id = linha[0]["id"]
    print(f"\nNa fila (id {fila_id[:8]}). Aguardando a ponte...")

    for _ in range(25):
        time.sleep(2)
        r = tabela("crm_whatsapp_fila_envio", {"select": "status,erro,enviado_em", "id": f"eq.{fila_id}"})
        st = r[0]["status"] if r else "?"
        if st == "enviado":
            print(f"Enviado ao WhatsApp de {c['nome'] or 'contato'} às {str(r[0].get('enviado_em'))[11:16]} (UTC).")
            return
        if st == "falhou":
            sys.exit(f"A ponte não conseguiu enviar: {r[0].get('erro') or 'sem detalhe'}")
    print("Ainda na fila depois de 50 segundos. A ponte pode estar ocupada: confira na conversa do Khronus.")


if __name__ == "__main__":
    main()
