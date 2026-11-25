#!/usr/bin/env bash
# Derruba tudo o que a subida DESTA cópia iniciou (containers e rede do projeto).
# Não mexe em outras cópias. Mantém o banco (volume) e os anexos para a próxima subida.
# Uso: make down  (ou bash scripts/down.sh)
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"

command -v docker >/dev/null 2>&1 || morre "docker não encontrado."
info "Derrubando o projeto $(projeto)..."
if [ "${1:-}" = "--volumes" ]; then
  dc down --remove-orphans --volumes
  ok "cópia derrubada e banco apagado."
else
  dc down --remove-orphans
  ok "cópia derrubada. Banco e anexos mantidos (para apagar o banco: bash scripts/down.sh --volumes)."
fi
