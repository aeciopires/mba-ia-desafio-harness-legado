#!/usr/bin/env bash
# Gera as imagens Docker desta cópia para a arquitetura da máquina (amd64 ou arm64).
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"
[ -f "$COMPOSE_ENV" ] || { usar_node; escolher_portas; escrever_compose_env; }
dc build
ok "imagens geradas para $(uname -m)."
