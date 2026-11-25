#!/usr/bin/env bash
# Testes de integração da API (api/test/integration) no banco balcao_test DESTA cópia.
# Cria e migra o banco de teste se preciso. Nunca usa o banco balcao.
# A parte HTTP dos testes (fluxos do avaliador) roda contra a API desta cópia.
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"
usar_node
bash "$RAIZ/scripts/install-deps.sh" >/dev/null
carregar_portas || morre "cópia não iniciada: rode make up."
containers_rodando || morre "cópia fora do ar: rode make up."

TEST_URL="postgresql://balcao:balcao@localhost:$DB_PORT/balcao_test"
if ! dc exec -T db psql -U balcao -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='balcao_test'" | grep -q 1; then
  info "criando o banco balcao_test"
  dc exec -T db psql -U balcao -d postgres -c "CREATE DATABASE balcao_test" >/dev/null
fi
info "aplicando migrations no balcao_test"
(cd api && DATABASE_URL="$TEST_URL" ./node_modules/.bin/prisma migrate deploy >/dev/null)

cd api
DATABASE_URL_TEST="$TEST_URL" \
  API_URL="http://localhost:$API_PORT" \
  UPLOADS_DIR_HOST="$UPLOADS_DIR" \
  exec ./node_modules/.bin/vitest run --config vitest.integration.config.mts
