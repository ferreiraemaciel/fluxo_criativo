#!/bin/bash
# Exporta um HTML de peça jurídica para PDF, respeitando o CSS de impressão
# (page-break-inside:avoid e -webkit-print-color-adjust:exact devem estar no HTML,
# ver references/design-system.md, seção "Página impressa").
#
# Uso:
#   scripts/exportar-pdf.sh caminho/documento.html [caminho/saida.pdf]
#
# Se o segundo argumento for omitido, salva ao lado do HTML trocando a extensão.

set -e

HTML="$1"
if [ -z "$HTML" ]; then
  echo "Uso: exportar-pdf.sh caminho/documento.html [caminho/saida.pdf]" >&2
  exit 1
fi
if [ ! -f "$HTML" ]; then
  echo "Arquivo não encontrado: $HTML" >&2
  exit 1
fi

PDF="${2:-${HTML%.html}.pdf}"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -f "$CHROME" ]; then
  echo "Google Chrome não encontrado em: $CHROME" >&2
  echo "Ajuste a variável CHROME neste script se o Chrome estiver em outro caminho." >&2
  exit 1
fi

HTML_DIR="$(cd "$(dirname "$HTML")" && pwd)"
HTML_NAME="$(basename "$HTML")"

"$CHROME" \
  --headless --disable-gpu --no-sandbox \
  --print-to-pdf="$PDF" \
  --print-to-pdf-no-header \
  --no-pdf-header-footer \
  "file://$HTML_DIR/$HTML_NAME"

echo "PDF gerado em: $PDF"
