# Requisitos: macOS (amd64 e arm64) com Colima

<!-- TOC -->
- [Por que Colima](#por-que-colima)
- [Com o Makefile](#com-o-makefile)
- [Instalação manual](#instalação-manual)
  - [Git e make](#git-e-make)
  - [Homebrew](#homebrew)
  - [Colima, Docker CLI e Docker Compose](#colima-docker-cli-e-docker-compose)
  - [mise e Node.js](#mise-e-nodejs)
  - [Dependências do projeto](#dependências-do-projeto)
- [Conferência](#conferência)
<!-- TOC -->

## Por que Colima

O Balcão usa o [Colima](https://github.com/abiosoft/colima) no lugar do Docker Desktop: é open source, roda os containers numa VM leve e funciona com o mesmo `docker` e `docker compose` de linha de comando. No Apple Silicon (arm64), as imagens `linux/arm64` rodam nativamente; no Intel (amd64), as `linux/amd64`.

## Com o Makefile

```bash
xcode-select --install          # git e make (Command Line Tools), se ainda não tiver
make check-os
make check-dependencies         # mostra o link oficial do que faltar
make install                    # mise em ~/.local/bin, Node.js do mise.toml e dependências npm
colima start --cpu 4 --memory 4
make up
```

O Colima, o Docker CLI e o Compose são instalados à parte, como abaixo (o Makefile não instala nada globalmente).

## Instalação manual

### Git e make

Command Line Tools da Apple (https://developer.apple.com/xcode/resources/):

```bash
xcode-select --install
```

### Homebrew

Instalador oficial (https://brew.sh):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Colima, Docker CLI e Docker Compose

Conforme o README oficial do Colima (https://github.com/abiosoft/colima#installation):

```bash
brew install colima docker docker-compose docker-buildx
```

Para o `docker compose` (com espaço) achar o plugin instalado pelo Homebrew, adicione a pasta de plugins em `~/.docker/config.json` (instrução do próprio pacote, em `brew info docker-compose`):

```json
{
  "cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]
}
```

No Mac Intel, troque `/opt/homebrew` por `/usr/local`. Depois:

```bash
colima start --cpu 4 --memory 4
docker run --rm hello-world
docker compose version
```

- O Colima monta o seu `$HOME` dentro da VM: clone o repositório dentro do `$HOME`. Para outra pasta: `colima start --mount /outra/pasta:w`.
- Depois de reiniciar o Mac, rode `colima start` de novo (ou `brew services start colima`).

### mise e Node.js

Instalador oficial do mise (https://mise.jdx.dev/installing-mise.html), no seu usuário:

```bash
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate zsh)"' >> ~/.zshrc
exec $SHELL
```

Na raiz do repositório:

```bash
mise trust
mise install        # instala o Node.js fixado no mise.toml
node --version
```

Prefere sem mise? Instale o Node.js LTS (22 ou superior) pelo site oficial: https://nodejs.org/en/download

### Dependências do projeto

```bash
bash scripts/install-deps.sh     # npm ci na raiz, api/, web/ e blackbox/ + prisma generate
git config core.hooksPath .githooks
```

## Conferência

```bash
make check-dependencies
make up
```
