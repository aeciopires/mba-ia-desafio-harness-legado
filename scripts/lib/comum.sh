# shellcheck shell=bash
# Funções compartilhadas pelos scripts do Balcão. Use com: source "$(dirname "$0")/lib/comum.sh"

RAIZ=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)
RUN_DIR="$RAIZ/.run"
PORTS_FILE="$RUN_DIR/ports.env"
COMPOSE_ENV="$RUN_DIR/compose.env"
UPLOADS_DIR="$RUN_DIR/uploads"
NODE_MIN=22

if [ -t 1 ]; then
  C_OK=$'\033[32m' C_AVISO=$'\033[33m' C_ERRO=$'\033[31m' C_NEG=$'\033[1m' C_FIM=$'\033[0m'
else
  C_OK='' C_AVISO='' C_ERRO='' C_NEG='' C_FIM=''
fi

info() { printf '%s\n' "==> $*"; }
ok() { printf '%s\n' "${C_OK}OK${C_FIM}  $*"; }
aviso() { printf '%s\n' "${C_AVISO}AVISO${C_FIM} $*" >&2; }
erro() { printf '%s\n' "${C_ERRO}ERRO${C_FIM}  $*" >&2; }
morre() {
  erro "$*"
  exit 1
}

# Nome do projeto Docker Compose desta cópia: pasta + hash do caminho absoluto.
# Duas worktrees (mesmo com o mesmo nome de pasta) nunca dividem containers nem volumes.
projeto() {
  local base hash
  base=$(basename "$RAIZ" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9\n' '-' | sed 's/--*/-/g; s/^-//; s/-$//' | cut -c1-30)
  if command -v sha1sum >/dev/null 2>&1; then
    hash=$(printf '%s' "$RAIZ" | sha1sum | cut -c1-8)
  else
    hash=$(printf '%s' "$RAIZ" | shasum | cut -c1-8)
  fi
  printf 'balcao-%s-%s' "${base:-copia}" "$hash"
}

# docker compose desta cópia (projeto e variáveis próprios).
dc() {
  local args=(-p "$(projeto)" -f "$RAIZ/docker-compose.yml" --project-directory "$RAIZ")
  [ -f "$COMPOSE_ENV" ] && args+=(--env-file "$COMPOSE_ENV")
  docker compose "${args[@]}" "$@"
}

# Node: usa o do mise (mise.toml) quando existe; senão, o do sistema.
usar_node() {
  if command -v mise >/dev/null 2>&1; then
    mise trust -q "$RAIZ/mise.toml" >/dev/null 2>&1 || true
    if mise which node >/dev/null 2>&1; then
      eval "$(cd "$RAIZ" && mise env -s bash 2>/dev/null)" || true
    fi
  fi
  command -v node >/dev/null 2>&1 || morre "Node.js não encontrado. Rode 'make install' ou instale o Node.js LTS ($NODE_MIN ou superior). Veja REQUIREMENTS.md."
  local major
  major=$(node -p 'process.versions.node.split(".")[0]')
  [ "$major" -ge "$NODE_MIN" ] || morre "Node.js $major encontrado; o Balcão precisa do $NODE_MIN ou superior. Rode 'make install'."
}

# Porta livre no host? (ninguém escutando nela)
porta_livre() {
  node -e '
    const s = require("net").createServer()
    s.once("error", () => process.exit(1))
    s.once("listening", () => s.close(() => process.exit(0)))
    s.listen(Number(process.argv[1]), "0.0.0.0")
  ' "$1" 2>/dev/null
}

# Primeira porta livre a partir de $1, pulando as listadas em $2 (separadas por espaço).
proxima_porta() {
  local p=$1 reservadas=" ${2:-} "
  while [ "$p" -lt 65000 ]; do
    if [ "${reservadas#* "$p" }" = "$reservadas" ] && porta_livre "$p"; then
      printf '%s' "$p"
      return 0
    fi
    p=$((p + 1))
  done
  return 1
}

containers_rodando() {
  [ -n "$(dc ps -q --status running 2>/dev/null)" ]
}

# Escolhe (ou reaproveita) as portas desta cópia e grava em .run/ports.env.
escolher_portas() {
  mkdir -p "$RUN_DIR"
  local API_PORT='' WEB_PORT='' DB_PORT=''
  # shellcheck disable=SC1090
  [ -f "$PORTS_FILE" ] && . "$PORTS_FILE"

  if containers_rodando && [ -n "$API_PORT" ] && [ -n "$WEB_PORT" ] && [ -n "$DB_PORT" ]; then
    : # a cópia já está no ar: mantém as portas dela
  else
    { [ -n "$API_PORT" ] && porta_livre "$API_PORT"; } || API_PORT=$(proxima_porta 4000 "$WEB_PORT $DB_PORT")
    { [ -n "$WEB_PORT" ] && porta_livre "$WEB_PORT"; } || WEB_PORT=$(proxima_porta 5173 "$API_PORT $DB_PORT")
    { [ -n "$DB_PORT" ] && porta_livre "$DB_PORT"; } || DB_PORT=$(proxima_porta 5432 "$API_PORT $WEB_PORT")
  fi
  [ -n "$API_PORT" ] && [ -n "$WEB_PORT" ] && [ -n "$DB_PORT" ] || morre "não encontrei portas livres."

  cat >"$PORTS_FILE" <<EOF
API_PORT=$API_PORT
WEB_PORT=$WEB_PORT
DB_PORT=$DB_PORT
EOF
}

carregar_portas() {
  [ -f "$PORTS_FILE" ] || return 1
  # shellcheck disable=SC1090
  . "$PORTS_FILE"
}

escrever_compose_env() {
  carregar_portas
  mkdir -p "$UPLOADS_DIR"
  cat >"$COMPOSE_ENV" <<EOF
# Gerado por scripts/up.sh. Não edite: rode make up de novo.
API_PORT=$API_PORT
WEB_PORT=$WEB_PORT
DB_PORT=$DB_PORT
UPLOADS_DIR=$UPLOADS_DIR
HOST_UID=$(id -u)
HOST_GID=$(id -g)
EOF
}

# Mostra os endereços da cópia.
resumo() {
  carregar_portas || {
    erro "esta cópia ainda não foi iniciada (rode make up)."
    return 1
  }
  cat <<EOF

${C_NEG}Balcão no ar${C_FIM} (projeto Docker Compose: $(projeto))
  API:     http://localhost:$API_PORT   (saúde: http://localhost:$API_PORT/api/health)
  Front:   http://localhost:$WEB_PORT
  Banco:   postgresql://balcao:balcao@localhost:$DB_PORT/balcao
  Anexos:  $UPLOADS_DIR
  Logs:    make logs      Derrubar: make down      Gates: make gates

Contas da seed: admin@balcao.dev / Admin@123, agente@balcao.dev / Agente@123, cliente@balcao.dev / Cliente@123
EOF
}
