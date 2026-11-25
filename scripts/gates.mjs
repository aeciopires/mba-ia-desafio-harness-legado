#!/usr/bin/env node
// Orquestrador dos gates do Balcão.
//
// Roda TODAS as verificações (sem parar na primeira falha) e termina com a lista de
// violações, uma por linha, no formato "<ID> <arquivo> [detalhe]". Sai com 1 se houver
// qualquer violação, 0 se tudo passar e 2 se o próprio orquestrador não conseguir rodar.
//
// Uso:
//   node scripts/gates.mjs                      # todos os gates
//   node scripts/gates.mjs --only=tipos,lint    # só algumas verificações (usado pelo hook)
//   node scripts/gates.mjs --list               # lista as verificações
//
// Verificações e regras:
//   tipos       G1        tsc --noEmit em api/ e web/
//   lint        G2 G5 G11 ESLint (eslint.config.mjs)
//   testes      G3        Vitest, testes unitários api/src/**/*.test.ts
//   camadas     G4 G6 G7 G8 G9 G12  dependency-cruiser (.dependency-cruiser.cjs)
//   morto       G10       knip (knip.json)
//   supressoes  G13       busca de comentários de supressão em api/src e web/src

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TMP = mkdtempSync(path.join(tmpdir(), 'balcao-gates-'))
const IS_TTY = process.stdout.isTTY

const rel = (p) => path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join('/')
const bin = (dir, name) => path.join(ROOT, dir, 'node_modules', '.bin', name)

