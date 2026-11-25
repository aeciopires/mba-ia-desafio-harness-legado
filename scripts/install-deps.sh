#!/usr/bin/env bash
# Instala as dependências npm do projeto (raiz, api, web e blackbox) respeitando os lockfiles
# (npm ci) e gera o client do Prisma. Só reinstala uma pasta quando o lockfile mudou.
# Uso: bash scripts/install-deps.sh [--force]
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"
usar_node

FORCE=${1:-}
for dir in . api web blackbox; do
  lock="$RAIZ/$dir/package-lock.json"
  marca="$RAIZ/$dir/node_modules/.balcao-lock"
  [ -f "$lock" ] || continue
  if [ "$FORCE" = "--force" ] || [ ! -f "$marca" ] || ! cmp -s "$lock" "$marca"; then
    info "npm ci em $dir/"
    (cd "$RAIZ/$dir" && npm ci --no-audit --no-fund --loglevel=error)
    cp "$lock" "$marca"
  fi
done

if [ ! -f "$RAIZ/api/node_modules/.prisma/client/index.d.ts" ] || [ "$FORCE" = "--force" ] ||
  [ "$RAIZ/api/prisma/schema.prisma" -nt "$RAIZ/api/node_modules/.prisma/client/index.d.ts" ]; then
  info "gerando o client do Prisma"
  (cd "$RAIZ/api" && ./node_modules/.bin/prisma generate >/dev/null)
fi
ok "dependências npm instaladas"
