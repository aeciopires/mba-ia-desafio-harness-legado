# Imagem da API, do worker e do job de migrations/seed do Balcão.
# Base oficial multi-arquitetura (linux/amd64 e linux/arm64): https://hub.docker.com/_/node
ARG NODE_VERSION=26.13.1
FROM node:${NODE_VERSION}-bookworm-slim

# O Prisma precisa do OpenSSL para os engines.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV HOME=/tmp NODE_ENV=development NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY prisma ./prisma
# O client do Prisma é gerado dentro da imagem, para a plataforma dela (amd64 ou arm64).
RUN ./node_modules/.bin/prisma generate
COPY tsconfig.json ./
COPY src ./src

# Os containers rodam com o UID/GID do usuário do host (ver docker-compose.yml),
# para que os anexos gravados na pasta da cópia pertençam a ele.
RUN chmod -R a+rX /app

EXPOSE 4000
CMD ["./node_modules/.bin/tsx", "src/main.ts"]
