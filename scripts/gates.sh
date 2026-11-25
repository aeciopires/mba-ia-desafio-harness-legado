#!/usr/bin/env bash
# Roda os gates com o Node do projeto. Uso: bash scripts/gates.sh [--kit | opções do gates.mjs]
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"
usar_node
bash "$RAIZ/scripts/install-deps.sh" >/dev/null
if [ "${1:-}" = "--kit" ]; then
  exec bash kit-gates/verificar.sh . "node scripts/gates.mjs"
fi
exec node scripts/gates.mjs "$@"
