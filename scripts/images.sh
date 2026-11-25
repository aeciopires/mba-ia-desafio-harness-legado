#!/usr/bin/env bash
# Build multi-arquitetura (linux/amd64 e linux/arm64) das imagens do Balcão com docker buildx.
# Valida que as imagens compilam nas plataformas suportadas (Ubuntu amd64, macOS Intel e Apple Silicon).
#
# - Usa o builder atual do Docker. Multi-plataforma precisa do containerd image store
#   (padrão no Docker Engine 29+) ou de um builder docker-container:
#   https://docs.docker.com/build/building/multi-platform/
# - Compilar para uma arquitetura diferente da máquina precisa de emulação QEMU:
#   https://docs.docker.com/build/building/multi-platform/#qemu
#   No Mac Apple Silicon, linux/arm64 é nativo; no Ubuntu amd64, linux/amd64 é nativo.
#
# Uso: bash scripts/images.sh [plataformas]   (padrão: linux/amd64,linux/arm64)
#      bash scripts/images.sh linux/amd64     (só uma plataforma)
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"

PLATAFORMAS=${1:-linux/amd64,linux/arm64}
docker buildx version >/dev/null 2>&1 || morre "docker buildx não encontrado: https://docs.docker.com/build/install-buildx/"

for app in api web; do
  info "build de $app para $PLATAFORMAS"
  if ! docker buildx build --platform "$PLATAFORMAS" -t "balcao-$app:multiarch" "$RAIZ/$app"; then
    erro "o build de $app para $PLATAFORMAS falhou."
    erro "Plataforma diferente da máquina? Instale a emulação QEMU: https://docs.docker.com/build/building/multi-platform/#qemu"
    exit 1
  fi
done
ok "imagens balcao-api:multiarch e balcao-web:multiarch compiladas para $PLATAFORMAS."
