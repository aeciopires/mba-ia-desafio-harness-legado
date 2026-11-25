# Imagem do front (Vite dev server) do Balcão.
# Base oficial multi-arquitetura (linux/amd64 e linux/arm64): https://hub.docker.com/_/node
ARG NODE_VERSION=26.13.1
FROM node:${NODE_VERSION}-bookworm-slim

WORKDIR /app
ENV HOME=/tmp NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src

# O Vite grava cache em node_modules/.vite e um arquivo temporário ao lado do vite.config.ts;
# o container roda com o UID do host, então essas pastas precisam ser graváveis.
RUN mkdir -p node_modules/.vite && chmod -R a+rX /app && chmod -R a+rwX node_modules/.vite && chmod a+rwx /app

EXPOSE 5173
CMD ["./node_modules/.bin/vite"]
