#!/usr/bin/env node
// Confere que a documentação não mente:
//  - AGENTS.md com no máximo 60 linhas, e todo `make <alvo>` e todo caminho citados nele existem;
//  - CLAUDE.md aponta para o AGENTS.md;
//  - README.md com as seções exigidas pelo TASK.md e o link para o registro de incidentes;
//  - docs/incidentes.md com pelo menos 3 entradas, cada uma com o hash de um commit que existe
//    e mexe no harness;
//  - links relativos de todos os .md apontam para arquivos que existem;
//  - sumários (TOC) em dia.
// Uso: node scripts/check-docs.mjs   (sai com 1 se algo falhar)

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aplicarToc } from './toc.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ler = (p) => readFileSync(path.join(ROOT, p), 'utf8')
let falhas = 0
const ok = (m) => console.log(`  ok    ${m}`)
const falha = (m) => {
  falhas++
  console.log(`  FALHA ${m}`)
}

// ---------------------------------------------------------------- AGENTS.md
console.log('AGENTS.md')
const agents = ler('AGENTS.md')
const linhas = agents.split('\n').length - (agents.endsWith('\n') ? 1 : 0)
linhas <= 60 ? ok(`${linhas} linhas (máximo 60)`) : falha(`${linhas} linhas (máximo 60)`)

const alvos = new Set([...ler('Makefile').matchAll(/^([a-zA-Z0-9_-]+):/gm)].map((m) => m[1]))
const codigos = [...agents.matchAll(/`([^`]+)`/g)].map((m) => m[1])
for (const c of codigos) {
  for (const m of c.matchAll(/\bmake ([a-z][a-z0-9-]*)/g)) {
    alvos.has(m[1]) ? ok(`make ${m[1]}`) : falha(`make ${m[1]}: alvo não existe no Makefile`)
  }
}
const EXT = /\.(md|ts|tsx|mts|mjs|cjs|sh|json|ya?ml|prisma)$/
const caminhos = new Set()
for (const c of codigos) {
  for (const token of c.split(/\s+/)) {
    if (token.includes('<') || token.includes('*') || token.startsWith('@') || token.startsWith('/')) continue
    if (/^https?:/.test(token)) continue
    if (token.includes('/') || EXT.test(token)) caminhos.add(token)
  }
}
for (const p of caminhos) existsSync(path.join(ROOT, p)) ? ok(`caminho ${p}`) : falha(`caminho ${p} não existe`)
for (const m of agents.matchAll(/`bash ([^`<]+?\.sh)`/g)) {
  existsSync(path.join(ROOT, m[1])) ? ok(`script ${m[1]}`) : falha(`script ${m[1]} não existe`)
}

// ---------------------------------------------------------------- CLAUDE.md
console.log('CLAUDE.md')
ler('CLAUDE.md').includes('AGENTS.md') ? ok('aponta para o AGENTS.md') : falha('não aponta para o AGENTS.md')

// ---------------------------------------------------------------- README.md
console.log('README.md')
const readme = ler('README.md')
for (const secao of ['## Como rodar', '## Contas da seed', '## Gates', '## Decisões', 'Registro de incidentes']) {
  readme.includes(secao) ? ok(`seção "${secao.replace(/^## /, '')}"`) : falha(`falta a seção "${secao}"`)
}
for (const termo of ['make up', 'make down', 'make gates', 'harness/violacoes-proprias', 'docs/incidentes.md']) {
  readme.includes(termo) ? ok(`cita ${termo}`) : falha(`não cita ${termo}`)
}

// ---------------------------------------------------------------- incidentes
console.log('docs/incidentes.md')
const incidentes = ler('docs/incidentes.md')
const entradas = incidentes.split(/^### /m).slice(1)
entradas.length >= 3 ? ok(`${entradas.length} entradas (mínimo 3)`) : falha(`${entradas.length} entradas (mínimo 3)`)
const HARNESS = /^(scripts\/|\.githooks\/|harness\/|docs\/|tests\/e2e\/|eslint\.config\.mjs|\.dependency-cruiser\.cjs|knip\.json|Makefile|docker-compose\.yml|api\/Dockerfile|web\/Dockerfile|AGENTS\.md|CLAUDE\.md|README\.md|CONTRIBUTING\.md|REQUIREMENTS\.md|package\.json|mise\.toml)/
for (const e of entradas) {
  const titulo = e.split('\n')[0].trim()
  const hashes = [...e.matchAll(/\*\*Commit:?\*\*:?\s*`([0-9a-f]{7,40})`/g)].map((m) => m[1])
  if (!hashes.length) {
    falha(`"${titulo}": sem **Commit:** \`<hash>\``)
    continue
  }
  for (const h of hashes) {
    try {
      const arquivos = execFileSync('git', ['show', '--name-only', '--format=', h], { cwd: ROOT, encoding: 'utf8' })
        .split('\n')
        .filter(Boolean)
      arquivos.some((a) => HARNESS.test(a))
        ? ok(`"${titulo}": commit ${h} mexe no harness`)
        : falha(`"${titulo}": commit ${h} não mexe em arquivo do harness`)
    } catch {
      falha(`"${titulo}": commit ${h} não existe no histórico`)
    }
  }
}

// ---------------------------------------------------------------- links e TOC
console.log('links relativos e sumários')
const IGNORAR = new Set(['node_modules', '.git', '.run', 'kit-gates', 'dist'])
function mds(dir) {
  return readdirSync(dir).flatMap((n) => {
    if (IGNORAR.has(n)) return []
    const p = path.join(dir, n)
    return statSync(p).isDirectory() ? mds(p) : n.endsWith('.md') ? [p] : []
  })
}
let links = 0
for (const arquivo of mds(ROOT)) {
  const rel = path.relative(ROOT, arquivo)
  const texto = readFileSync(arquivo, 'utf8')
  if (aplicarToc(texto) !== texto) falha(`${rel}: sumário desatualizado (rode make toc)`)
  if (!/^<!-- TOC -->$/m.test(texto)) falha(`${rel}: sem sumário entre tags <!-- TOC -->`)
  const semCodigo = texto.replace(/```[\s\S]*?```/g, '')
  for (const m of semCodigo.matchAll(/\]\(([^)\s]+)\)/g)) {
    const alvo = m[1].split('#')[0]
    if (!alvo || /^[a-z]+:/.test(alvo)) continue
    links++
    if (!existsSync(path.resolve(path.dirname(arquivo), alvo))) falha(`${rel}: link quebrado para ${m[1]}`)
  }
}
ok(`${links} links relativos conferidos`)

console.log(falhas ? `\n${falhas} problema(s) na documentação.` : '\nDocumentação OK.')
process.exit(falhas ? 1 : 0)
