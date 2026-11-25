# CLAUDE.md

<!-- TOC -->
- [Porta de entrada](#porta-de-entrada)
- [Manutenção da documentação](#manutenção-da-documentação)
  - [Coerência com o TASK.md e com o código](#coerência-com-o-taskmd-e-com-o-código)
  - [Sumário (TOC) em todo arquivo .md](#sumário-toc-em-todo-arquivo-md)
  - [Diagramas e analogias](#diagramas-e-analogias)
- [Atualização de dependências de software (só quando pedida)](#atualização-de-dependências-de-software-só-quando-pedida)
- [Guardrails do harness](#guardrails-do-harness)
<!-- TOC -->

## Porta de entrada

Leia e siga o [AGENTS.md](AGENTS.md): comandos, contas da seed, regras de camada e onde está o detalhe. Ele vale para qualquer agente; este arquivo só acrescenta as regras de manutenção do repositório.

@AGENTS.md

## Manutenção da documentação

### Coerência com o TASK.md e com o código

- O [TASK.md](TASK.md) é a especificação. `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `REQUIREMENTS.md`, `docs/` e `PLAN.md` precisam continuar coerentes com ele e com o código.
- Toda mudança em comando, script, alvo do `Makefile`, porta, variável de ambiente, regra de gate ou pasta atualiza, no mesmo commit, os documentos que a citam.
- Todo comando e todo caminho citados no `AGENTS.md` existem e funcionam. Confira com `bash scripts/check-docs.sh`.
- O `AGENTS.md` tem no máximo 60 linhas e é um índice: detalhe novo vai para `docs/`, com um link no `AGENTS.md` se for importante.
- Documentação em português do Brasil.

### Sumário (TOC) em todo arquivo .md

- Todo arquivo `.md` começa com um sumário logo depois do título `#`, entre DUAS tags iguais `<!-- TOC -->` (abertura e fechamento). Não use `<!-- /TOC -->`: conflita com os plugins de Markdown que geram TOC.
- Não edite o sumário à mão: rode `make toc` (ou `bash scripts/toc.sh`) depois de criar ou mudar títulos. O script é idempotente e só troca o que está entre as tags.
- `bash scripts/toc.sh --check` falha se algum sumário estiver desatualizado; o `scripts/check-docs.sh` também confere.

### Diagramas e analogias

- A documentação em `docs/` é escrita para iniciantes: cada conceito importante tem um diagrama Mermaid e uma analogia do dia a dia (ex.: camadas da API como um restaurante; cada worktree como um apartamento com cozinha própria; o worker como a triagem de um pronto-socorro).
- Ao mudar arquitetura, fluxo da API, fluxo dos agentes, testes, entidades ou scripts de ambiente, atualize os diagramas e as analogias afetados em `docs/arquitetura.md`, `docs/ambiente.md`, `docs/testes.md`, `docs/gates.md` e `docs/fluxo-de-trabalho.md`.
- Diagrama novo usa blocos ```` ```mermaid ```` e precisa renderizar no GitHub (sem diretivas experimentais).

## Atualização de dependências de software (só quando pedida)

Só atualize versões quando alguém pedir **explicitamente**. Nesse caso:

1. Consulte a fonte oficial de cada item (nada de blog ou espelho):
   - Node.js LTS: https://nodejs.org/en/about/previous-releases (atualize `mise.toml` e o `ARG NODE_VERSION` de `api/Dockerfile` e `web/Dockerfile`).
   - mise: https://mise.jdx.dev/installing-mise.html
   - Imagens: https://hub.docker.com/_/node e https://hub.docker.com/_/postgres (`docker-compose.yml`).
   - Docker Engine (Ubuntu): https://docs.docker.com/engine/install/ubuntu/ ; Colima (macOS): https://github.com/abiosoft/colima
   - Pacotes npm: `npm view <pacote> version` e o changelog oficial de cada um.
2. Atualize os pacotes npm com o lockfile (`npm install <pacote>@<versão>` só na pasta certa) e confira o diff do `package-lock.json`.
3. Rode tudo: `make gates`, `make tests`, `make up`, `make test-blackbox`, `make test-integration`, `make gates-kit`, `make gates-extras`, `make gates-proprias` e `make test-e2e`.
4. Atualize `REQUIREMENTS.md`, `docs/requirements/REQUIREMENTS-ubuntu.md`, `docs/requirements/REQUIREMENTS-macos.md` (versões mínimas, comandos e links oficiais) e a matriz de sistemas suportados em `scripts/check-os.sh` e em `docs/ambiente.md`.
5. Um commit por atualização, com as versões antigas e novas na mensagem.

## Guardrails do harness

- Nunca esconda violação: nada de comentário de supressão, `exclude`/`ignore` em configuração de ferramenta nem arquivo fora das verificações. A única exceção é a que define a regra (ex.: `config/` na G5 e na G11).
- Mexeu em `eslint.config.mjs`, `.dependency-cruiser.cjs`, `knip.json` ou `scripts/gates.mjs`? Rode `make gates-kit`, `make gates-extras` e `make gates-proprias`. Uma opção errada desliga uma regra sem aviso (ver `docs/incidentes.md`).
- Erro de agente que o harness não pegou vira entrada em `docs/incidentes.md` com o hash do commit que muda o harness.
- Depois de trocar este arquivo ou o `AGENTS.md`, abra uma sessão nova: a sessão aberta continua com a versão antiga.
