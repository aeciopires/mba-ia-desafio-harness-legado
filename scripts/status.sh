#!/usr/bin/env bash
# Mostra endereços, banco, pasta de anexos e o estado dos containers desta cópia.
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"
resumo || exit 0
echo
dc ps
