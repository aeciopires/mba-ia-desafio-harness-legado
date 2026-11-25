# Ambiente: subir, derrubar e isolar cópias

<!-- TOC -->
- [Em uma frase](#em-uma-frase)
- [Sistemas suportados](#sistemas-suportados)
- [O que o make up faz](#o-que-o-make-up-faz)
- [Containers de cada cópia](#containers-de-cada-cópia)
- [Como as cópias são isoladas](#como-as-cópias-são-isoladas)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Imagens Docker e arquiteturas](#imagens-docker-e-arquiteturas)
- [macOS com Colima](#macos-com-colima)
- [Problemas comuns](#problemas-comuns)
<!-- TOC -->

## Em uma frase

`make up` sobe o Balcão inteiro desta cópia do repositório em containers, com portas livres, banco e pasta de anexos próprios. `make down` derruba só ela.

> **Analogia: um prédio de apartamentos.** Cada cópia do repositório (clone ou worktree) é um apartamento com cozinha, geladeira e caixa de correio próprias: porta (portas de rede), geladeira (banco), caixa de correio (pasta de anexos) e morador (worker). Dois apartamentos funcionam ao mesmo tempo sem um mexer na geladeira do outro, e desligar a luz de um não apaga o outro.

## Sistemas suportados

| Sistema | Arquitetura | Docker |
|---|---|---|
| Ubuntu 22.04, 24.04 e 26.04 | amd64 | Docker Engine + plugin Compose |
| macOS | amd64 (Intel) e arm64 (Apple Silicon) | Colima + Docker CLI + Compose (sem Docker Desktop) |

`make check-os` confere o sistema e `make check-dependencies` confere as ferramentas. Instalação passo a passo em [REQUIREMENTS.md](../REQUIREMENTS.md).

Em outro Linux, o `make up` só avisa e tenta seguir; `make check-os` falha.

## O que o make up faz

```mermaid
flowchart TD
  subgraph p1["1. Conferir"]
    direction LR
    A([make up]) --> B{"sistema<br/>suportado?"}
    B -- não --> B1[só avisa]
    B -- sim --> C["git, docker,<br/>compose, Node 22+"]
    B1 --> C
  end
  subgraph p2["2. Preparar o host"]
    direction LR
    D["npm ci onde o<br/>lockfile mudou"] --> E["prisma<br/>generate"] --> E2["ativa o hook<br/>(core.hooksPath)"]
  end
  subgraph p3["3. Portas da cópia"]
    direction LR
    F{"cópia já<br/>no ar?"} -- sim --> G["reaproveita<br/>.run/ports.env"]
    F -- não --> H["escolhe livres<br/>4000+ / 5173+ / 5432+"]
  end
  subgraph p4["4. Containers do projeto"]
    direction LR
    J["compose up<br/>--build"] --> K["db saudável"] --> K2["migrate:<br/>migrations + seed"] --> L["api, worker<br/>e web"]
  end
  subgraph p5["5. Pronto"]
    direction LR
    M["espera API<br/>e front"] --> N["mostra endereços,<br/>banco e anexos"]
  end
  p1 --> p2 --> p3 --> p4 --> p5
```

Exemplo de saída:

```
Balcão no ar (projeto Docker Compose: balcao-copia-a-1a2b3c4d)
  API:     http://localhost:4000   (saúde: http://localhost:4000/api/health)
  Front:   http://localhost:5173
  Banco:   postgresql://balcao:balcao@localhost:5432/balcao
  Anexos:  /caminho/da/copia-a/.run/uploads
```

Rodar `make up` de novo, sem derrubar, é seguro: as portas gravadas são reaproveitadas, as imagens só são reconstruídas se o código mudou, as migrations já aplicadas são puladas e a seed não duplica nada (`upsert` nas contas e chamados de exemplo criados só se não existirem).

## Containers de cada cópia

```mermaid
flowchart LR
  subgraph copia["projeto Compose balcao-pasta-hash"]
    db[(db<br/>postgres:16)]
    migrate[migrate<br/>migrations + seed<br/>roda e sai]
    api[api<br/>tsx watch src/main.ts]
    worker[worker<br/>tsx watch src/jobs/triage-worker.ts]
    web[web<br/>vite dev server]
    migrate --> db
    api --> db
    worker --> db
  end
  host1[localhost:API_PORT] --> api
  host2[localhost:WEB_PORT] --> web
  host3[localhost:DB_PORT] --> db
  pasta[[.run/uploads da cópia]] --- api
```

- `api/src` e `web/src` são montados nos containers: editar o código recarrega a API, o worker e o front sem reconstruir.
- Os containers rodam com o UID/GID do seu usuário, então os anexos em `.run/uploads` são seus.
- O worker é um container separado da API, como antes era um processo separado.
- A IA roda em modo fake por padrão (`AI_MODE=fake`), sem chave.

## Como as cópias são isoladas

| Recurso | Como |
|---|---|
| Containers, rede e volume | Nome de projeto Compose `balcao-<pasta>-<hash do caminho>`: duas pastas diferentes nunca dividem nada. |
| Portas | Escolhidas livres na primeira subida e gravadas em `.run/ports.env`. |
| Banco | Um Postgres por cópia, com volume próprio (`<projeto>_pgdata`). |
| Anexos | `.run/uploads/` dentro da cópia, montada em `/data/uploads` no container da API. |
| Worker | Um container `worker` por cópia, ligado só ao banco dela. |
| Front → API | `VITE_API_URL` aponta para a porta da API da cópia; a API libera CORS (`CORS_ORIGIN`) só para o front dela. |
| Derrubada | `make down` roda `docker compose -p <projeto> down`: só os containers dessa cópia. |

Para criar uma segunda cópia:

```bash
git worktree add ../copia-b
cd ../copia-b
make up
```

## Variáveis de ambiente

A API lê tudo em `api/src/config/env.ts`; o front, em `web/src/config/env.ts`. Nos containers, os valores vêm do `docker-compose.yml` e do `.run/compose.env` (gerado). Para rodar a API fora de container, copie `api/.env.example` para `api/.env`.

| Variável | Padrão | Uso |
|---|---|---|
| `DATABASE_URL` | (obrigatória) | Banco da API e do worker |
| `PORT` | `4000` | Porta da API |
| `JWT_SECRET` | `dev-secret` | Assinatura do token |
| `AI_MODE` | `fake` | `openai` usa a OpenAI |
| `OPENAI_API_KEY` | vazio | Só no modo `openai` |
| `UPLOAD_DIR` | `/tmp/balcao/uploads` (fora de container) | Pasta de anexos |
| `TRIAGE_INTERVAL_MS` | `2000` | Intervalo do worker |
| `CORS_ORIGIN` | `http://localhost:5173` | Front autorizado |
| `VITE_API_URL` | `http://localhost:4000` | API usada pelo front |
| `WEB_PORT` / `WEB_HOST` | `5173` / `localhost` | Vite dev server |

## Imagens Docker e arquiteturas

- `api/Dockerfile` (API, worker e migrate) e `web/Dockerfile` (front) usam a imagem oficial `node:<versão>-bookworm-slim`, publicada para `linux/amd64` e `linux/arm64`.
- O client do Prisma é gerado dentro da imagem, para a plataforma dela; por isso a mesma receita funciona em Ubuntu amd64, Mac Intel e Mac Apple Silicon.
- `make build` gera as imagens para a arquitetura da máquina. `make images` compila para as duas plataformas com `docker buildx` (arquitetura diferente da máquina precisa de emulação QEMU: https://docs.docker.com/build/building/multi-platform/#qemu).

## macOS com Colima

O Balcão usa o [Colima](https://github.com/abiosoft/colima) no lugar do Docker Desktop. Depois de instalar (veja [REQUIREMENTS-macos.md](requirements/REQUIREMENTS-macos.md)):

```bash
colima start --cpu 4 --memory 4
make up
```

- O Colima monta o seu `$HOME` dentro da VM. Clone o repositório dentro do `$HOME`; fora dele, os volumes (código e anexos) não aparecem nos containers. Para outra pasta: `colima start --mount /outra/pasta:w`.
- Apple Silicon roda as imagens `linux/arm64` nativamente.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `o Docker não está respondendo` | Linux: `sudo systemctl start docker`. macOS: `colima start`. |
| `permission denied` no socket do Docker | Seu usuário não está no grupo `docker`: https://docs.docker.com/engine/install/linux-postinstall/ |
| Porta ocupada | O `make up` escolhe outra sozinho. Não mate processos pela porta: ela pode ser de outra cópia. |
| Chamado parado em "Em triagem" | O worker caiu: `make status` e `make logs`. `make up` sobe de novo. |
| Front em branco ou erro de CORS | Abra o endereço do front que o `make up` mostrou (com `localhost`, não `127.0.0.1`). |
| Quero zerar o banco desta cópia | `bash scripts/down.sh --volumes` e depois `make up`. |
| `Prisma Client did not initialize yet` no host | `bash scripts/install-deps.sh --force`. |
