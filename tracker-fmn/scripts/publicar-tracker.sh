#!/usr/bin/env bash
#
# Publica o painel do Tracker. Carimba a versão de cada arquivo antes, para
# ninguém abrir a tela nova com o código velho em cache.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/carimbar-versoes.py
npx wrangler pages deploy frontend --project-name tracker-fmn --branch main --commit-dirty=true
echo "✅ Painel publicado."
