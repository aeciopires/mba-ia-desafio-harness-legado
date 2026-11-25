#!/usr/bin/env bash
# Confere a documentação (AGENTS.md, CLAUDE.md, README, incidentes, links e TOC).
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
usar_node
exec node "$RAIZ/scripts/check-docs.mjs" "$@"