function run(cmd, args, cwd = ROOT) {
  return new Promise((resolve) => {
    if (!existsSync(cmd)) {
      resolve({ code: 127, out: `ferramenta não encontrada: ${rel(cmd)} (rode "make install")` })
      return
    }
    const child = spawn(cmd, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', CI: '1' },
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('error', (err) => resolve({ code: 127, out: String(err) }))
    child.on('close', (code) => resolve({ code: code ?? 1, out }))
  })
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- G1: tipos
async function tipos() {
  const v = []
  let log = ''
  for (const pkg of ['api', 'web']) {
    const r = await run(bin(pkg, 'tsc'), ['-p', `${pkg}/tsconfig.json`, '--noEmit', '--pretty', 'false'])
    log += `[${pkg}] código ${r.code}\n${r.out}`
    for (const line of r.out.split('\n')) {
      const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/)
      if (m) v.push({ rule: 'G1', file: rel(m[1]), detail: `${m[2]}:${m[3]} ${m[4]} ${m[5]}` })
      else if (/^error TS\d+/.test(line)) v.push({ rule: 'G1', file: `${pkg}/tsconfig.json`, detail: line })
    }
    if (r.code !== 0 && !v.some((x) => x.file.startsWith(`${pkg}/`)))
      v.push({ rule: 'G1', file: `${pkg}/`, detail: `tsc falhou (código ${r.code})` })
  }
  return { v, log }
}

// ---------------------------------------------------------------- G2, G5, G11: lint
async function lint() {
  const out = path.join(TMP, 'eslint.json')
  const r = await run(bin('.', 'eslint'), ['api', 'web', '--max-warnings', '0', '-f', 'json', '-o', out])
  const v = []
  const data = readJson(out)
  if (!data) {
    v.push({ rule: 'G2', file: 'eslint.config.mjs', detail: `ESLint não rodou (código ${r.code})` })
    return { v, log: r.out }
  }
  for (const res of data) {
    for (const msg of res.messages) {
      const tag = msg.message.match(/\b(G\d+):/)
      const rule = tag ? tag[1] : 'G2'
      v.push({ rule, file: rel(res.filePath), detail: `${msg.line}:${msg.column} ${msg.ruleId ?? 'erro'} ${msg.message}` })
    }
  }
  return { v, log: r.out }
}

// ---------------------------------------------------------------- G3: testes unitários
async function testes() {
  const out = path.join(TMP, 'vitest.json')
  const r = await run(
    bin('api', 'vitest'),
    ['run', '--reporter=default', '--reporter=json', `--outputFile.json=${out}`],
    path.join(ROOT, 'api'),
  )
  const v = []
  const data = readJson(out)
  if (data?.testResults) {
    for (const t of data.testResults) {
      if (t.status !== 'passed') {
        const failed = (t.assertionResults || []).filter((a) => a.status === 'failed').map((a) => a.title)
        v.push({ rule: 'G3', file: rel(t.name), detail: failed.length ? `falhou: ${failed.join('; ')}` : t.message || 'falhou' })
      }
    }
  }
  if (r.code !== 0 && v.length === 0) v.push({ rule: 'G3', file: 'api/src', detail: `vitest falhou (código ${r.code})` })
  return { v, log: r.out }
}

// ---------------------------------------------------------------- G4, G6-G9, G12: camadas
async function camadas() {
  const v = []
  let log = ''
  const alvos = [
    { tsconfig: 'api/tsconfig.json', paths: ['api/src'] },
    { tsconfig: 'web/tsconfig.json', paths: ['web/src', 'web/vite.config.ts'] },
  ]
  for (const alvo of alvos) {
    const out = path.join(TMP, `depcruise-${alvo.paths[0].replace('/', '-')}.json`)
    const r = await run(bin('.', 'depcruise'), [
      ...alvo.paths,
      '--config',
      '.dependency-cruiser.cjs',
      '--ts-config',
      alvo.tsconfig,
      '--output-type',
      'json',
      '--output-to',
      out,
    ])
    log += `[${alvo.paths.join(' ')}] código ${r.code}\n${r.out}`
    const data = readJson(out)
    if (!data) {
      v.push({ rule: 'G9', file: alvo.paths[0], detail: `dependency-cruiser não rodou (código ${r.code})` })
      continue
    }
    for (const viol of data.summary.violations) {
      const rule = viol.rule.name.split('-')[0]
      const detail = viol.cycle?.length
        ? `ciclo: ${[viol.from, ...viol.cycle.map((c) => (typeof c === 'string' ? c : c.name))].join(' -> ')}`
        : `importa ${viol.to}`
      v.push({ rule, file: rel(viol.from), detail })
    }
  }
  return { v, log }
}

// ---------------------------------------------------------------- G10: código morto
async function morto() {
  const r = await run(bin('.', 'knip'), ['--reporter', 'json', '--no-progress', '--no-config-hints'])
  const v = []
  // O reporter json escreve no stdout; separa o JSON de eventuais avisos.
  const start = r.out.indexOf('{"')
  let data = null
  try {
    data = start >= 0 ? JSON.parse(r.out.slice(start, r.out.lastIndexOf('}') + 1)) : null
  } catch {
    data = null
  }
  if (!data) {
    if (r.code !== 0) v.push({ rule: 'G10', file: 'knip.json', detail: `knip não rodou (código ${r.code})` })
    return { v, log: r.out }
  }
  const tipos = {
    files: 'arquivo sem uso',
    dependencies: 'dependência sem uso',
    devDependencies: 'dependência de desenvolvimento sem uso',
    optionalPeerDependencies: 'peer dependency sem uso',
    unlisted: 'dependência não declarada',
    binaries: 'binário não declarado',
    unresolved: 'import não resolvido',
    exports: 'export sem uso',
    nsExports: 'export sem uso (namespace)',
    types: 'tipo exportado sem uso',
    nsTypes: 'tipo exportado sem uso (namespace)',
    enumMembers: 'membro de enum sem uso',
    duplicates: 'export duplicado',
  }
  for (const issue of data.issues || []) {
    for (const [key, label] of Object.entries(tipos)) {
      const items = issue[key]
      if (!Array.isArray(items)) continue
      for (const item of items) {
        const nome = Array.isArray(item) ? item.map((i) => i.name).join(', ') : item.name
        if (key === 'files') v.push({ rule: 'G10', file: rel(issue.file), detail: label })
        else v.push({ rule: 'G10', file: rel(issue.file), detail: `${nome} (${label})` })
      }
    }
  }
  if (r.code !== 0 && v.length === 0) v.push({ rule: 'G10', file: 'knip.json', detail: `knip falhou (código ${r.code})` })
  return { v, log: v.length ? '' : r.out }
}

// ---------------------------------------------------------------- G13: supressões
const SUPRESSAO = /eslint-disable|eslint-enable|@ts-ignore|@ts-expect-error|@ts-nocheck|\/[/*]\s*eslint(\s|$)/
const EXTENSOES = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/

function arquivos(dir) {
  const abs = path.join(ROOT, dir)
  if (!existsSync(abs)) return []
  const lista = []
  for (const nome of readdirSync(abs)) {
    if (nome === 'node_modules') continue
    const p = path.join(dir, nome)
    if (statSync(path.join(ROOT, p)).isDirectory()) lista.push(...arquivos(p))
    else if (EXTENSOES.test(nome)) lista.push(p)
  }
  return lista
}

async function supressoes() {
  const v = []
  for (const file of [...arquivos('api/src'), ...arquivos('web/src')]) {
    readFileSync(path.join(ROOT, file), 'utf8')
      .split('\n')
      .forEach((linha, i) => {
        if (SUPRESSAO.test(linha)) v.push({ rule: 'G13', file: rel(file), detail: `linha ${i + 1}: comentário de supressão` })
      })
  }
  return { v, log: '' }
}

// ---------------------------------------------------------------- execução
const CHECKS = {
  tipos: { regras: 'G1', fn: tipos },
  lint: { regras: 'G2 G5 G11', fn: lint },
  testes: { regras: 'G3', fn: testes },
  camadas: { regras: 'G4 G6 G7 G8 G9 G12', fn: camadas },
  morto: { regras: 'G10', fn: morto },
  supressoes: { regras: 'G13', fn: supressoes },
}

const args = process.argv.slice(2)
if (args.includes('--list') || args.includes('--help')) {
  for (const [nome, c] of Object.entries(CHECKS)) console.log(`${nome.padEnd(12)} ${c.regras}`)
  process.exit(0)
}
const onlyArg = args.find((a) => a.startsWith('--only='))
const selecionados = onlyArg ? onlyArg.slice(7).split(',').filter(Boolean) : Object.keys(CHECKS)
const desconhecidos = selecionados.filter((s) => !CHECKS[s])
if (desconhecidos.length) {
  console.error(`verificação desconhecida: ${desconhecidos.join(', ')}. Use --list.`)
  process.exit(2)
}

const verbose = args.includes('--verbose')
const inicio = Date.now()
console.log(`Gates do Balcão: ${selecionados.join(', ')}\n`)

const resultados = await Promise.all(
  selecionados.map(async (nome) => {
    const t0 = Date.now()
    let res
    try {
      res = await CHECKS[nome].fn()
    } catch (err) {
      res = { v: [{ rule: CHECKS[nome].regras.split(' ')[0], file: 'scripts/gates.mjs', detail: `erro interno: ${err}` }], log: '' }
    }
    return { nome, ...res, ms: Date.now() - t0 }
  }),
)

const vistos = new Set()
const violacoes = []
for (const r of resultados) {
  const status = r.v.length ? `FALHOU (${r.v.length})` : 'ok'
  console.log(`- ${r.nome.padEnd(11)} [${CHECKS[r.nome].regras}] ${status} em ${(r.ms / 1000).toFixed(1)}s`)
  if (verbose && r.log) console.log(r.log.replace(/^/gm, '    '))
  for (const x of r.v) {
    const linha = `${x.rule} ${x.file}${x.detail ? `  ${x.detail.replace(/\s+/g, ' ').trim()}` : ''}`
    if (!vistos.has(linha)) {
      vistos.add(linha)
      violacoes.push({ ...x, linha })
    }
  }
}

rmSync(TMP, { recursive: true, force: true })
const ordem = (id) => Number(id.slice(1))
violacoes.sort((a, b) => ordem(a.rule) - ordem(b.rule) || a.file.localeCompare(b.file))

console.log('')
if (violacoes.length === 0) {
  console.log(`Gates OK: nenhuma violação (${((Date.now() - inicio) / 1000).toFixed(1)}s).`)
  process.exit(0)
}
const red = (s) => (IS_TTY ? `\x1b[31m${s}\x1b[0m` : s)
console.log(red(`Violações encontradas (${violacoes.length}):`))
for (const x of violacoes) console.log(x.linha)
console.log('\nDetalhe de cada regra: docs/gates.md. Rode com --verbose para ver a saída das ferramentas.')
process.exit(1)
