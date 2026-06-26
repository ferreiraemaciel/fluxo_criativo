#!/bin/bash
# Propaga edições dos scripts para ~/fmn-sync/ (runtime do launchd, fora de Documents).
# Execute após editar qualquer script de sync, o .env ou o google-credentials.json.
set -e
RUNTIME=~/fmn-sync
SRC_SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
SRC_ROOT="$(cd "$SRC_SCRIPTS/.." && pwd)"

cp "$SRC_SCRIPTS/sync_runner.py"       "$RUNTIME/scripts/"
cp "$SRC_SCRIPTS/drive_sync_pastas.py" "$RUNTIME/scripts/"
cp "$SRC_SCRIPTS/drive_organizar.py"   "$RUNTIME/scripts/"
cp "$SRC_SCRIPTS/sync_drive.py"        "$RUNTIME/scripts/"
cp "$SRC_SCRIPTS/sync_hotmart.py"      "$RUNTIME/scripts/"
cp "$SRC_SCRIPTS/sync_recuperacao.py"  "$RUNTIME/scripts/"
cp "$SRC_SCRIPTS/sync_insights.py"     "$RUNTIME/scripts/"
cp "$SRC_ROOT/.env"                    "$RUNTIME/"
cp "$SRC_ROOT/google-credentials.json" "$RUNTIME/"

echo "Deploy concluído → $RUNTIME/scripts/"
