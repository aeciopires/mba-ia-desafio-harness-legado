#!/usr/bin/env bash
# Reproduz o "Fluxo do avaliador" do TASK.md numa pasta temporária:
#   1. clone limpo (copia-a) + make up duas vezes
#   2. git worktree add ../copia-b + make up: portas, banco e anexos diferentes
#   3. isolamento: chamado, triagem em até 15 s, anexo só na pasta da copia-a, CORS e front de cada cópia
#   4. suíte caixa-preta contra as duas cópias (a do repositório base, se BASE for informado)
#   5. gates passam; kit-gates; 6. exemplos das regras próprias falham os gates
#   7. hook bloqueia erro de tipo e variável sem uso; 8. nenhuma supressão
#   9. derrubar a copia-b não afeta a copia-a; subir de novo; derrubar as duas
#  10. documentação (AGENTS.md, CLAUDE.md, README, incidentes); 11. pastas e entradas fixas
#
# Uso: bash tests/e2e/fluxo-avaliador.sh
#      BASE=https://github.com/devfullcycle/mba-ia-desafio-harness-legado bash tests/e2e/fluxo-avaliador.sh
# Testa o último commit (HEAD), não as mudanças ainda não commitadas.
set -uo pipefail

ORIGEM=$(cd "$(dirname "$0")/../.." && pwd -P)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/balcao-e2e.XXXXXX")
A="$TMP/copia-a"
B="$TMP/copia-b"
FALHAS=0

passo() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
ok() { printf '  ok    %s\n' "$*"; }
falha() {
  printf '  \033[31mFALHA\033[0m %s\n' "$*"
  FALHAS=$((FALHAS + 1))
}
confere() { if eval "$1"; then ok "$2"; else falha "$2"; fi; }
mk() { if command -v make >/dev/null 2>&1; then make -s -C "$1" "${@:2}"; else bash "$1/scripts/$2.sh" "${@:3}"; fi; }
porta() { grep "^$2=" "$1/.run/ports.env" | cut -d= -f2; }
# GET sem depender do curl (a máquina do avaliador tem Node).
responde() { node -e 'fetch(process.argv[1]).then(r => r.text()).then(t => process.exit(t.includes(process.argv[2] || "") ? 0 : 1)).catch(() => process.exit(1))' "$1" "${2:-}"; }
entra() {
  node -e 'fetch(process.argv[1] + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: process.argv[2], password: process.argv[3] }) }).then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))' "$1" "$2" "$3"
}

limpar() {
  passo "limpeza"
  [ -d "$B" ] && bash "$B/scripts/down.sh" --volumes >/dev/null 2>&1
  [ -d "$A" ] && bash "$A/scripts/down.sh" --volumes >/dev/null 2>&1
  rm -rf "$TMP"
  ok "cópias derrubadas e $TMP removido"
}
trap limpar EXIT

passo "1. clone limpo e subida (duas vezes)"
git clone -q "$ORIGEM" "$A" && git -C "$A" checkout -q "$(git -C "$ORIGEM" rev-parse HEAD)"
SAIDA_A=$(mk "$A" up 2>&1)
RC=$?
confere '[ "$RC" -eq 0 ]' "make up na copia-a"
for item in "API:" "Front:" "Banco:" "Anexos:"; do
  confere 'grep -q "$item" <<<"$SAIDA_A"' "a subida informa $item"
done
confere 'mk "$A" up >/dev/null 2>&1' "segunda subida sem derrubar termina sem erro"
API_A="http://localhost:$(porta "$A" API_PORT)"
WEB_A="http://localhost:$(porta "$A" WEB_PORT)"
for conta in "admin@balcao.dev Admin@123" "agente@balcao.dev Agente@123" "cliente@balcao.dev Cliente@123"; do
  set -- $conta
  confere 'entra "$API_A" "$1" "$2"' "$1 entra na copia-a depois da segunda subida"
done
confere '[ "$(git -C "$A" config core.hooksPath)" = ".githooks" ]' "hook ativo depois da subida"

passo "2. segunda worktree"
git -C "$A" worktree add -q "$B" 2>/dev/null
confere 'mk "$B" up >/dev/null 2>&1' "make up na copia-b com a copia-a no ar"
API_B="http://localhost:$(porta "$B" API_PORT)"
WEB_B="http://localhost:$(porta "$B" WEB_PORT)"
for p in API_PORT WEB_PORT DB_PORT; do
  confere '[ "$(porta "$A" $p)" != "$(porta "$B" $p)" ]' "$p diferente ($(porta "$A" $p) x $(porta "$B" $p))"
