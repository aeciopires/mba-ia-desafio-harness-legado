#!/usr/bin/env bash
# Confere as dependências de software do Balcão e mostra onde instalar o que faltar
# (sempre pela fonte oficial). Sai com 1 se faltar algo obrigatório.
# Uso: make check-dependencies  (ou bash scripts/check-dependencies.sh)
set -uo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"

FALTANDO=0
SO=$(uname -s)

tem() { command -v "$1" >/dev/null 2>&1; }
falta() {
  erro "$1 não encontrado. Instale pela fonte oficial: $2"
  FALTANDO=1
}

bash "$RAIZ/scripts/check-os.sh" || FALTANDO=1

if tem git; then ok "git $(git --version | awk '{print $3}')"; else falta git "https://git-scm.com/downloads"; fi

if tem make; then ok "make $(make --version | head -1 | awk '{print $NF}')"; else
  if [ "$SO" = Darwin ]; then falta make "xcode-select --install (https://developer.apple.com/xcode/resources/)"; else falta make "sudo apt-get install -y make (https://packages.ubuntu.com/make)"; fi
fi

if [ "$SO" = Darwin ]; then
  if tem colima; then ok "colima $(colima version 2>/dev/null | head -1 | awk '{print $3}')"; else falta colima "https://github.com/abiosoft/colima#installation"; fi
  DOCKER_URL="https://github.com/abiosoft/colima#installation (Docker CLI e docker-compose via Homebrew: brew install docker docker-compose)"
else
  DOCKER_URL="https://docs.docker.com/engine/install/ubuntu/"
fi

if tem docker; then
  ok "docker $(docker version --format '{{.Client.Version}}' 2>/dev/null)"
  if docker compose version >/dev/null 2>&1; then ok "docker compose $(docker compose version --short 2>/dev/null)"; else falta "docker compose (v2)" "$DOCKER_URL"; fi
  if docker info >/dev/null 2>&1; then ok "daemon do Docker respondendo"; else
    if [ "$SO" = Darwin ]; then erro "o Docker não responde: rode 'colima start'."; else erro "o Docker não responde: 'sudo systemctl start docker' e confira se o seu usuário está no grupo docker (https://docs.docker.com/engine/install/linux-postinstall/)."; fi
    FALTANDO=1
  fi
else
  falta docker "$DOCKER_URL"
fi

if tem mise; then ok "mise $(mise --version 2>/dev/null | awk '{print $1}')"; else aviso "mise não encontrado (opcional; 'make install' instala no seu usuário): https://mise.jdx.dev/installing-mise.html"; fi

if tem mise && (cd "$RAIZ" && mise trust -q mise.toml >/dev/null 2>&1; mise which node >/dev/null 2>&1); then
  ok "node $(cd "$RAIZ" && mise exec -- node --version) (via mise)"
elif tem node; then
  MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$MAJOR" -ge "$NODE_MIN" ]; then ok "node $(node --version) (do sistema)"; else falta "Node.js $NODE_MIN+ (encontrado $(node --version))" "make install (via mise) ou https://nodejs.org/en/download"; fi
else
  falta "Node.js $NODE_MIN+" "make install (via mise) ou https://nodejs.org/en/download"
fi

echo
if [ "$FALTANDO" -ne 0 ]; then
  erro "faltam dependências. Veja REQUIREMENTS.md."
  exit 1
fi
ok "todas as dependências presentes."
