import { describe, expect, it } from 'vitest'
import { detectarAssuntoSensivel, interpretarConfirmacao, normalizarTelefone, primeiroNome, quebrarEmBaloes } from '@/lib/atendimento/regras'
import { decidirRajada } from '@/lib/atendimento/rajada'
import { formaDeEnvio, janela24h } from '@/lib/atendimento/janela'

describe('assunto sensível → humano', () => {
  it('detecta reclamação, jurídico, reembolso e pedido de humano', () => {
    expect(detectarAssuntoSensivel('Que absurdo, fui muito mal atendido')).toBe('Reclamação')
    expect(detectarAssuntoSensivel('vou no PROCON')).toBe('Assunto jurídico')
    expect(detectarAssuntoSensivel('quero o reembolso')).toBe('Dinheiro devolvido')
    expect(detectarAssuntoSensivel('quero falar com um atendente')).toBe('Cliente pediu pra falar com a equipe')
  })
  it('regras da empresa', () => {
    expect(detectarAssuntoSensivel('vocês fazem orçamento de festa?', ['orçamento de festa'])).toMatch(/Regra da empresa/)
  })
  it('mensagem comum passa', () => {
    expect(detectarAssuntoSensivel('oi, tem horário amanhã?')).toBeNull()
  })
})

describe('confirmação por resposta', () => {
  it.each([['SIM', 'sim'], ['Sim!', 'sim'], ['confirmo', 'sim'], ['não', 'nao'], ['preciso remarcar', 'nao'], ['que horas abre?', null]])(
    '%s → %s', (t, r) => expect(interpretarConfirmacao(t)).toBe(r))
})

describe('balões', () => {
  it('no máximo 2 e negrito do WhatsApp', () => {
    expect(quebrarEmBaloes('**Oi!**\n\nTemos horário.\n\nQual prefere?')).toEqual(['*Oi!*', 'Temos horário.\n\nQual prefere?'])
    expect(quebrarEmBaloes('  ')).toEqual([])
  })
  it('nome e telefone', () => {
    expect(primeiroNome('MARIA silva')).toBe('Maria')
    expect(primeiroNome('5511999')).toBe('')
    expect(normalizarTelefone('(11) 98888-7777')).toBe('5511988887777')
  })
})

describe('rajada', () => {
  const t0 = '2026-11-02T12:00:00.000Z'
  it('espera 8s desde a última mensagem', () => {
    expect(decidirRajada({ gatilhoMsgId: 'm1', ultimaMsgClienteId: 'm1', ultimaMsgClienteEm: t0, aguardandoDesde: t0, agora: new Date('2026-11-02T12:00:03Z') }))
      .toEqual({ acao: 'esperar', ms: 5000 })
  })
  it('responde quando ainda é a última', () => {
    expect(decidirRajada({ gatilhoMsgId: 'm1', ultimaMsgClienteId: 'm1', ultimaMsgClienteEm: t0, aguardandoDesde: t0, agora: new Date('2026-11-02T12:00:08Z') }).acao).toBe('responder')
  })
  it('descarta se chegou mensagem mais nova ou já foi respondida', () => {
    expect(decidirRajada({ gatilhoMsgId: 'm1', ultimaMsgClienteId: 'm2', ultimaMsgClienteEm: t0, aguardandoDesde: t0, agora: new Date('2026-11-02T12:00:10Z') }).acao).toBe('descartar')
    expect(decidirRajada({ gatilhoMsgId: 'm1', ultimaMsgClienteId: 'm1', ultimaMsgClienteEm: t0, aguardandoDesde: null, agora: new Date('2026-11-02T12:00:10Z') }).acao).toBe('descartar')
  })
})

describe('janela de 24h', () => {
  const ultima = '2026-11-01T12:00:00.000Z'
  it('aberta até 24h depois da última mensagem do cliente', () => {
    expect(janela24h(ultima, new Date('2026-11-02T11:59:00Z')).aberta).toBe(true)
    expect(janela24h(ultima, new Date('2026-11-02T12:00:00Z')).aberta).toBe(false)
    expect(janela24h(undefined, new Date()).aberta).toBe(false)
  })
  it('fora da janela só modelo aprovado', () => {
    expect(formaDeEnvio(ultima, new Date('2026-11-01T13:00:00Z'))).toEqual({ forma: 'texto' })
    expect(formaDeEnvio(ultima, new Date('2026-11-03T13:00:00Z'), 'retomada')).toEqual({ forma: 'modelo', modelo: 'retomada' })
    expect(formaDeEnvio(ultima, new Date('2026-11-03T13:00:00Z')).forma).toBe('bloqueado')
  })
})
