// Fluxos do avaliador (TASK.md, "Fluxo do avaliador") contra a API desta cópia, pela rede.
// `make test-integration` passa API_URL (API da cópia) e UPLOADS_DIR_HOST (pasta de anexos dela).
// Sem API_URL, estes testes são pulados.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const API_URL = process.env.API_URL
const UPLOADS = process.env.UPLOADS_DIR_HOST

type Json = Record<string, unknown>

async function req(rota: string, opts: { method?: string; token?: string; json?: unknown; form?: FormData } = {}) {
  const headers: Record<string, string> = {}
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) body = opts.form
  const res = await fetch(`${API_URL}${rota}`, { method: opts.method ?? 'GET', headers, body })
  const text = await res.text()
  return { status: res.status, body: (text ? JSON.parse(text) : {}) as Json }
}

const contas = [
  { email: 'admin@balcao.dev', password: 'Admin@123', role: 'admin' },
  { email: 'agente@balcao.dev', password: 'Agente@123', role: 'agent' },
  { email: 'cliente@balcao.dev', password: 'Cliente@123', role: 'customer' },
]

async function login(email: string, password: string) {
  const r = await req('/api/auth/login', { method: 'POST', json: { email, password } })
  expect(r.status).toBe(200)
  return String(r.body.token)
}

const loginSeed = (role: string) => {
  const conta = contas.find((c) => c.role === role)!
  return login(conta.email, conta.password)
}

async function criarChamado(token: string, title: string, description: string) {
  const r = await req('/api/tickets', { method: 'POST', token, json: { title, description } })
  expect(r.status).toBe(201)
  return String(r.body.id)
}

async function esperarTriagem(token: string, id: string, limiteMs = 15000) {
  const inicio = Date.now()
  for (;;) {
    const r = await req(`/api/tickets/${id}`, { token })
    if (r.body.triageStatus !== 'pending' || Date.now() - inicio > limiteMs) return r.body
    await new Promise((res) => setTimeout(res, 500))
  }
}

describe.skipIf(!API_URL)('fluxo do avaliador (API da cópia)', () => {
  it('health responde com o banco', async () => {
    expect(await req('/api/health')).toEqual({ status: 200, body: { status: 'ok', db: 'ok' } })
  })

  it('as três contas da seed entram', async () => {
    for (const { email, password, role } of contas) {
      const r = await req('/api/auth/login', { method: 'POST', json: { email, password } })
      expect(r.status).toBe(200)
      expect(r.body.user).toMatchObject({ email, role })
    }
  })

  it('"Fatura em dobro, urgente" vira Financeiro / Urgente em até 15 s', async () => {
    const token = await loginSeed('customer')
    const id = await criarChamado(token, 'Fatura em dobro, urgente', 'Paguei duas vezes a mesma fatura.')
    expect(await esperarTriagem(token, id)).toMatchObject({ triageStatus: 'done', category: 'billing', priority: 'urgent' })
  })

  it('[falha-ia] no título marca a triagem como falha', async () => {
    const token = await loginSeed('customer')
    const id = await criarChamado(token, 'Teste [falha-ia]', 'Chamado para testar a falha da IA.')
    expect((await esperarTriagem(token, id)).triageStatus).toBe('failed')
  })

  it.skipIf(!UPLOADS)('anexo .txt vai para a pasta de anexos desta cópia', async () => {
    const token = await loginSeed('customer')
    const id = await criarChamado(token, 'Comprovante anexado', 'Segue o comprovante do pagamento.')
    const marca = `anexo-${Date.now()}`
    const form = new FormData()
    form.append('file', new Blob([marca], { type: 'text/plain' }), 'comprovante.txt')
    const anexo = await req(`/api/tickets/${id}/attachments`, { method: 'POST', token, form })
    expect(anexo.status).toBe(201)
    const arquivo = path.join(String(UPLOADS), String(anexo.body.storedName))
    expect(existsSync(arquivo)).toBe(true)
    expect(readFileSync(arquivo, 'utf8')).toBe(marca)
  })

  it('cliente só vê os próprios chamados; atendente assume e resolve; só admin vê estatísticas', async () => {
    const cliente = await loginSeed('customer')
    const agente = await loginSeed('agent')
    const admin = await loginSeed('admin')
    const id = await criarChamado(cliente, 'Erro ao gerar relatório', 'O relatório mensal dá erro ao abrir.')

    const email = `outra-${Date.now()}@teste.dev`
    const cadastro = await req('/api/auth/register', { method: 'POST', json: { name: 'Outra Pessoa', email, password: '12345678' } })
    expect(cadastro.status).toBe(201)
    const outro = await login(email, '12345678')
    expect((await req(`/api/tickets/${id}`, { token: outro })).status).toBe(404)

    expect((await req(`/api/tickets/${id}/assign`, { method: 'POST', token: agente })).body.status).toBe('in_progress')
    expect((await req(`/api/tickets/${id}/resolve`, { method: 'POST', token: agente })).body.status).toBe('resolved')
    expect((await req('/api/stats', { token: cliente })).status).toBe(403)
    const stats = await req('/api/stats', { token: admin })
    expect(stats.status).toBe(200)
    expect(Object.keys(stats.body)).toEqual(['byStatus', 'byCategory', 'byPriority'])
  })
})
