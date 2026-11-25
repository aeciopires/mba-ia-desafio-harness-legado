# Requisitos

<!-- TOC -->
- [Qual é o seu sistema?](#qual-é-o-seu-sistema)
- [Caminho rápido (com o Makefile)](#caminho-rápido-com-o-makefile)
- [O que é preciso](#o-que-é-preciso)
<!-- TOC -->

## Qual é o seu sistema?

O Balcão suporta:

| Sistema | Arquitetura | Instruções |
|---|---|---|
| Ubuntu 22.04, 24.04 e 26.04 | amd64 | [docs/requirements/REQUIREMENTS-ubuntu.md](docs/requirements/REQUIREMENTS-ubuntu.md) |
| macOS | amd64 (Intel) e arm64 (Apple Silicon) | [docs/requirements/REQUIREMENTS-macos.md](docs/requirements/REQUIREMENTS-macos.md) |

Para descobrir, rode na raiz do repositório:

```bash
make check-os        # ou: bash scripts/check-os.sh
```

Ele diz se o sistema é suportado e qual arquivo de instruções seguir. No Windows, use o WSL com Ubuntu.

## Caminho rápido (com o Makefile)

```bash
make check-os              # sistema suportado?
make check-dependencies    # o que falta, com o link oficial de instalação
make install               # mise (no seu usuário), Node.js do mise.toml e dependências npm
make up                    # sobe o Balcão
```

- `make install` não instala nada globalmente nem usa `sudo`: o mise vai para `~/.local/bin` e o Node.js para a pasta do mise.
- Docker e Docker Compose **não** são instalados pelo Makefile nem pelo mise: instale pelo sistema operacional, seguindo o arquivo do seu sistema.

## O que é preciso

| Software | Versão | Para quê |
|---|---|---|
| Git | 2.x | Clonar, worktrees e hook |
| Docker Engine (Ubuntu) ou Colima + Docker CLI (macOS) | Engine 24+ | Containers do Balcão |
| Docker Compose (plugin v2) | 2.20+ | `docker compose` |
| Node.js | 22 ou superior (o projeto fixa a LTS no `mise.toml`) | Gates, hook, testes e scripts |
| mise | recente | Instala o Node.js do projeto sem mexer no sistema (opcional se você já tem o Node 22+) |
| make | qualquer | Atalhos (opcional: todo alvo tem um `bash scripts/<nome>.sh` equivalente) |
| curl | qualquer | Só para instalar o mise |

Sem `make`, use os scripts direto: `bash scripts/check-os.sh`, `bash scripts/check-dependencies.sh`, `bash scripts/install.sh`, `bash scripts/up.sh`.
