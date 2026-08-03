#!/bin/bash
# Puxa (git pull) automaticamente, no início da sessão, os repositórios pessoais
# do Felipe (fluxo-criativo, meus-produtos, khronus, fmn-site), sem nunca travar
# a sessão e sem nunca sobrescrever trabalho local não commitado.

set -u

FLUXO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DOCS_DIR="$(dirname "$FLUXO_DIR")"

updated=0
skipped=0

sync_repo() {
  local dir="$1"
  local remote="${2:-origin}"

  [ -d "$dir/.git" ] || return 0

  local branch
  branch=$(git -C "$dir" symbolic-ref --short -q HEAD) || return 0

  # Nunca faz pull em cima de mudança local não commitada, pra não arriscar sobrescrever trabalho em andamento.
  if [ -n "$(git -C "$dir" status --porcelain 2>/dev/null)" ]; then
    skipped=$((skipped + 1))
    return 0
  fi

  if timeout 10 git -C "$dir" fetch "$remote" "$branch" --quiet 2>/dev/null; then
    if timeout 10 git -C "$dir" pull "$remote" "$branch" --ff-only --quiet 2>/dev/null; then
      updated=$((updated + 1))
    fi
  fi
  return 0
}

sync_repo "$FLUXO_DIR" origin
sync_repo "$FLUXO_DIR/meus-produtos" origin
sync_repo "$DOCS_DIR/khronus" origin
sync_repo "$DOCS_DIR/fmn-site" origin

if [ "$skipped" -gt 0 ]; then
  echo "git: $updated repositório(s) atualizado(s), $skipped pulado(s) por ter mudança local não salva"
else
  echo "git: $updated repositório(s) atualizado(s)"
fi

exit 0
