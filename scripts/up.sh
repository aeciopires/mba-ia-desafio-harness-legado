#!/usr/bin/env bash
# Sobe o Balcão inteiro desta cópia: Postgres, migrations + seed, API, worker e front.
# Pode ser rodado de novo sem derrubar antes (idempotente). Uso: make up  (ou bash scripts/up.sh)
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"

bash "$RAIZ/scripts/check-os.sh" --aviso || true

command -v git >/dev/null 2>&1 || morre "git não encontrado. Veja REQUIREMENTS.md."
command -v docker >/dev/null 2>&1 || morre "docker não encontrado. Veja REQUIREMENTS.md."
docker compose version >/dev/null 2>&1 || morre "plugin docker compose (v2) não encontrado. Veja REQUIREMENTS.md."
docker info >/dev/null 2>&1 || morre "o Docker não está respondendo. Inicie o serviço (Linux) ou rode 'colima start' (macOS)."
usar_node

# 1. Dependências do host (gates, hook e testes). Instala só o que falta.
bash "$RAIZ/scripts/install-deps.sh"

# 2. Hook do Git: ativo em toda subida, sem passo extra.
git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

# 3. Portas, pasta de anexos e variáveis desta cópia.
escolher_portas
escrever_compose_env
carregar_portas

# 4. Containers (build incremental; a seed é idempotente).
info "Subindo os containers do projeto $(projeto)..."
dc up -d --build --remove-orphans

# 5. Espera a API e o front responderem.
esperar() {
  local url=$1 nome=$2 i
  for i in $(seq 1 90); do
    if node -e 'fetch(process.argv[1]).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))' "$url"; then
      ok "$nome respondendo em $url"
      return 0
    fi
    sleep 2
  done
  dc ps
  dc logs --tail 40
  morre "$nome não respondeu em $url. Veja os logs acima (ou make logs)."
}
esperar "http://localhost:$API_PORT/api/health" "API"
esperar "http://localhost:$WEB_PORT/" "Front"
[ -n "$(dc ps -q --status running worker)" ] || morre "o worker de triagem não está rodando. Veja make logs."
ok "worker de triagem rodando"

resumo
