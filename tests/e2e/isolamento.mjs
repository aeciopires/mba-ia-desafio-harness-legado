#!/usr/bin/env node
// Passo 3 do fluxo do avaliador, automatizado: duas cópias no ar, isoladas.
//
// Uso: node tests/e2e/isolamento.mjs <API da cópia A> <anexos da cópia A> <API da cópia B> <anexos da cópia B> [front A] [front B]
//
// Confere que:
//  - o cliente da seed entra nas duas cópias;
//  - um chamado criado na A é triado em até 15 s como Financeiro / Urgente;
//  - o anexo .txt da A aparece na pasta de anexos da A e não na da B;
//  - a lista da B não mostra o chamado da A, e um chamado da B também é triado;
//  - cada API libera CORS só para o front da própria cópia.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const [apiA, dirA, apiB, dirB, frontA, frontB] = process.argv.slice(2)
if (!apiA || !dirA || !apiB || !dirB) {
  console.error('uso: node tests/e2e/isolamento.mjs <apiA> <anexosA> <apiB> <anexosB> [frontA] [frontB]')
  process.exit(2)
}

let falhas = 0
const ok = (msg) => console.log(`  ok    ${msg}`)
const falha = (msg) => {
  falhas++
  console.log(`  FALHA ${msg}`)
}
const confere = (cond, msg) => (cond ? ok(msg) : falha(msg))

async function req(api, rota, { method = 'GET', token, json, form, origin } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (origin) headers.Origin = origin
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) body = form
  const res = await fetch(`${api}${rota}`, { method, headers, body })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, body: data, headers: res.headers }
}

async function login(api) {
  const r = await req(api, '/api/auth/login', { method: 'POST', json: { email: 'cliente@balcao.dev', password: 'Cliente@123' } })
  if (r.status !== 200) throw new Error(`login em ${api} falhou: ${r.status} ${JSON.stringify(r.body)}`)
  return r.body.token
}

async function esperarTriagem(api, token, id, limiteMs = 15000) {
  const inicio = Date.now()
  while (Date.now() - inicio < limiteMs) {
    const r = await req(api, `/api/tickets/${id}`, { token })
    if (r.body?.triageStatus !== 'pending') return { ticket: r.body, ms: Date.now() - inicio }
    await new Promise((res) => setTimeout(res, 500))
  }
  return { ticket: null, ms: limiteMs }
}

const arquivosEm = (dir) => (existsSync(dir) ? readdirSync(dir) : [])

console.log(`Isolamento entre cópias\n  A: ${apiA} (anexos ${dirA})\n  B: ${apiB} (anexos ${dirB})`)

const tokenA = await login(apiA)
const tokenB = await login(apiB)
ok('cliente da seed entra nas duas cópias')

const marca = `${Date.now()}`
const criado = await req(apiA, '/api/tickets', {
  method: 'POST',
  token: tokenA,
  json: { title: 'Fatura em dobro, urgente', description: `Paguei duas vezes a mesma fatura. (${marca})` },
})
confere(criado.status === 201, 'chamado criado na cópia A')
const idA = criado.body.id

const triA = await esperarTriagem(apiA, tokenA, idA)
confere(
  triA.ticket?.triageStatus === 'done' && triA.ticket.category === 'billing' && triA.ticket.priority === 'urgent',
  `cópia A triou como Financeiro / Urgente em ${(triA.ms / 1000).toFixed(1)}s (limite 15s)`,
)

const antesA = new Set(arquivosEm(dirA))
const antesB = new Set(arquivosEm(dirB))
const form = new FormData()
form.append('file', new Blob([`anexo ${marca}\n`], { type: 'text/plain' }), 'comprovante.txt')
const anexo = await req(apiA, `/api/tickets/${idA}/attachments`, { method: 'POST', token: tokenA, form })
confere(anexo.status === 201, 'anexo .txt enviado na cópia A')
const novosA = arquivosEm(dirA).filter((f) => !antesA.has(f))
const novosB = arquivosEm(dirB).filter((f) => !antesB.has(f))
confere(
  novosA.length === 1 && readFileSync(path.join(dirA, novosA[0]), 'utf8').includes(marca),
  `anexo gravado na pasta da cópia A (${novosA[0] ?? 'nenhum'})`,
)
confere(novosB.length === 0, 'nenhum anexo novo na pasta da cópia B')

const listaB = await req(apiB, '/api/tickets', { token: tokenB })
confere(!listaB.body.items.some((t) => t.id === idA), 'a lista da cópia B não mostra o chamado da cópia A')
const naB = await req(apiB, `/api/tickets/${idA}`, { token: tokenB })
confere(naB.status === 404, 'o chamado da cópia A dá 404 na cópia B')

const criadoB = await req(apiB, '/api/tickets', {
  method: 'POST',
  token: tokenB,
  json: { title: 'Não consigo acessar minha conta', description: `A senha não funciona desde ontem (${marca})` },
})
const triB = await esperarTriagem(apiB, tokenB, criadoB.body.id)
confere(triB.ticket?.triageStatus === 'done', `cópia B triou o próprio chamado em ${(triB.ms / 1000).toFixed(1)}s`)
const listaA = await req(apiA, '/api/tickets', { token: tokenA })
confere(!listaA.body.items.some((t) => t.id === criadoB.body.id), 'a lista da cópia A não mostra o chamado da cópia B')

if (frontA && frontB) {
  const corsA = await req(apiA, '/api/health', { origin: frontA })
  const corsB = await req(apiB, '/api/health', { origin: frontB })
  confere(corsA.headers.get('access-control-allow-origin') === frontA, `API A libera CORS para ${frontA}`)
  confere(corsB.headers.get('access-control-allow-origin') === frontB, `API B libera CORS para ${frontB}`)
  for (const [front, api] of [
    [frontA, apiA],
    [frontB, apiB],
  ]) {
    const html = await fetch(front).then((r) => r.text())
    confere(html.includes('<div id="root">'), `front ${front} responde`)
    const cfg = await fetch(`${front}/src/config/env.ts`).then((r) => r.text())
    confere(cfg.includes(api), `front ${front} aponta para ${api}`)
  }
}

console.log(falhas ? `\n${falhas} falha(s).` : '\nIsolamento OK.')
process.exit(falhas ? 1 : 0)
