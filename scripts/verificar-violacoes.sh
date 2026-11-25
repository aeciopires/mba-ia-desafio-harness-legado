#!/usr/bin/env bash
# Roda o kit-gates/verificar.sh com outra pasta de violações, no mesmo formato do kit.
#
# Uso:
#   bash scripts/verificar-violacoes.sh harness/violacoes-proprias [regra]
#   bash scripts/verificar-violacoes.sh harness/violacoes-extras   [regra]
#
# O kit procura as violações na pasta "violacoes" ao lado do verificar.sh. Este script monta
# uma pasta temporária com um link para o verificar.sh do kit e outro para a pasta pedida,
# sem copiar nem alterar o kit-gates/.
set -euo pipefail

RAIZ=$(cd "$(dirname "$0")/.." && pwd -P)
PASTA=${1:?informe a pasta de violações, ex.: harness/violacoes-proprias}
REGRA=${2:-}
GATES=${GATES:-node scripts/gates.mjs}

ALVO=$(cd "$RAIZ/$PASTA" 2>/dev/null && pwd -P) || { echo "pasta não encontrada: $PASTA" >&2; exit 2; }
TMP=$(mktemp -d "${TMPDIR:-/tmp}/balcao-violacoes.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
ln -s "$RAIZ/kit-gates/verificar.sh" "$TMP/verificar.sh"
ln -s "$ALVO" "$TMP/violacoes"

if [ -n "$REGRA" ]; then
  bash "$TMP/verificar.sh" "$RAIZ" "$GATES" "$REGRA"
else
  bash "$TMP/verificar.sh" "$RAIZ" "$GATES"
fi
