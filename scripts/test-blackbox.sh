#!/usr/bin/env bash
# Suíte caixa-preta (blackbox/) contra a API desta cópia. Precisa da cópia no ar (make up).
# Para outra API: API_URL=http://localhost:4001 bash scripts/test-blackbox.sh
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
usar_node
bash "$RAIZ/scripts/install-deps.sh" >/dev/null
if [ -z "${API_URL:-}" ]; then
  carregar_portas || morre "cópia não iniciada: rode make up (ou informe API_URL)."
  API_URL="http://localhost:$API_PORT"
fi
info "suíte caixa-preta contra $API_URL"
cd "$RAIZ/blackbox" && API_URL="$API_URL" exec npm test
