// Rotas do Atendimento no modo simulado: isolamento entre empresas e papéis.
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const depois: (() => Promise<void>)[] = []
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => depois.push(fn) }))

process.env.SIMULAR = '1'

const DONO = 'simulado:demo-dono:dono@demo.atena'
const ANA = 'simulado:demo-ana:ana@demo.atena'
const OUTRO = 'simulado:demo-outro:outro@demo.atena'

function req(url: string, token: string, corpo?: unknown, metodo?: string) {
  return new Request(`http://localhost${url}`, {
    method: metodo ?? (corpo ? 'POST' : 'GET'),
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
}
const params = (id: string) => ({ params: Promise.resolve({ id }) })

let conversas: typeof import('@/app/api/whatsapp/conversas/route')
let conversa: typeof import('@/app/api/whatsapp/conversas/[id]/route')
let conexao: typeof import('@/app/api/whatsapp/conexao/route')
let treino: typeof import('@/app/api/whatsapp/treino/route')
let webhook: typeof import('@/app/api/whatsapp/webhook/route')
let simulador: typeof import('@/app/api/whatsapp/simulador/route')
let metricas: typeof import('@/app/api/whatsapp/metricas/route')

beforeAll(async () => {
  conversas = await import('@/app/api/whatsapp/conversas/route')
  conversa = await import('@/app/api/whatsapp/conversas/[id]/route')
  conexao = await import('@/app/api/whatsapp/conexao/route')
  treino = await import('@/app/api/whatsapp/treino/route')
  webhook = await import('@/app/api/whatsapp/webhook/route')
  simulador = await import('@/app/api/whatsapp/simulador/route')
  metricas = await import('@/app/api/whatsapp/metricas/route')
})

describe('rotas do Atendimento', () => {
  it('cada empresa só vê as próprias conversas', async () => {
    const a = await (await conversas.GET(req('/api/whatsapp/conversas', DONO))).json()
    const b = await (await conversas.GET(req('/api/whatsapp/conversas', OUTRO))).json()
    expect(a.conversas.length).toBeGreaterThan(0)
    expect(b.conversas).toHaveLength(0)
    const id = a.conversas[0].id
    expect((await conversa.GET(req(`/api/whatsapp/conversas/${id}`, OUTRO), params(id))).status).toBe(404)
    expect((await conversa.POST(req(`/api/whatsapp/conversas/${id}`, OUTRO, { acao: 'resolver' }), params(id))).status).toBe(404)
    expect((await conversa.POST(req(`/api/whatsapp/conversas/${id}`, OUTRO, { texto: 'oi' }), params(id))).status).toBe(400)
    expect((await conversa.GET(req(`/api/whatsapp/conversas/${id}`, DONO), params(id))).status).toBe(200)
  })

  it('sem login: 401', async () => {
    const r = await conversas.GET(new Request('http://localhost/api/whatsapp/conversas'))
    expect(r.status).toBe(401)
  })

  it('conexão nunca devolve o token', async () => {
    const r = await (await conexao.GET(req('/api/whatsapp/conexao', DONO))).json()
    expect(r.conectado).toBe(true)
    expect(JSON.stringify(r)).not.toContain('TOKEN-SIMULADO')
    expect(r.conexao.tokenCifrado).toBeUndefined()
  })

  it('atendente não muda o treino; dono muda', async () => {
    expect((await treino.PUT(req('/api/whatsapp/treino', ANA, { tom: 'x' }, 'PUT'))).status).toBe(403)
    const r = await treino.PUT(req('/api/whatsapp/treino', DONO, { tom: 'Bem direto' }, 'PUT'))
    expect(r.status).toBe(200)
    expect((await (await treino.GET(req('/api/whatsapp/treino', DONO))).json()).treino.tom).toBe('Bem direto')
    expect((await (await treino.GET(req('/api/whatsapp/treino', OUTRO))).json()).treino.tom).not.toBe('Bem direto')
  })

  it('webhook entrega cada número na sua empresa e a IA responde depois da rajada', async () => {
    const { webhookDeTexto, saidaSimulada } = await import('@/lib/integracoes/whatsapp')
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const corpo = webhookDeTexto({ phoneNumberId: 'PN-DEMO-OUTRA', de: '5521977776666', nome: 'Zé', texto: 'Oi, tudo bem?' })
    const r = await webhook.POST(new Request('http://localhost/api/whatsapp/webhook', { method: 'POST', body: JSON.stringify(corpo) }))
    expect(r.status).toBe(200)
    const b = await (await conversas.GET(req('/api/whatsapp/conversas', OUTRO))).json()
    expect(b.conversas.map((c: { nomeContato: string }) => c.nomeContato)).toEqual(['Zé'])
    const a = await (await conversas.GET(req('/api/whatsapp/conversas', DONO))).json()
    expect(a.conversas.some((c: { nomeContato: string }) => c.nomeContato === 'Zé')).toBe(false)
    // IA da outra empresa está desligada (sem treino): não responde
    const antes = saidaSimulada().length
    const p = depois.splice(0).map((f) => f())
    await vi.runAllTimersAsync()
    await Promise.all(p)
    vi.useRealTimers()
    expect(saidaSimulada().length).toBe(antes)
  })

  it('verificação GET do webhook', async () => {
    process.env.WHATSAPP_TOKEN_VERIFICACAO = 'tk'
    const ok = await webhook.GET(new Request('http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=tk&hub.challenge=42'))
    expect(await ok.text()).toBe('42')
    const nao = await webhook.GET(new Request('http://localhost/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=x&hub.challenge=42'))
    expect(nao.status).toBe(403)
  })

  it('simulador responde sem gravar agendamento', async () => {
    const r = await simulador.POST(req('/api/whatsapp/simulador', DONO, { falas: [{ de: 'cliente', texto: 'Tem estacionamento?' }] }))
    expect((await r.json()).baloes[0]).toContain('estacionamento')
    const r2 = await (await simulador.POST(req('/api/whatsapp/simulador', DONO, { falas: [{ de: 'cliente', texto: 'quero reclamar, absurdo' }] }))).json()
    expect(r2.humano).toBe('Reclamação')
  })

  it('métricas da empresa', async () => {
    const m = await (await metricas.GET(req('/api/whatsapp/metricas', DONO))).json()
    expect(m).toHaveProperty('conversasHoje')
    expect(m.esperandoHumano).toBeGreaterThanOrEqual(1)
  })
})
