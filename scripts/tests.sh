#!/usr/bin/env bash
# Testes unitários da API (api/src/**/*.test.ts). Não precisam de banco.
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
usar_node
bash "$RAIZ/scripts/install-deps.sh" >/dev/null
cd "$RAIZ/api" && exec ./node_modules/.bin/vitest run
