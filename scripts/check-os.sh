#!/usr/bin/env bash
# Confere se o sistema operacional é suportado pelo Balcão.
#   Ubuntu 22.04, 24.04 e 26.04 (amd64)
#   macOS (amd64 e arm64), com Colima no lugar do Docker Desktop
# Uso: bash scripts/check-os.sh          -> sai com 1 se o sistema não for suportado
#      bash scripts/check-os.sh --aviso  -> só avisa (usado por make up)
set -uo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"

MODO=${1:-}
UBUNTU_SUPORTADOS="22.04 24.04 26.04"

falha() {
  if [ "$MODO" = "--aviso" ]; then
    aviso "$* Seguindo mesmo assim; veja REQUIREMENTS.md."
    exit 0
  fi
  erro "$* Veja REQUIREMENTS.md."
  exit 1
}

SO=$(uname -s)
ARQ=$(uname -m)
case "$SO" in
  Linux)
    [ -r /etc/os-release ] || falha "Linux sem /etc/os-release: distribuição não identificada."
    # shellcheck disable=SC1091
    . /etc/os-release
    [ "${ID:-}" = "ubuntu" ] || falha "Linux ${PRETTY_NAME:-desconhecido} não é suportado (suportados: Ubuntu $UBUNTU_SUPORTADOS)."
    case " $UBUNTU_SUPORTADOS " in
      *" ${VERSION_ID:-} "*) ;;
      *) falha "Ubuntu ${VERSION_ID:-?} não é suportado (suportados: $UBUNTU_SUPORTADOS)." ;;
    esac
    case "$ARQ" in
      x86_64 | amd64) ;;
      *) falha "arquitetura $ARQ não suportada no Ubuntu (suportada: amd64)." ;;
    esac
    [ "$MODO" = "--aviso" ] || ok "sistema suportado: Ubuntu $VERSION_ID ($ARQ). Instruções: docs/requirements/REQUIREMENTS-ubuntu.md"
    ;;
  Darwin)
    VERSAO=$(sw_vers -productVersion 2>/dev/null || echo '?')
    case "$ARQ" in
      x86_64 | arm64) ;;
      *) falha "arquitetura $ARQ não suportada no macOS (suportadas: amd64 e arm64)." ;;
    esac
    [ "$MODO" = "--aviso" ] || ok "sistema suportado: macOS $VERSAO ($ARQ). Instruções: docs/requirements/REQUIREMENTS-macos.md"
    ;;
  *)
    falha "sistema $SO não suportado (suportados: Ubuntu $UBUNTU_SUPORTADOS amd64 e macOS amd64/arm64)."
    ;;
esac
exit 0
