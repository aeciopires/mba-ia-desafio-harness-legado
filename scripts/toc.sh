#!/usr/bin/env bash
# Gera/atualiza o sumário (TOC) de todos os .md. Uso: bash scripts/toc.sh [--check]
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
usar_node
exec node "$RAIZ/scripts/toc.mjs" "$@"
