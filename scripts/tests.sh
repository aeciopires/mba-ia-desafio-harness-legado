#!/usr/bin/env bash
# Testes unitários: API (api/src/**/*.test.ts, sem banco) e scripts do harness (tests/harness/).
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
usar_node
bash "$RAIZ/scripts/install-deps.sh" >/dev/null
(cd "$RAIZ/api" && ./node_modules/.bin/vitest run)
node --test "$RAIZ"/tests/harness/*.test.mjs
