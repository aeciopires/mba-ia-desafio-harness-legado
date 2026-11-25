#!/usr/bin/env bash
# Build multi-arquitetura (linux/amd64 e linux/arm64) das imagens do Balcão com docker buildx.
# Valida que as imagens compilam nas duas plataformas (Ubuntu amd64, macOS Intel e Apple Silicon).
# Arquitetura diferente da máquina precisa de emulação QEMU:
#   https://docs.docker.com/build/building/multi-platform/#qemu
# Uso: bash scripts/images.sh [plataformas]   (padrão: linux/amd64,linux/arm64)
set -euo pipefail
# shellcheck source=lib/comum.sh
source "$(dirname "$0")/lib/comum.sh"
cd "$RAIZ"

PLATAFORMAS=${1:-linux/amd64,linux/arm64}
docker buildx version >/dev/null 2>&1 || morre "docker buildx não encontrado: https://docs.docker.com/build/install-buildx/"

BUILDER=balcao-multiarch
if ! docker buildx inspect "$BUILDER" >/dev/null 2>&1; then
  info "criando o builder $BUILDER (driver docker-container)"
  docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
fi

for app in api web; do
  info "build de $app para $PLATAFORMAS"
  docker buildx build --builder "$BUILDER" --platform "$PLATAFORMAS" -t "balcao-$app:multiarch" "$RAIZ/$app"
done
ok "imagens compiladas para $PLATAFORMAS (cache do buildx; use --push para publicar num registry)."
