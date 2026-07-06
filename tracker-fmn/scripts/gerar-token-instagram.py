"""
Gerador de token de longa duração para Instagram Content Publishing API.

Modos:
  1. Sem argumentos: abre o navegador com URL de autorização OAuth.
     O código é capturado pela página do tracker e trocado pelo worker.
     Ao final, copie o token e rode:
       python3 gerar-token-instagram.py --salvar <TOKEN>

  2. --salvar <TOKEN>: salva o token no .env e atualiza o secret do Worker.
"""

import sys
import subprocess
import re
import webbrowser
import urllib.parse
from pathlib import Path

APP_ID   = "851080791403307"
REDIRECT = "https://tracker.fotografiaeomeunegocio.com.br/auth/callback"
SCOPES   = ",".join([
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
])


def save_to_env(token):
    env_path = Path(__file__).resolve().parent.parent / ".env"
    content  = env_path.read_text(encoding="utf-8")
    new_line = f"FB_ACCESS_TOKEN_PERMANENTE={token}"
    if "FB_ACCESS_TOKEN_PERMANENTE=" in content:
        content = re.sub(r"FB_ACCESS_TOKEN_PERMANENTE=.*", new_line, content)
    else:
        content += f"\n{new_line}\n"
    env_path.write_text(content, encoding="utf-8")
    print("✅ Token salvo no .env")


def update_worker_secret(token):
    worker_dir = Path(__file__).resolve().parent.parent / "workers" / "organico-media"
    print("⏳ Atualizando secret FB_ACCESS_TOKEN no Worker...")
    result = subprocess.run(
        ["npx", "wrangler", "secret", "put", "FB_ACCESS_TOKEN"],
        input=token + "\n",
        capture_output=True,
        text=True,
        cwd=str(worker_dir),
    )
    if result.returncode == 0:
        print("✅ Worker secret atualizado.")
    else:
        print(f"⚠️  Falha ao atualizar worker secret:\n{result.stderr}")


def mode_abrir_browser():
    auth_url = (
        f"https://www.facebook.com/dialog/oauth"
        f"?client_id={APP_ID}"
        f"&redirect_uri={urllib.parse.quote(REDIRECT)}"
        f"&scope={SCOPES}"
        f"&response_type=code"
    )
    print("\n🔐 Abrindo navegador para autorização do Instagram...")
    print(f"\nSe não abrir automaticamente, acesse:\n{auth_url}\n")
    webbrowser.open(auth_url)
    print("Após autorizar, a página do tracker vai exibir o token.")
    print("Copie o token e rode:")
    print("  python3 tracker-fmn/scripts/gerar-token-instagram.py --salvar <TOKEN>\n")


def mode_salvar(token):
    if not token or len(token) < 20:
        print("❌ Token inválido. Cole o token completo após --salvar.")
        sys.exit(1)
    save_to_env(token)
    update_worker_secret(token)
    print("\n✅ Pronto. Agendamento de posts deve funcionar agora.")
    print("   Lembre de renovar o token em ~50 dias.")


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) >= 2 and args[0] == "--salvar":
        mode_salvar(args[1])
    else:
        mode_abrir_browser()
