# Balcão

<!-- TOC -->
- [Como rodar](#como-rodar)
  - [Pré-requisitos](#pré-requisitos)
  - [Comandos](#comandos)
  - [O que a subida informa](#o-que-a-subida-informa)
- [Contas da seed](#contas-da-seed)
- [Gates](#gates)
  - [Exemplos de violação das regras próprias](#exemplos-de-violação-das-regras-próprias)
  - [Hook de pre-commit](#hook-de-pre-commit)
- [Decisões](#decisões)
  - [Como as cópias foram isoladas](#como-as-cópias-foram-isoladas)
  - [Como as violações que já existiam foram corrigidas](#como-as-violações-que-já-existiam-foram-corrigidas)
  - [O que mudou na documentação para agentes](#o-que-mudou-na-documentação-para-agentes)
- [Registro de incidentes](#registro-de-incidentes)
- [Mais documentação](#mais-documentação)
<!-- TOC -->

Central de chamados. Clientes abrem chamados, uma IA faz a triagem (categoria e prioridade) em segundo plano, atendentes assumem, respondem e resolvem, e o admin acompanha as estatísticas.

- `api/`: API em Express + Prisma e o worker de triagem.
- `web/`: front em React + Vite.
- `blackbox/`: testes caixa-preta da API (o contrato).
- `docs/`: documentação detalhada, com diagramas. Comece por [docs/arquitetura.md](docs/arquitetura.md).

Este repositório tem um **harness** para agentes de código: um comando sobe tudo, duas cópias rodam lado a lado, gates barram o desvio e um hook protege os commits. Agentes começam pelo [AGENTS.md](AGENTS.md).

## Como rodar

### Pré-requisitos

- Ubuntu 22.04, 24.04 ou 26.04 (amd64), ou macOS (amd64/arm64) com Colima.
- Git, Docker com o plugin `docker compose` e Node.js 22 ou superior.
- `make` é opcional: todo alvo tem um `bash scripts/<nome>.sh` equivalente.

Passo a passo por sistema, com os links oficiais: [REQUIREMENTS.md](REQUIREMENTS.md). Para conferir e instalar o que falta:

```bash
make check-os
make check-dependencies
make install          # mise (no seu usuário), Node.js do mise.toml e dependências npm
```

### Comandos

| Comando | Sem make | O que faz |
|---|---|---|
| `make up` | `bash scripts/up.sh` | Sobe banco, migrations, seed, API, worker e front desta cópia. Pode repetir sem derrubar. |
| `make down` | `bash scripts/down.sh` | Derruba só o que a subida desta cópia iniciou (mantém banco e anexos). |
| `make gates` | `bash scripts/gates.sh` | Roda os gates G1 a G13 e lista as violações. |
| `make status` | `bash scripts/status.sh` | Mostra endereços e containers. |
| `make tests` | `bash scripts/tests.sh` | Testes unitários. |
| `make test-integration` | `bash scripts/test-integration.sh` | Testes de integração (banco `balcao_test` da cópia). |
| `make test-blackbox` | `bash scripts/test-blackbox.sh` | Suíte caixa-preta contra a API da cópia. |
| `make test-e2e` | `bash tests/e2e/fluxo-avaliador.sh` | Fluxo do avaliador completo com duas cópias. |
| `make help` | | Lista todos os alvos. |

### O que a subida informa

```
Balcão no ar (projeto Docker Compose: balcao-copia-a-1a2b3c4d)
  API:     http://localhost:4000   (saúde: http://localhost:4000/api/health)
  Front:   http://localhost:5173
  Banco:   postgresql://balcao:balcao@localhost:5432/balcao
  Anexos:  /caminho/da/copia-a/.run/uploads
```

As portas são as primeiras livres a partir de 4000 (API), 5173 (front) e 5432 (banco), e ficam gravadas em `.run/ports.env` para as próximas subidas. Abra o front pelo endereço mostrado. A IA roda em modo fake (palavras-chave), sem chave.

## Contas da seed

| Papel | E-mail | Senha |
|---|---|---|
| admin | `admin@balcao.dev` | `Admin@123` |
| atendente | `agente@balcao.dev` | `Agente@123` |
| cliente | `cliente@balcao.dev` | `Cliente@123` |

## Gates

`make gates` roda tudo, sem parar na primeira falha, e termina com uma linha `<ID> <arquivo>` por violação (com o nome da dependência, no caso de dependência sem uso). Detalhes, exemplos e como corrigir: [docs/gates.md](docs/gates.md).

| ID | Regra | Ferramenta |
|---|---|---|
| G1 | Zero erro de tipo em `api/` e `web/` | `tsc --noEmit` |
| G2 | Lint sem erro nem warning (variável/import sem uso, `any` explícito) | ESLint + typescript-eslint |
| G3 | Testes unitários da API passam | Vitest |
| G4 | `api/src/http/` não importa `@prisma/client` nem `repositories/` | dependency-cruiser |
| G5 | `process.env` só em `api/src/config/`; `import.meta.env` só em `web/src/config/` | ESLint |
| G6 | `services/` não importa `express`, `multer` nem `http/` (inclusive só tipo) | dependency-cruiser (`tsPreCompilationDeps`) |
| G7 | `openai` só em `api/src/integrations/` | dependency-cruiser |
| G8 | `web/` não importa nada de `api/` (inclusive só tipo) | dependency-cruiser (`tsPreCompilationDeps`) |
| G9 | Nenhum import circular em `api/src/` e `web/src/` | dependency-cruiser |
| G10 | Nenhum arquivo, export (inclusive tipo) ou dependência sem uso | knip |
| G11 | **Própria:** nenhum endereço fixo (`localhost`, `127.0.0.1`, `/tmp/`) fora de `config/` | ESLint |
| G12 | **Própria:** `@prisma/client` só em `api/src/repositories/` | dependency-cruiser |
| G13 | **Própria:** nenhum comentário de supressão em `api/src/` e `web/src/` | `scripts/gates.mjs` + `noInlineConfig` do ESLint |

### Exemplos de violação das regras próprias

Cada regra própria tem a motivação em [docs/gates.md](docs/gates.md#regras-próprias) e exemplos versionados em `harness/violacoes-proprias/`, no formato do `kit-gates/`. Com `git status` limpo:

```bash
make gates-proprias
# ou só uma regra: bash scripts/verificar-violacoes.sh harness/violacoes-proprias G11
```

O comando planta cada exemplo, roda os gates, confere que eles falham com o ID e o arquivo certos e desfaz tudo. Para aplicar um exemplo à mão, copie o `.modelo` para o caminho dele sem a extensão e rode `make gates`:

```bash
cp harness/violacoes-proprias/G12-prisma-fora-de-repositories/arquivos/api/src/jobs/limpeza-antiga.ts.modelo \
   api/src/jobs/limpeza-antiga.ts
make gates     # falha com: G12 api/src/jobs/limpeza-antiga.ts ...
rm api/src/jobs/limpeza-antiga.ts
```

Também há `make gates-kit` (kit oficial) e `make gates-extras` (29 variações de G1 a G10 escritas de outras formas).

### Hook de pre-commit

`.githooks/pre-commit` roda tipos, lint e supressões (`node scripts/gates.mjs --only=tipos,lint,supressoes`) e bloqueia o commit se falharem. Num clone novo ele fica ativo depois do `make up`, que configura `git config core.hooksPath .githooks`.

## Decisões

### Como as cópias foram isoladas

- **Tudo em containers, um projeto Docker Compose por cópia.** O nome do projeto é `balcao-<pasta>-<hash do caminho>`, então duas worktrees nunca dividem containers, rede nem volume, e `make down` derruba só a cópia certa.
- **Portas livres.** Na primeira subida, o script escolhe as primeiras portas livres a partir de 4000, 5173 e 5432 e grava em `.run/ports.env`; as subidas seguintes reaproveitam.
- **Banco por cópia.** Cada cópia tem o seu Postgres, com volume próprio.
- **Anexos por cópia.** `.run/uploads/` dentro da cópia, montada no container da API; os containers rodam com o UID do usuário para os arquivos serem dele.
- **Worker por cópia.** Um container `worker` em cada projeto, ligado só ao banco da cópia.
- **Front ligado à própria API.** `VITE_API_URL` e `CORS_ORIGIN` são gerados com as portas da cópia; antes, CORS e URL da API eram fixos no código.
- **Seed idempotente.** `upsert` nas contas e chamados de exemplo criados só se não existirem: `make up` pode rodar quantas vezes for preciso.
- **Imagens multi-arquitetura.** Base oficial `node:<versão>-bookworm-slim` (amd64 e arm64), com o client do Prisma gerado dentro da imagem; `make images` compila para as duas plataformas.

Detalhes e diagramas: [docs/ambiente.md](docs/ambiente.md).

### Como as violações que já existiam foram corrigidas

As regras foram escritas primeiro; o código foi corrigido guiado pela saída dos gates (90 violações na primeira rodada), sem esconder nada e sem mudar a API (a suíte caixa-preta passou igual antes e depois):

- **G5/G11:** toda leitura de ambiente foi para `api/src/config/env.ts` (com os mesmos padrões de antes) e `web/src/config/env.ts`; CORS, porta, pasta de anexos, segredo do JWT e modo da IA vêm de lá.
- **G4:** as rotas deixaram de importar repositórios e o Prisma. Health, stats, `/me` e sugestão de resposta ganharam serviços (`HealthService`, `StatsService`, `AuthService.me`, `SuggestionService`); a composição ficou em `api/src/container.ts`, e as rotas recebem os serviços prontos.
- **G6:** os serviços lançam `AppError` (`api/src/domain/errors.ts`), traduzido para HTTP em `http/errors.ts`; o upload recebe um `UploadedFile` simples em vez do `Request` do Express.
- **G7:** a sugestão de resposta saiu da rota e passou a usar `createAiClient` de `integrations/` (no modo fake, o texto é o mesmo de antes).
- **G8:** o front ganhou os próprios tipos em `web/src/types/`.
- **G9:** `formatTicketRef` foi para `domain/`, quebrando o ciclo entre `ticket-service` e `notification-service`.
- **G10:** saíram `lodash`, `axios`, `api/src/utils/legacy-sla.ts`, `calculateSlaDeadline`, `formatCurrency` e exports sem uso.
- **G12:** o worker usa `TriageService` e os repositórios, em vez de um `PrismaClient` próprio.
- **G2:** os `any` viraram tipos de domínio (`Ticket`, `Reply`, `TicketDetails`...) ou `unknown` com verificação.
- Cada serviço novo tem teste unitário ao lado.

### O que mudou na documentação para agentes

- O `CLAUDE.md` antigo mentia (mandava rodar `npm run migrate`, que não existe; citava `api/tests/`, `web/src/store/` e axios no front; mandava usar `any` e `kill -9`). Ele saiu de cena: agora aponta para o `AGENTS.md` e só guarda as regras de manutenção do repositório.
- O [AGENTS.md](AGENTS.md) é um índice de até 60 linhas: comandos, contas, regras de camada, regras de trabalho e onde está o detalhe. Todo comando e caminho citado nele existe (`bash scripts/check-docs.sh` confere).
- O detalhe foi para `docs/`, com diagramas Mermaid e analogias para iniciantes.
- Erros dos agentes viraram regras (ex.: nunca matar processo por porta ou padrão) e estão no registro de incidentes.

## Registro de incidentes

[docs/incidentes.md](docs/incidentes.md): erros reais dos agentes durante a construção do harness e a mudança no harness que impede cada um de se repetir.

## Mais documentação

- [docs/arquitetura.md](docs/arquitetura.md): camadas, entidades, ciclo do chamado e fluxo de uma requisição.
- [docs/ambiente.md](docs/ambiente.md): subida, isolamento, variáveis, imagens, Colima e problemas comuns.
- [docs/gates.md](docs/gates.md): regras, ferramentas, regras próprias e hook.
- [docs/testes.md](docs/testes.md): unitários, integração, caixa-preta e e2e.
- [docs/fluxo-de-trabalho.md](docs/fluxo-de-trabalho.md): worktrees, commits e incidentes.
- [CONTRIBUTING.md](CONTRIBUTING.md) e [REQUIREMENTS.md](REQUIREMENTS.md).