done
confere '[ "$A/.run/uploads" != "$B/.run/uploads" ]' "pastas de anexos diferentes"

passo "3. isolamento entre as cópias"
confere 'node "$A/tests/e2e/isolamento.mjs" "$API_A" "$A/.run/uploads" "$API_B" "$B/.run/uploads" "$WEB_A" "$WEB_B"' "chamado, triagem, anexo, CORS e front isolados"

passo "4. suíte caixa-preta contra as duas cópias"
BB="$A/blackbox"
if [ -n "${BASE:-}" ]; then
  git clone -q "$BASE" "$TMP/base-oficial" && BB="$TMP/base-oficial/blackbox"
  ok "usando a suíte do repositório base ($BASE)"
fi
(cd "$BB" && npm ci --no-audit --no-fund --loglevel=error >/dev/null)
confere '(cd "$BB" && API_URL="$API_A" npm test >/dev/null 2>&1)' "caixa-preta contra a copia-a ($API_A)"
confere '(cd "$BB" && API_URL="$API_B" npm test >/dev/null 2>&1)' "caixa-preta contra a copia-b ($API_B)"

passo "5. gates e kit-gates"
confere '(cd "$A" && node scripts/gates.mjs >/dev/null 2>&1)' "gates passam"
confere '(cd "$A" && bash kit-gates/verificar.sh . "node scripts/gates.mjs" >/dev/null 2>&1)' "kit-gates: todas as violações barradas"
confere '(cd "$A" && bash scripts/verificar-violacoes.sh harness/violacoes-extras >/dev/null 2>&1)' "violações extras (outras formas de G1-G10) barradas"

passo "6. regras próprias"
confere '(cd "$A" && bash scripts/verificar-violacoes.sh harness/violacoes-proprias >/dev/null 2>&1)' "exemplos de G11, G12 e G13 fazem os gates falharem"

passo "7. hook de pre-commit"
cd "$A" || exit 1
git config user.email >/dev/null || git config user.email "e2e@balcao.dev"
git config user.name >/dev/null || git config user.name "e2e"
printf "export const total: number = 'muitos'\n" >api/src/services/teste-hook.ts
git add api/src/services/teste-hook.ts
confere '! git commit -q -m "teste do hook" >/dev/null 2>&1' "commit com erro de tipo bloqueado"
git reset -q && rm api/src/services/teste-hook.ts
printf "export function f(): number {\n  const sobra = 1\n  return 2\n}\n" >api/src/services/teste-hook.ts
git add api/src/services/teste-hook.ts
confere '! git commit -q -m "teste do hook" >/dev/null 2>&1' "commit com variável sem uso bloqueado"
git reset -q && rm api/src/services/teste-hook.ts
confere 'grep -q "tipos,lint" .githooks/pre-commit' "o hook roda tipo e lint"

passo "8. supressões"
confere '! git grep -n -E "eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck" -- api/src web/src >/dev/null' "nenhuma supressão em api/src e web/src"

passo "9. derrubar e subir de novo"
mk "$B" down >/dev/null 2>&1
confere 'responde "$API_A/api/health" "\"ok\""' "copia-a responde depois de derrubar a copia-b"
confere 'mk "$B" up >/dev/null 2>&1' "copia-b sobe de novo sem erro"
mk "$B" down >/dev/null 2>&1
mk "$A" down >/dev/null 2>&1
confere '! responde "$API_A/api/health"' "copia-a derrubada"

passo "10. documentação"
confere '[ "$(wc -l <AGENTS.md)" -le 60 ]' "AGENTS.md com $(wc -l <AGENTS.md | tr -d " ") linhas (máximo 60)"
confere 'grep -q "AGENTS.md" CLAUDE.md' "CLAUDE.md aponta para o AGENTS.md"
confere 'bash scripts/check-docs.sh >/dev/null 2>&1' "comandos e caminhos do AGENTS.md existem; README com as seções; incidentes com hashes válidos"

passo "11. pastas e entradas fixas"
confere 'ls -d api/src/config api/src/domain api/src/http api/src/services api/src/repositories api/src/integrations api/src/main.ts api/src/jobs/triage-worker.ts web/src web/src/main.tsx >/dev/null' "todas no lugar"

cd "$ORIGEM" || exit 1
printf '\n'
if [ "$FALHAS" -eq 0 ]; then
  printf '\033[32mFluxo do avaliador: tudo OK.\033[0m\n'
  exit 0
fi
printf '\033[31mFluxo do avaliador: %s falha(s).\033[0m\n' "$FALHAS"
exit 1
