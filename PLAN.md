# Plano de implementação: harness do Balcão

<!-- TOC -->
- [1. Objetivo e escopo](#1-objetivo-e-escopo)
- [2. Diagnóstico do estado atual](#2-diagnóstico-do-estado-atual)
- [3. Decisões de arquitetura do harness](#3-decisões-de-arquitetura-do-harness)
  - [3.1 Comando de entrada](#31-comando-de-entrada)
  - [3.2 Onde cada processo roda](#32-onde-cada-processo-roda)
  - [3.3 Isolamento entre cópias](#33-isolamento-entre-cópias)
  - [3.4 Ferramentas dos gates](#34-ferramentas-dos-gates)
  - [3.5 Sistemas operacionais suportados](#35-sistemas-operacionais-suportados)
- [4. Fases de implementação](#4-fases-de-implementação)
  - [Fase 0: preparação](#fase-0-preparação)
  - [Fase 1: ferramentas, mise e Makefile](#fase-1-ferramentas-mise-e-makefile)
  - [Fase 2: ambiente isolado por cópia](#fase-2-ambiente-isolado-por-cópia)
  - [Fase 3: imagens Docker multi-arquitetura](#fase-3-imagens-docker-multi-arquitetura)
  - [Fase 4: gates G1 a G10](#fase-4-gates-g1-a-g10)
  - [Fase 5: regras próprias](#fase-5-regras-próprias)
  - [Fase 6: correção do código guiada pelos gates](#fase-6-correção-do-código-guiada-pelos-gates)
  - [Fase 7: hook de pre-commit](#fase-7-hook-de-pre-commit)
  - [Fase 8: testes de integração e do fluxo do avaliador](#fase-8-testes-de-integração-e-do-fluxo-do-avaliador)
  - [Fase 9: documentação](#fase-9-documentação)
  - [Fase 10: registro de incidentes](#fase-10-registro-de-incidentes)
  - [Fase 11: revisão final e validação completa](#fase-11-revisão-final-e-validação-completa)
- [5. Arquivos a criar ou alterar](#5-arquivos-a-criar-ou-alterar)
- [6. Riscos e mitigação](#6-riscos-e-mitigação)
- [7. Checklist dos critérios de aceite](#7-checklist-dos-critérios-de-aceite)
<!-- TOC -->

## 1. Objetivo e escopo

Instalar o harness do Balcão, conforme o [TASK.md](TASK.md), sem mudar o comportamento da API:

- um comando que sobe tudo a partir de um clone limpo (`make up`) e outro que derruba (`make down`);
- duas worktrees rodando ao mesmo tempo, cada uma com as suas portas, o seu banco, a sua pasta de anexos e o seu worker;
- um comando de gates (`make gates`) cobrindo G1 a G10 e pelo menos duas regras próprias;
- um hook de pre-commit ativado pela subida;
- `AGENTS.md` (60 linhas no máximo), `CLAUDE.md` apontando para ele, README reescrito e documentação em `docs/` (pt-BR);
- registro de incidentes com pelo menos três entradas e o hash de cada commit;
- pedidos adicionais: Makefile completo, mise, imagens Docker multi-arquitetura, checagem do sistema operacional, `CONTRIBUTING.md`, `REQUIREMENTS*.md`, TOC idempotente, diagramas Mermaid com analogias e testes de integração do fluxo do avaliador.

Fora de escopo, conforme o TASK.md: features novas, CI/deploy, troca de stack, IA real.

## 2. Diagnóstico do estado atual

Levantamento feito antes do plano, sem mudar nada:

| Problema | Onde | Regra afetada |
|---|---|---|
| `process.env` fora de `config/` | `main.ts`, `jobs/triage-worker.ts`, `services/attachment-service.ts`, `http/middlewares/auth.ts`, `http/routes/tickets.ts`, `integrations/ai-client.ts` | G5 |
| `import.meta.env` fora de `web/src/config/` | `web/src/api/client.ts`, `web/src/api/tickets.ts`, `web/src/pages/TicketDetailPage.tsx` | G5 |
| Rotas importam repositórios ou o Prisma | `http/routes/auth.ts`, `attachments.ts`, `tickets.ts`, `health.ts`, `stats.ts` | G4 |
| Serviços importam Express ou `http/` | `services/ticket-service.ts` (`HttpError`), `services/attachment-service.ts` (`Request`, `HttpError`), `ticket-service.test.ts` | G6 |
| `openai` importado numa rota | `http/routes/tickets.ts` | G7 |
| Front importa tipos da API | `web/src/api/tickets.ts`, `web/src/pages/TicketDetailPage.tsx` | G8 |
| Cerca de 31 `any` explícitos | `api/src`, `web/src` | G2 |
| Dependências sem uso | `lodash` (api), `axios` (web) | G10 |
| Arquivo sem uso | `api/src/utils/legacy-sla.ts` | G10 |
| Worker cria o próprio `PrismaClient` | `jobs/triage-worker.ts` | regra própria |
| Endereços fixos | CORS `http://localhost:5173` em `http/app.ts`, `localhost:4000` no front, `5173` fixo no `vite.config.ts`, `5432:5432` e volume único no `docker-compose.yml`, `/tmp/balcao/uploads` no serviço de anexos | isolamento |
| Seed com `create` | `api/prisma/seed.ts` quebra na segunda subida (unique constraint) | idempotência |
| `env.ts` só valida `DATABASE_URL` e `NODE_ENV` | `api/src/config/env.ts` | G5 |
| O `CLAUDE.md` mente | cita `npm run migrate` (não existe), `api/tests/`, `web/src/store/`, `app.ts` na raiz, axios no front (usa `fetch`), porta 3000, `kill -9` como solução, teste de serviço com sufixo dentro de `src/` e fora ao mesmo tempo | documentação |

## 3. Decisões de arquitetura do harness

### 3.1 Comando de entrada

- O avaliador tem apenas Linux ou macOS, Docker, Git e Node.js LTS. O `make` não é garantido no Ubuntu mínimo e o mise não está instalado.
- Por isso, a lógica fica em scripts Bash em `scripts/` e o `Makefile` só delega para eles. Os dois caminhos funcionam: `make up` e `bash scripts/up.sh`.
- Os scripts usam o Node do mise quando ele existe, e o Node do sistema (LTS, 22 ou superior) quando não existe. `make up` nunca exige o mise.

### 3.2 Onde cada processo roda

Decisão: **tudo em containers via Docker Compose**, com um projeto Compose por cópia.

- Serviços: `db` (Postgres 16), `migrate` (job único: migrations e seed), `api`, `worker` e `web` (Vite dev server).
- Nome do projeto: `balcao-<slug da pasta>-<hash curto do caminho absoluto>`. Duas worktrees nunca colidem, e `docker compose -p <projeto> down` derruba só a cópia certa.
- O worker continua sendo um processo separado da API (container próprio, mesma imagem, outro comando).
- O `node_modules` do host continua existindo (instalado com `npm ci`), porque os gates e o hook rodam no host.
- Alternativa descartada: processos no host com arquivos de PID. É mais frágil para derrubar e depende da versão de Node do host.

### 3.3 Isolamento entre cópias

| Recurso | Como é isolado |
|---|---|
| Portas | `scripts/lib/ports.sh` escolhe portas livres (API a partir de 4000, front a partir de 5173, Postgres a partir de 5432) e grava em `.run/ports.env`. A segunda subida reaproveita as portas gravadas. |
| Banco | Um Postgres por cópia, volume nomeado pelo projeto Compose. |
| Anexos | Pasta `.run/uploads/` dentro da cópia, montada no container da API. O caminho absoluto é informado na saída. |
| Worker | Um container `worker` por projeto Compose, ligado ao banco da cópia. |
| Front → API | `VITE_API_URL` gerado com a porta da API da cópia. A CORS da API usa `CORS_ORIGIN` com a porta do front da cópia. |
| Configuração | `api/.env` e `web/.env` gerados pela subida a partir de `.env.example`, só se não existirem. `.run/` vai para o `.gitignore`. |

### 3.4 Ferramentas dos gates

| Regra | Ferramenta |
|---|---|
| G1 | `tsc --noEmit` em `api/` e `web/` (com um `tsconfig` que inclua `vite.config.ts` no web) |
| G2 | ESLint (flat config) + `typescript-eslint`, `--max-warnings 0`, com `no-unused-vars` e `no-explicit-any` como erro |
| G3 | Vitest (`api/src/**/*.test.ts`) |
| G4, G6, G7, G8, G9 | dependency-cruiser, com `tsPreCompilationDeps: true` para enxergar imports só de tipo (G6 e G8) |
| G5 | ESLint `no-restricted-properties` / `no-restricted-syntax` (`process.env`, `process['env']`, desestruturação de `process`, `import.meta.env`), liberado só em `api/src/config/` e `web/src/config/` |
| G10 | knip (arquivos, exports, tipos exportados e dependências sem uso), com workspaces `api` e `web` |
| Regras próprias | ESLint ou script dedicado (ver Fase 5) |

O orquestrador `scripts/gates.mjs` (Node, sem dependências extras):

- roda todas as ferramentas, sem parar na primeira falha;
- lê a saída em JSON de cada uma e converte para uma linha por violação: `G4 api/src/http/routes/stats.ts` (G10 de dependência traz o nome: `G10 api/package.json lodash`);
- imprime o resumo no fim e sai com código 1 se houver qualquer violação;
- aceita `--only tipo,lint` para o hook.

Bibliotecas novas (ESLint, typescript-eslint, dependency-cruiser, knip) são dependências de desenvolvimento, permitidas pelo TASK.md. Elas ficam num `package.json` da raiz, com `package-lock.json` (`npm ci` na raiz), para não sujar `api/` e `web/` nem acionar a G10.

Por que não instalar essas ferramentas pelo mise (backend `npm:`):

- O avaliador não tem mise; os gates precisam rodar só com Node e `npm ci`.
- ESLint (flat config), knip e dependency-cruiser carregam plugins e o `typescript` pela resolução de módulos do Node, a partir do projeto. Instaladas fora do `node_modules` do projeto, não encontram `typescript-eslint` nem o `typescript`.
- O lockfile fixa as versões de forma reproduzível, inclusive das dependências transitivas.

O mise fica responsável só pelo runtime (Node LTS) e por CLIs que não precisam ser importadas pelo projeto.

### 3.5 Sistemas operacionais suportados

| Sistema | Arquitetura | Docker |
|---|---|---|
| Ubuntu 22.04, 24.04, 26.04 | amd64 | Docker Engine + plugin Compose (instalação oficial: https://docs.docker.com/engine/install/ubuntu/) |
| macOS | amd64 e arm64 | Colima + Docker CLI + docker-compose (https://github.com/abiosoft/colima), sem Docker Desktop |

- `make check-os` lê `/etc/os-release` e `uname -m` (Linux) ou `sw_vers` e `uname -m` (macOS).
- Em `make check-os` e `make check-dependencies`, sistema fora da lista **falha**. Em `make up`, só **avisa**, para não travar o avaliador em outra distribuição Linux.

## 4. Fases de implementação

Cada fase termina com um commit (um commit por tarefa). As fases 4 e 5 vêm antes da 6 de propósito: as regras são escritas primeiro e o código é corrigido guiado pela saída dos gates.

### Fase 0: preparação

1. Subir o Balcão uma vez pelo README atual, para sentir o problema e registrar o comportamento de base.
2. Rodar a suíte `blackbox/` contra essa subida e guardar o resultado como referência.
3. Criar a branch de trabalho e o `docs/incidentes.md` vazio, para registrar os erros dos agentes desde o início.

### Fase 1: ferramentas, mise e Makefile

1. `mise.toml` na raiz com a versão do Node LTS (fixada) e das ferramentas de CLI necessárias. Docker e Compose **não** ficam no mise.
2. `make install`: instala o mise só no diretório do usuário (instalador oficial, https://mise.jdx.dev/installing-mise.html), roda `mise install` e `npm ci` na raiz, em `api/`, em `web/` e em `blackbox/`. Nada é instalado globalmente com `sudo`.
3. `npm ci` em vez de `npm install`, para respeitar os `package-lock.json` (dica do TASK.md).
4. `Makefile` com os alvos abaixo e um `make help` como padrão:

| Alvo | Função |
|---|---|
| `make help` | Lista os alvos |
| `make check-os` | Confere o sistema operacional suportado |
| `make check-dependencies` | Confere Git, Docker, Compose, Node e mise, e mostra a URL oficial de instalação do que faltar |
| `make install` | Instala o mise (no usuário) e as dependências do projeto |
| `make build` | Gera as imagens Docker da cópia |
| `make up` | Sobe a cópia inteira (idempotente) |
| `make down` | Derruba só o que a subida desta cópia iniciou |
| `make status` | Mostra endereços, banco, pasta de anexos e estado dos containers |
| `make logs` | Mostra os logs dos serviços da cópia |
| `make gates` | Roda G1 a G10 e as regras próprias |
| `make tests` | Testes unitários |
| `make test-integration` | Testes de integração da API (banco `balcao_test` da cópia) |
| `make test-blackbox` | Suíte caixa-preta contra a API da cópia |
| `make test-e2e` | Fluxo do avaliador com duas cópias (Fase 8) |
| `make toc` | Gera ou atualiza o TOC dos `.md` (idempotente) |
| `make images` | Build multi-arquitetura com `docker buildx` (amd64 e arm64) |

### Fase 2: ambiente isolado por cópia

1. `scripts/up.sh`:
   - checa o sistema (aviso) e as dependências mínimas (Git, Docker, Compose, Node);
   - roda `npm ci` quando o `node_modules` não existe ou o lockfile mudou;
   - ativa o hook (`git config core.hooksPath .githooks`);
   - escolhe ou reaproveita as portas (`.run/ports.env`), gera os `.env`;
   - roda `docker compose -p <projeto> up -d --build --wait`;
   - espera `GET /api/health` responder;
   - imprime: URL da API, URL do front, banco (`postgresql://...:<porta>/balcao`), caminho absoluto da pasta de anexos e o nome do projeto Compose.
2. `scripts/down.sh`: `docker compose -p <projeto> down` (sem `-v`: o volume do banco da cópia é mantido). Não mexe em nenhum outro projeto.
3. `docker-compose.yml` parametrizado: portas por variável, sem `container_name` fixo, volume nomeado pelo projeto, `healthcheck` no Postgres, `depends_on` com `condition`.
4. Seed idempotente: `upsert` nas três contas e criação dos chamados de exemplo só se ainda não existirem (chave natural: título + cliente). As senhas e os e-mails continuam iguais.
5. `api/src/config/env.ts` passa a validar todas as variáveis (`PORT`, `JWT_SECRET`, `AI_MODE` com padrão `fake`, `OPENAI_API_KEY` opcional, `UPLOAD_DIR`, `TRIAGE_INTERVAL_MS`, `CORS_ORIGIN`) com os mesmos padrões de hoje.
6. `web/src/config/` passa a ser o único lugar que lê `import.meta.env`. `vite.config.ts` lê a porta do ambiente.
7. Validar: subir duas vezes seguidas; criar a `copia-b` com `git worktree add`; subir as duas; derrubar uma e conferir que a outra responde.

### Fase 3: imagens Docker multi-arquitetura

1. `api/Dockerfile` (API, worker e job de migrate/seed) e `web/Dockerfile` (Vite dev), com base `node:22-bookworm-slim` (imagem oficial, multi-arquitetura).
2. Prisma: `binaryTargets = ["native", "debian-openssl-3.0.x", "linux-arm64-openssl-3.0.x"]` no `schema.prisma`, sem nova migration (só muda o gerador).
3. `make build`: build local para a arquitetura da máquina (`docker compose build`).
4. `make images`: `docker buildx build --platform linux/amd64,linux/arm64`, para validar as duas arquiteturas.
5. Matriz de compatibilidade documentada em `docs/`: Ubuntu 22.04/24.04/26.04 amd64 rodam `linux/amd64`; macOS Intel roda `linux/amd64` e macOS Apple Silicon roda `linux/arm64` dentro da VM do Colima.
6. No macOS, documentar `colima start --cpu 4 --memory 4` e o bind mount de `.run/uploads` (o Colima monta o `$HOME` por padrão; clones fora do `$HOME` precisam de `--mount`).

### Fase 4: gates G1 a G10

1. `package.json` da raiz com as ferramentas de desenvolvimento e os scripts `gates`, `lint` e `typecheck`.
2. `eslint.config.mjs` (G2 e G5), `.dependency-cruiser.cjs` (G4, G6, G7, G8, G9), `knip.json` (G10) e `scripts/gates.mjs` (orquestrador).
3. Nenhum `exclude`, `ignore` ou supressão que tire arquivos de `api/src/` ou `web/src/` da verificação, salvo `config/` na G5.
4. Rodar `bash kit-gates/verificar.sh . "make gates"` só para conferir o formato. A linha de base vai falhar até a Fase 6.
5. Testar formas alternativas de cada violação, além das do kit: `import type`, `export type { } from`, `require()`, `import()` dinâmico, caminhos com `../`, `process['env']`, `const { env } = process`, reexport circular, dependência só em `devDependencies` etc.

### Fase 5: regras próprias

Proposta (cada uma com motivação documentada e exemplo versionado em `harness/violacoes-proprias/`, no formato do `kit-gates/`):

| ID | Regra | Motivação | Ferramenta |
|---|---|---|---|
| G11 | Nada de endereço fixo (`localhost:<porta>`, `127.0.0.1`, `/tmp/`) em `api/src/` e `web/src/` fora de `config/` | Endereço fixo quebrou as duas worktrees: CORS, URL da API e pasta de anexos | ESLint `no-restricted-syntax` em literais e template strings |
| G12 | `new PrismaClient` só em `api/src/repositories/prisma.ts` | O worker criava um cliente próprio lendo `process.env` e ignorava a configuração central | dependency-cruiser ou ESLint `no-restricted-syntax` |
| G13 (opcional) | Nenhum comentário de supressão (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`) em `api/src/` e `web/src/` | Supressão esconde violação, e o avaliador procura por elas | ESLint `eslint-comments/no-use` ou script |

O README explica como aplicar cada exemplo: `bash kit-gates/verificar.sh . "make gates"` apontando para a pasta das violações próprias, ou `git apply harness/violacoes-proprias/<regra>.patch && make gates`.

### Fase 6: correção do código guiada pelos gates

Ordem sugerida, rodando `make gates` e `make test-blackbox` a cada passo:

1. **G5**: centralizar a configuração em `api/src/config/env.ts` e `web/src/config/env.ts`.
2. **G7**: tirar o `openai` de `http/routes/tickets.ts` e mover a sugestão para `integrations/ai-client.ts`, chamada por um serviço.
3. **G6**: criar erros de domínio em `api/src/domain/` (ex.: `AppError` com `status`, `error` e `message`), usados pelos serviços. O `http/errors.ts` traduz o erro de domínio para a mesma resposta HTTP de hoje. O serviço de anexos recebe dados simples (nome, tipo, caminho, tamanho), não o `Request`.
4. **G4**: mover para serviços a lógica que as rotas fazem com repositórios e Prisma (`auth`, `tickets`, `attachments`, `health`, `stats`). Criar `health-service` e `stats-service`, com repositórios correspondentes.
5. **G12**: o worker passa a usar o `prisma` de `repositories/` e um serviço de triagem.
6. **G8**: criar `web/src/types/ticket.ts` com os tipos que o front usa (cópia dos literais da API).
7. **G2**: trocar os `any` por tipos reais, remover variáveis e imports sem uso.
8. **G10**: remover `lodash`, `axios`, `api/src/utils/legacy-sla.ts` e exports sem uso.
9. **G9**: quebrar ciclos, se houver.
10. **G1 e G3**: zerar erros de tipo e ajustar os testes unitários (os que importam `HttpError` passam a usar o erro de domínio).
11. Todo serviço novo ganha um `*.test.ts` ao lado.

Contrato: nenhuma rota, corpo, status ou código de erro muda. A suíte caixa-preta tem que passar igual à Fase 0.

### Fase 7: hook de pre-commit

1. `.githooks/pre-commit` (Bash, versionado) que roda `node scripts/gates.mjs --only G1,G2` (tipo e lint), mais G5 a G8 se o tempo ficar aceitável.
2. Ativação em `scripts/up.sh` e `make install`: `git config core.hooksPath .githooks`. Vale para todas as worktrees do clone.
3. Sem Husky ou lefthook, para não depender de biblioteca nova.
4. Testar com os dois comandos do passo 7 do fluxo do avaliador.

### Fase 8: testes de integração e do fluxo do avaliador

1. **Integração da API** (`api/test/integration/`, banco `balcao_test` da cópia, criado e migrado por `make test-integration`):
   - login das três contas da seed;
   - criar chamado e conferir a triagem do worker (`Fatura em dobro, urgente` → Financeiro / Urgente);
   - anexar `.txt` e conferir o arquivo na pasta de anexos da cópia;
   - estatísticas, permissões por papel e o caso `[falha-ia]`.
2. **Fluxo do avaliador** (`tests/e2e/fluxo-avaliador.sh`, chamado por `make test-e2e`):
   - clone limpo numa pasta temporária, `make up` duas vezes;
   - `git worktree add` da `copia-b` e `make up` nela;
   - portas, banco e pasta de anexos diferentes;
   - chamado criado na `copia-a` não aparece na `copia-b`, e cada uma faz a triagem do seu;
   - anexo aparece só na pasta da `copia-a`;
   - `blackbox` contra as duas cópias;
   - `make gates`, `kit-gates`, exemplos das regras próprias e teste do hook;
   - busca de supressões;
   - `make down` na `copia-b` com a `copia-a` respondendo em `/api/health`, nova subida da `copia-b` e derrubada das duas;
   - `wc -l AGENTS.md` ≤ 60 e verificação de caminhos e comandos do `AGENTS.md`.

### Fase 9: documentação

Toda a documentação é em pt-BR, com TOC no início de cada `.md`.

1. **`AGENTS.md`** (≤ 60 linhas, índice): subir, derrubar, gates, contas da seed, regras de camada e links para `docs/`.
2. **`CLAUDE.md`**: aponta para o `AGENTS.md` e guarda as instruções de manutenção do repositório:
   - manter `README.md`, `AGENTS.md`, `docs/`, `REQUIREMENTS*.md` e `CONTRIBUTING.md` coerentes com o `TASK.md` e com o código;
   - todo `.md` tem TOC entre duas tags `<!-- TOC -->`, gerado por `make toc`;
   - criar e atualizar os diagramas Mermaid e as analogias sempre que a arquitetura, o fluxo ou os testes mudarem;
   - **só quando pedido explicitamente**: atualizar as dependências de software para as versões mais recentes (Node no `mise.toml`, imagens Docker, pacotes npm com lockfile, ferramentas de gate), conferir a fonte oficial de cada uma, rodar `make gates`, `make tests`, `make test-blackbox`, `make test-e2e` e o `kit-gates`, e atualizar os `REQUIREMENTS*.md` e a matriz de sistemas;
   - rodar o `kit-gates` sempre que mexer em configuração de gate;
   - registrar cada erro de agente em `docs/incidentes.md`.
3. **`README.md`** (para humanos), com as seções exigidas: como rodar (pré-requisitos, subir, derrubar, gates, o que a subida informa), contas da seed, gates (G1 a G13, ferramenta de cada uma e como aplicar os exemplos próprios), decisões (isolamento, correção das violações, mudanças na documentação para agentes) e link para o registro de incidentes. Aponta para `docs/`.
4. **`CONTRIBUTING.md`**: fluxo de trabalho com worktrees, `make` alvos, gates, hook, padrão de commits, como registrar incidentes e como manter a documentação.
5. **`REQUIREMENTS.md`** genérico: detecta o sistema com `make check-os` e redireciona para:
   - `docs/requirements/REQUIREMENTS-ubuntu.md` (22.04, 24.04, 26.04 amd64);
   - `docs/requirements/REQUIREMENTS-macos.md` (amd64 e arm64, com Colima).
   Cada um traz: `make check-os`, `make check-dependencies`, `make install` e as instruções oficiais para instalar manualmente Git, Docker Engine/Colima, Compose, Node.js (via mise) e o mise, com os links oficiais.
6. **`docs/`**:
   - `docs/arquitetura.md`: camadas (`http` → `services` → `repositories`, `integrations`, `domain`, `config`) e regras de dependência;
   - `docs/ambiente.md`: subida, isolamento por cópia, portas, banco, anexos, Colima;
   - `docs/gates.md`: cada regra, ferramenta, exemplos de violação e como corrigir;
   - `docs/testes.md`: unitários, integração, caixa-preta e e2e;
   - `docs/incidentes.md`: registro de incidentes.
7. **Diagramas Mermaid com analogias** (para iniciantes):
   - arquitetura em containers por cópia (analogia: cada worktree é um apartamento com a sua própria cozinha, geladeira e caixa de correio);
   - camadas da API (analogia: restaurante: garçom = `http`, cozinheiro = `services`, despensa = `repositories`);
   - sequência de um chamado: criação → fila → worker → triagem (analogia: senha na recepção do hospital e a triagem da enfermagem);
   - fluxo de trabalho dos agentes: worktree → `make up` → mudança → `make gates` → hook → commit → incidente;
   - pirâmide de testes: unitários, integração, caixa-preta, e2e;
   - diagrama de classes/entidades: `User`, `Ticket`, `Reply`, `Attachment` e os serviços;
   - fluxo do `make up` e do `make down`.
8. **`scripts/toc.mjs`** (chamado por `make toc`):
   - gera o sumário a partir dos títulos `##` e `###`, ignorando blocos de código;
   - delimita o sumário com duas tags `<!-- TOC -->` (abertura e fechamento iguais, sem `<!-- /TOC -->`, para não conflitar com os plugins de Markdown);
   - se as tags já existem, substitui só o conteúdo entre elas; se não existem, insere logo depois do primeiro título `#`;
   - rodar duas vezes não muda o arquivo (idempotente), conferido por um teste;
   - ignora `node_modules/`, `kit-gates/` e o `TASK.md`.

### Fase 10: registro de incidentes

- `docs/incidentes.md` com pelo menos três entradas reais, cada uma com: data, agente, o que aconteceu, a mudança no harness que impede a repetição (gate, hook, script ou documento) e o hash do commit dessa mudança.
- Candidatos prováveis (só entram se acontecerem de verdade): agente seguindo o `npm run migrate` do `CLAUDE.md` antigo; agente usando `kill -9` na porta de outra cópia; agente usando `any` ou `eslint-disable` para passar no gate; seed duplicada na segunda subida; sessão antiga lendo o `CLAUDE.md` desatualizado.
- Commits do harness pequenos e separados, para que `git show --stat <hash>` mostre claramente a mudança.

### Fase 11: revisão final e validação completa

1. Clone limpo numa pasta nova e execução completa do fluxo do avaliador (passos 1 a 11 do TASK.md), manualmente e com `make test-e2e`.
2. `bash kit-gates/verificar.sh . "make gates"` com todas as violações `barrada`.
3. Exemplos das regras próprias fazendo os gates falharem.
4. Suíte caixa-preta do repositório base (não a do fork) contra as duas cópias, sem chave de IA.
5. Login pelo front nas duas cópias com as três contas da seed.
6. Revisão de cada linha do `AGENTS.md` (comando roda, caminho existe), contagem de linhas e checagem das seções do README.
7. `make toc` duas vezes sem diferença no `git diff`.
8. Teste em Ubuntu 22.04/24.04/26.04 (VM ou container com Docker) e em macOS com Colima (amd64 e arm64), quando houver máquina disponível.
9. Abrir uma sessão nova do agente para confirmar que ele segue o `AGENTS.md` novo.

## 5. Arquivos a criar ou alterar

| Caminho | Ação |
|---|---|
| `Makefile`, `mise.toml`, `package.json` (raiz) | criar |
| `scripts/up.sh`, `scripts/down.sh`, `scripts/status.sh`, `scripts/check-os.sh`, `scripts/check-dependencies.sh`, `scripts/install.sh`, `scripts/lib/*.sh` | criar |
| `scripts/gates.mjs`, `scripts/toc.mjs` | criar |
| `eslint.config.mjs`, `.dependency-cruiser.cjs`, `knip.json` | criar |
| `.githooks/pre-commit` | criar |
| `api/Dockerfile`, `web/Dockerfile`, `.dockerignore` | criar |
| `docker-compose.yml` | parametrizar |
| `.gitignore` | adicionar `.run/` e `web/.env` |
| `api/.env.example`, `web/.env.example` | atualizar/criar |
| `api/prisma/seed.ts` | tornar idempotente |
| `api/prisma/schema.prisma` | só `binaryTargets` do gerador |
| `api/src/**`, `web/src/**` | refatorar (Fase 6), sem mudar pastas e entradas fixas |
| `harness/violacoes-proprias/` | criar |
| `api/test/integration/*`, `tests/e2e/*` | criar |
| `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `REQUIREMENTS.md`, `docs/**` | criar ou reescrever |
| `blackbox/`, `kit-gates/` | não alterar |

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Avaliador sem `make` ou sem mise | Scripts Bash como fonte da verdade; `make` só delega; Node do sistema como alternativa ao mise |
| Mudança de comportamento na refatoração | Caixa-preta a cada passo da Fase 6, comparando com a Fase 0 |
| Gate que só reconhece o kit | Testar formas alternativas de cada violação (Fase 4, item 5) |
| Opção de ferramenta que desliga uma regra em silêncio | Rodar o `kit-gates` depois de cada mudança de configuração |
| Imports só de tipo invisíveis ao dependency-cruiser | `tsPreCompilationDeps: true` e teste com `import type` |
| Porta escolhida já ocupada entre a escolha e a subida | Verificação de porta livre logo antes do `compose up`, com nova tentativa |
| Bind mount no macOS fora do `$HOME` | Documentar `colima start --mount`; aviso em `make check-dependencies` |
| Prisma sem engine para arm64 | `binaryTargets` explícitos e `make images` para as duas plataformas |
| `npm install` reescrevendo lockfiles | Usar `npm ci` em todos os scripts |
| Hook lento demais | Hook roda só tipo e lint; o resto fica em `make gates` |

## 7. Checklist dos critérios de aceite

Ambiente

- [ ] Clone limpo + `make up` sobe API, worker e front, com migrations e seed, e informa endereços, banco e pasta de anexos.
- [ ] `make up` de novo, sem derrubar, funciona e as contas continuam entrando.
- [ ] Duas worktrees ao mesmo tempo, isoladas, com login pelo front e triagem em cada uma.
- [ ] `make down` numa cópia não afeta a outra.
- [ ] Caixa-preta do repositório base passa contra as duas cópias, sem chave de IA.

Gates

- [ ] `make gates` passa na `main`.
- [ ] Cada violação plantada (G1 a G10) aparece como `G<n> <arquivo>` (G10 de dependência com o nome).
- [ ] O comando roda todas as verificações antes de sair.
- [ ] Nenhuma supressão e nenhum arquivo excluído, salvo `config/` na G5.
- [ ] Regras próprias com motivação e exemplo versionado que faz os gates falharem.
- [ ] Hook ativo após `make up`, bloqueando erro de tipo e variável sem uso.

Documentação e registro

- [ ] `AGENTS.md` com 60 linhas no máximo e todo o conteúdo exigido.
- [ ] `CLAUDE.md` aponta para o `AGENTS.md`.
- [ ] Todo comando e caminho do `AGENTS.md` existe e funciona.
- [ ] `docs/incidentes.md` com pelo menos três entradas e hashes válidos.
- [ ] README com todas as seções do Entregável.
- [ ] Pastas e entradas fixas no lugar.

Pedidos adicionais

- [ ] Makefile com `check-os`, `check-dependencies`, `install`, `build`, `up`, `down`, `tests` e demais alvos.
- [ ] mise sem instalação global; Docker e Compose só com link oficial.
- [ ] Imagens Docker para `linux/amd64` e `linux/arm64`; Ubuntu 22.04/24.04/26.04 e macOS (Colima) documentados.
- [ ] `CONTRIBUTING.md`, `REQUIREMENTS.md` genérico e um por sistema operacional.
- [ ] TOC idempotente entre duas tags `<!-- TOC -->` em todos os `.md`.
- [ ] Diagramas Mermaid com analogias em `docs/`.
- [ ] Testes de integração e e2e cobrindo o fluxo do avaliador.
- [ ] `CLAUDE.md` com as regras de manutenção (docs, TOC, diagramas, atualização de dependências só quando pedida).
