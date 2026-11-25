# Como contribuir

<!-- TOC -->
- [Antes de começar](#antes-de-começar)
- [Trabalhando numa tarefa](#trabalhando-numa-tarefa)
- [Regras do código](#regras-do-código)
- [Commits](#commits)
- [Documentação](#documentação)
- [Incidentes](#incidentes)
- [Atualizar dependências de software](#atualizar-dependências-de-software)
<!-- TOC -->

## Antes de começar

1. Confira o sistema e as dependências: `make check-os` e `make check-dependencies` (detalhes em [REQUIREMENTS.md](REQUIREMENTS.md)).
2. Instale o que falta: `make install` (mise no seu usuário, Node.js do `mise.toml` e dependências npm; nada global).
3. Suba o ambiente: `make up`. Ele mostra os endereços da API, do front, o banco e a pasta de anexos.

Sem `make`, cada alvo tem um script: `bash scripts/check-os.sh`, `bash scripts/check-dependencies.sh`, `bash scripts/install.sh`, `bash scripts/up.sh`.

## Trabalhando numa tarefa

```bash
git worktree add ../minha-tarefa     # uma cópia isolada por tarefa (opcional, recomendado)
cd ../minha-tarefa
make up
# ... mudanças ...
make gates                           # G1 a G13
make tests                           # unitários
make test-blackbox                   # contrato da API
git commit -m "mensagem curta"       # o hook roda tipos e lint
make down
```

O fluxo completo, com diagrama, está em [docs/fluxo-de-trabalho.md](docs/fluxo-de-trabalho.md).

## Regras do código

As regras de camada estão no [AGENTS.md](AGENTS.md) e, com exemplos e como corrigir, em [docs/gates.md](docs/gates.md). Em resumo:

- rotas (`api/src/http/`) chamam serviços; serviços (`api/src/services/`) usam repositórios e integrações; só os repositórios falam com o Prisma;
- variáveis de ambiente e endereços padrão só em `config/`;
- o front não importa nada da API;
- sem `any`, sem código morto, sem ciclos e sem supressões;
- serviço novo ganha teste ao lado (`*.test.ts`).

O comportamento da API (rotas, corpos, status e códigos de erro) não muda: a suíte `blackbox/` é o contrato.

## Commits

- Um commit por tarefa, mensagem curta em português ou inglês.
- `make gates` e `make tests` passando antes do commit; o hook de pre-commit barra erro de tipo e de lint.
- Nunca commite `.env` nem `.run/`.

## Documentação

- Toda mudança em comando, script, porta, variável ou regra atualiza a documentação no mesmo commit.
- Todo `.md` tem um sumário entre duas tags `<!-- TOC -->`: rode `make toc` depois de mudar títulos.
- Os textos de `docs/` são para iniciantes: diagrama Mermaid e analogia para cada conceito importante.
- `bash scripts/check-docs.sh` confere o `AGENTS.md` (60 linhas, comandos e caminhos existentes), o README, os sumários e o registro de incidentes.

## Incidentes

Se um agente (ou você) errou e o harness não pegou, registre em [docs/incidentes.md](docs/incidentes.md): o que aconteceu, a mudança no harness que impede a repetição e o hash do commit dessa mudança.

## Atualizar dependências de software

Só com pedido explícito, seguindo o passo a passo do [CLAUDE.md](CLAUDE.md#atualização-de-dependências-de-software-só-quando-pedida): fontes oficiais, lockfiles, todos os testes e os arquivos `REQUIREMENTS*.md` atualizados.
