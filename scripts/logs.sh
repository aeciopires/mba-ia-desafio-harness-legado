#!/usr/bin/env bash
# Acompanha os logs dos containers desta cópia. Uso: bash scripts/logs.sh [serviço]
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"
dc logs -f --tail 100 "$@"
