# Requisitos: Ubuntu 22.04, 24.04 e 26.04 (amd64)

<!-- TOC -->
- [Com o Makefile](#com-o-makefile)
- [Instalação manual](#instalação-manual)
  - [Git, make e curl](#git-make-e-curl)
  - [Docker Engine e Docker Compose](#docker-engine-e-docker-compose)
  - [mise e Node.js](#mise-e-nodejs)
  - [Dependências do projeto](#dependências-do-projeto)
- [Conferência](#conferência)
<!-- TOC -->

## Com o Makefile

```bash
sudo apt-get update && sudo apt-get install -y git make curl   # se ainda não tiver
make check-os
make check-dependencies
make install        # mise em ~/.local/bin, Node.js do mise.toml e dependências npm (sem sudo)
make up
```

`make check-dependencies` mostra o link oficial de tudo o que faltar. O Docker é instalado à parte, como abaixo.

## Instalação manual

### Git, make e curl

Pacotes oficiais do Ubuntu (https://packages.ubuntu.com/):

```bash
sudo apt-get update
sudo apt-get install -y git make curl ca-certificates
```

### Docker Engine e Docker Compose

Siga a documentação oficial: https://docs.docker.com/engine/install/ubuntu/ (seção "Install using the apt repository"). Em resumo:

```bash
# remove pacotes conflitantes, se existirem
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove -y $pkg; done

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Para usar o Docker sem `sudo` (pós-instalação oficial: https://docs.docker.com/engine/install/linux-postinstall/):

```bash
sudo groupadd docker 2>/dev/null; sudo usermod -aG docker "$USER"
newgrp docker      # ou saia e entre de novo na sessão
docker run --rm hello-world
```

Se a sua versão do Ubuntu ainda não aparecer no repositório do Docker, confira a lista de versões suportadas na mesma página oficial.

### mise e Node.js

Instalador oficial do mise (https://mise.jdx.dev/installing-mise.html), no seu usuário:

```bash
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc   # zsh: troque bash por zsh e ~/.bashrc por ~/.zshrc
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
