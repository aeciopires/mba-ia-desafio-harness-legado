# Makefile do Balcão. Cada alvo só delega para um script em scripts/, que também pode ser
# rodado direto com bash (útil em máquinas sem make). Rode `make` ou `make help` para a lista.
.DEFAULT_GOAL := help
.PHONY: help check-os check-dependencies install build up down status logs gates gates-kit \
	gates-proprias gates-extras tests test-integration test-blackbox test-e2e toc images

help: ## Lista os alvos disponíveis
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check-os: ## Confere se o sistema operacional é suportado (Ubuntu 22.04/24.04/26.04 amd64, macOS amd64/arm64)
	@bash scripts/check-os.sh

check-dependencies: ## Confere git, make, Docker/Colima, Compose, mise e Node, com o link oficial do que faltar
	@bash scripts/check-dependencies.sh

install: ## Instala o mise (no usuário), o Node do mise.toml e as dependências npm do projeto
	@bash scripts/install.sh

build: ## Gera as imagens Docker desta cópia (arquitetura da máquina)
	@bash scripts/build.sh

up: ## Sobe a cópia inteira (banco, migrations, seed, API, worker e front); pode repetir
	@bash scripts/up.sh

down: ## Derruba só o que a subida desta cópia iniciou (mantém banco e anexos)
	@bash scripts/down.sh

status: ## Mostra endereços, banco, pasta de anexos e containers desta cópia
	@bash scripts/status.sh

logs: ## Acompanha os logs dos containers desta cópia (Ctrl+C para sair)
	@bash scripts/logs.sh

gates: ## Roda todos os gates (G1-G13) e lista as violações
	@bash scripts/gates.sh

gates-kit: ## Roda o kit-gates oficial contra os gates (precisa de git status limpo)
	@bash scripts/gates.sh --kit

gates-proprias: ## Aplica os exemplos de violação das regras próprias e confere que os gates falham
	@bash scripts/verificar-violacoes.sh harness/violacoes-proprias

gates-extras: ## Aplica as violações extras (outras formas de G1-G10) e confere que os gates falham
	@bash scripts/verificar-violacoes.sh harness/violacoes-extras

tests: ## Testes unitários da API (sem banco)
	@bash scripts/tests.sh

test-integration: ## Testes de integração da API (banco balcao_test desta cópia; precisa de make up)
	@bash scripts/test-integration.sh

test-blackbox: ## Suíte caixa-preta contra a API desta cópia (precisa de make up)
	@bash scripts/test-blackbox.sh

test-e2e: ## Fluxo do avaliador: clone limpo, duas worktrees, isolamento, gates e hook (demora)
	@bash tests/e2e/fluxo-avaliador.sh

toc: ## Gera/atualiza o sumário (TOC) de todos os .md (idempotente)
	@bash scripts/toc.sh

images: ## Build multi-arquitetura (linux/amd64 e linux/arm64) com docker buildx
	@bash scripts/images.sh
