# AGENTS.md

Balcão: central de chamados (API Express + Prisma, worker de triagem por IA, front React + Vite). Este arquivo é o índice; o detalhe está em `docs/`. Responda em português.

<!-- TOC -->
- [Comandos](#comandos)
- [Contas da seed](#contas-da-seed)
- [Regras de camada (barradas pelos gates)](#regras-de-camada-barradas-pelos-gates)
- [Regras de trabalho](#regras-de-trabalho)
- [Onde está o detalhe](#onde-está-o-detalhe)
<!-- TOC -->

## Comandos

- `make up`: sobe esta cópia (banco, migrations, seed, API, worker e front). Pode repetir sem `make down`. No fim mostra API, front, banco e pasta de anexos.
- `make down`: derruba só esta cópia. `make status` mostra os endereços; `make logs` mostra os logs.
- `make gates`: roda G1 a G13 e termina com uma linha `G<n> <arquivo>` por violação. Tem que passar antes do commit; o hook `.githooks/pre-commit` já roda tipos e lint.
- `make tests` (unitários), `make test-integration` e `make test-blackbox` (precisam de `make up`) e `make test-e2e` (fluxo do avaliador completo).
- Sem `make`: `bash scripts/<nome>.sh`, ex.: `bash scripts/up.sh`, `bash scripts/down.sh`, `bash scripts/gates.sh`.

## Contas da seed

| Papel | E-mail | Senha |
|---|---|---|
| admin | `admin@balcao.dev` | `Admin@123` |
| atendente | `agente@balcao.dev` | `Agente@123` |
| cliente | `cliente@balcao.dev` | `Cliente@123` |

## Regras de camada (barradas pelos gates)

- `api/src/http/` só chama serviços: nada de `@prisma/client` nem `api/src/repositories/` (G4). Os serviços chegam prontos de `api/src/container.ts`.
- `api/src/services/` não conhece `express`, `multer` nem `api/src/http/`, nem com `import type` (G6). Erro de regra de negócio: `AppError` de `api/src/domain/errors.ts`.
- `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/` (G5). Endereço fixo (`localhost`, `127.0.0.1`, `/tmp/`) também só nessas pastas de configuração (G11).
- `openai` só em `api/src/integrations/` (G7). `@prisma/client` só em `api/src/repositories/` (G12).
- `web/` não importa nada de `api/` (G8); os tipos do front ficam em `web/src/types/`.
- Sem erro de tipo (G1), sem `any` e sem variável ou import sem uso (G2), testes passando (G3), sem ciclo (G9), sem arquivo, export ou dependência sem uso (G10).
- Sem supressão (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`) e sem tirar arquivo das verificações (G13). Corrija a causa.
- Serviço novo em `api/src/services/` ganha um `*.test.ts` ao lado.

## Regras de trabalho

- Nunca mate processo por porta ou por padrão (`kill -9`, `pkill -f`): a porta pode ser de outra cópia, e o padrão pode casar com o seu próprio shell. Use `make down`.
- Não fixe porta, banco nem pasta: cada cópia tem os seus (veja `make status`).
- Contrato da API: rotas, corpos, status e códigos de erro não mudam. `blackbox/` e `kit-gates/` não se editam.
- Pastas e entradas fixas não se movem: config, domain, http, services, repositories e integrations em `api/src/`, `api/src/main.ts`, `api/src/jobs/triage-worker.ts` e `web/src/main.tsx`.
- Dependências: `make install` (usa `npm ci`). Biblioteca nova só com pedido explícito.
- Mudou configuração de gate? Rode `make gates-kit`, `make gates-extras` e `make gates-proprias` (precisam de `git status` limpo).
- Errou e o harness deixou passar? Registre em `docs/incidentes.md` e mude o harness (gate, hook, script ou doc).

## Onde está o detalhe

- `docs/arquitetura.md`: camadas, entidades e fluxos, com diagramas.
- `docs/ambiente.md`: subida, isolamento entre cópias, portas e problemas comuns.
- `docs/gates.md`: cada regra, ferramenta, exemplos e como corrigir.
- `docs/testes.md`: unitários, integração, caixa-preta e e2e.
- `docs/fluxo-de-trabalho.md`: worktrees, hook, commits e incidentes.
- `CONTRIBUTING.md`, `REQUIREMENTS.md`, `docs/incidentes.md`.
