#!/usr/bin/env bash
# Instala o mise (no diretório do usuário, sem sudo), as ferramentas do mise.toml (Node.js)
# e as dependências npm do projeto. Não instala nada globalmente.
# Docker e Docker Compose são instalados pelo sistema operacional: veja REQUIREMENTS.md.
# Uso: make install  (ou bash scripts/install.sh)
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"

bash "$RAIZ/scripts/check-os.sh" --aviso || true

if ! command -v mise >/dev/null 2>&1 && [ ! -x "$HOME/.local/bin/mise" ]; then
  command -v curl >/dev/null 2>&1 || morre "curl não encontrado; instale o mise manualmente: https://mise.jdx.dev/installing-mise.html"
  info "instalando o mise em ~/.local/bin (instalador oficial: https://mise.run)"
  curl -fsSL https://mise.run | sh
fi
export PATH="$HOME/.local/bin:$PATH"
ok "mise $(mise --version | awk '{print $1}')"

info "instalando as ferramentas do mise.toml"
mise trust -q "$RAIZ/mise.toml"
mise install

bash "$RAIZ/scripts/install-deps.sh"
git config core.hooksPath .githooks
ok "hook de pre-commit ativo (.githooks/pre-commit)"

cat <<'MSG'

Pronto. Para usar o Node do projeto no seu terminal, ative o mise no seu shell
(https://mise.jdx.dev/getting-started.html#activate-mise), por exemplo:
  echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
Os comandos do Makefile já usam o mise sozinhos. Próximo passo: make up
MSG
