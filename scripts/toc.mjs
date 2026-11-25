#!/usr/bin/env node
// Gera ou atualiza o sumário (TOC) dos arquivos Markdown do repositório.
//
// - O sumário fica entre DUAS tags iguais `<!-- TOC -->` (abertura e fechamento). Não usamos
//   `<!-- /TOC -->`, que conflita com plugins de Markdown que geram TOC.
// - Idempotente: se as tags já existem, só o conteúdo entre elas é trocado; rodar de novo
//   não muda nada. Se não existem, o sumário entra logo depois do primeiro título `# `.
// - Lista os títulos `##` e `###` (fora de blocos de código), com âncoras no padrão do GitHub.
//
// Uso:
//   node scripts/toc.mjs            # atualiza todos os .md
//   node scripts/toc.mjs --check    # só confere; sai com 1 se algum .md estiver desatualizado
//   node scripts/toc.mjs a.md b.md  # só os arquivos informados

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TAG = '<!-- TOC -->'
const IGNORAR = new Set(['node_modules', '.git', '.run', 'kit-gates', 'dist', 'coverage'])

function arquivosMarkdown(dir) {
  const lista = []
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue
    const p = path.join(dir, nome)
    if (statSync(p).isDirectory()) lista.push(...arquivosMarkdown(p))
    else if (nome.endsWith('.md')) lista.push(p)
  }
  return lista.sort()
}

export function slug(texto, usados) {
  const base = texto
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
  const n = usados.get(base) ?? 0
  usados.set(base, n + 1)
  return n === 0 ? base : `${base}-${n}`
}

function textoDoTitulo(t) {
  return t
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

export function gerarToc(linhas) {
  const usados = new Map()
  const itens = []
  let emCodigo = false
  let dentroToc = false
  for (const linha of linhas) {
    if (linha.trim() === TAG) {
      dentroToc = !dentroToc
      continue
    }
    if (dentroToc) continue
    if (/^\s*(```|~~~)/.test(linha)) emCodigo = !emCodigo
    if (emCodigo) continue
    const m = linha.match(/^(#{1,6})\s+(.+)$/)
    if (!m) continue
    const nivel = m[1].length
    const texto = textoDoTitulo(m[2])
    const ancora = slug(texto, usados)
    if (nivel === 2 || nivel === 3) itens.push(`${'  '.repeat(nivel - 2)}- [${texto}](#${ancora})`)
  }
  return itens
}

export function aplicarToc(conteudo) {
  const linhas = conteudo.split('\n')
  const toc = [TAG, ...gerarToc(linhas), TAG]
  const abre = linhas.findIndex((l) => l.trim() === TAG)
  const fecha = abre >= 0 ? linhas.findIndex((l, i) => i > abre && l.trim() === TAG) : -1
  if (abre >= 0 && fecha > abre) {
    linhas.splice(abre, fecha - abre + 1, ...toc)
    return linhas.join('\n')
  }
  // Sem as tags: insere depois do primeiro título H1 (fora de código) ou no início.
  let emCodigo = false
  let h1 = -1
  for (let i = 0; i < linhas.length; i++) {
    if (/^\s*(```|~~~)/.test(linhas[i])) emCodigo = !emCodigo
    if (!emCodigo && /^#\s+/.test(linhas[i])) {
      h1 = i
      break
    }
  }
  const pos = h1 + 1
  const bloco = h1 >= 0 ? ['', ...toc] : [...toc, '']
  linhas.splice(pos, 0, ...bloco)
  return linhas.join('\n')
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const args = process.argv.slice(2)
  const check = args.includes('--check')
  const alvos = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(a))
  const arquivos = alvos.length ? alvos : arquivosMarkdown(ROOT)
  let desatualizados = 0
  for (const arquivo of arquivos) {
    const atual = readFileSync(arquivo, 'utf8')
    const novo = aplicarToc(atual)
    if (novo === atual) continue
    desatualizados++
    const rel = path.relative(ROOT, arquivo)
    if (check) console.log(`TOC desatualizado: ${rel}`)
    else {
      writeFileSync(arquivo, novo)
      console.log(`TOC atualizado: ${rel}`)
    }
  }
  if (check && desatualizados) {
    console.log('Rode: make toc')
    process.exit(1)
  }
  if (!desatualizados) console.log('TOC em dia em todos os arquivos.')
}
