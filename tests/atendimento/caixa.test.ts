import { describe, expect, it } from 'vitest'
import { contarPorFiltro, filtrarConversas, seloSemResposta } from '@/lib/atendimento/caixa'
import { calcularMetricas } from '@/lib/atendimento/metricas'
import { cifrar, decifrar, mascarar } from '@/lib/atendimento/cripto'
import type { Conversa } from '@/lib/atendimento/tipos'

const c = (p: Partial<Conversa> & { id: string }): Conversa => ({
  empresaId: 'e1', contatoId: 'c', telefone: '5511999', nomeContato: 'X', status: 'aberta', modo: 'ia', precisaHumano: false,
  ultimaMensagem: { texto: '', de: 'cliente', em: '2026-11-02T12:00:00.000Z' }, iaDigitando: false, naoLidas: 0, houveHumano: false,
  criadoEm: '2026-11-02T11:00:00.000Z', ...p,
})

describe('caixa de entrada', () => {
  const lista = [
    c({ id: '1' }),
    c({ id: '2', precisaHumano: true, aguardandoDesde: '2026-11-02T12:00:00.000Z' }),
    c({ id: '3', responsavelUid: 'u1', modo: 'humano' }),
    c({ id: '4', status: 'resolvida' }),
  ]
  it('filtros', () => {
    expect(filtrarConversas(lista, 'abertas').map((x) => x.id)).toEqual(['2', '1', '3'])
    expect(filtrarConversas(lista, 'humano').map((x) => x.id)).toEqual(['2'])
    expect(filtrarConversas(lista, 'minhas', 'u1').map((x) => x.id)).toEqual(['3'])
    expect(filtrarConversas(lista, 'resolvidas').map((x) => x.id)).toEqual(['4'])
    expect(contarPorFiltro(lista, 'u1')).toEqual({ abertas: 3, humano: 1, minhas: 1, resolvidas: 1 })
  })
  it('selo de tempo sem resposta', () => {
    const agora = new Date('2026-11-02T12:20:00Z')
    expect(seloSemResposta(null, agora)).toBeNull()
    expect(seloSemResposta('2026-11-02T12:18:00.000Z', agora)).toEqual({ texto: '2 min', nivel: 'ok' })
    expect(seloSemResposta('2026-11-02T12:14:00.000Z', agora)?.nivel).toBe('atencao')
    expect(seloSemResposta('2026-11-02T12:00:00.000Z', agora)?.nivel).toBe('urgente')
  })
})

describe('métricas', () => {
  it('conversas hoje, 1ª resposta, agendamentos da IA, % sem humano', () => {
    const m = calcularMetricas({
      deISO: '2026-11-02T03:00:00.000Z', ateISO: '2026-11-03T03:00:00.000Z',
      conversas: [
        c({ id: '1', ultimaMsgClienteEm: '2026-11-02T12:00:00.000Z', primeiraRespostaMs: 10_000, status: 'resolvida', resolvidaEm: '2026-11-02T13:00:00.000Z' }),
        c({ id: '2', ultimaMsgClienteEm: '2026-11-02T14:00:00.000Z', primeiraRespostaMs: 20_000, status: 'resolvida', resolvidaEm: '2026-11-02T15:00:00.000Z', houveHumano: true }),
        c({ id: '3', criadoEm: '2026-10-01T00:00:00.000Z', ultimaMsgClienteEm: '2026-10-01T00:00:00.000Z' }),
      ],
      agendamentos: [
        { id: 'a', contatoId: 'c', servicoId: 's', profissionalId: 'p', inicio: '', fim: '', status: 'marcado', criadoPor: 'ia', lembretes: {}, criadoEm: '2026-11-02T12:01:00.000Z' },
        { id: 'b', contatoId: 'c', servicoId: 's', profissionalId: 'p', inicio: '', fim: '', status: 'marcado', criadoPor: 'uid1', lembretes: {}, criadoEm: '2026-11-02T12:01:00.000Z' },
      ],
    })
    expect(m).toEqual({ conversasHoje: 2, tempoMedioPrimeiraRespostaSeg: 15, agendamentosPelaIA: 1, pctResolvidoSemHumano: 50, esperandoHumano: 0 })
  })
})

describe('token cifrado', () => {
  const chave = Buffer.alloc(32, 7).toString('base64')
  it('cifra e decifra; não guarda em texto puro', () => {
    const x = cifrar('EAAGsegredo123', chave)
    expect(x).not.toContain('segredo')
    expect(decifrar(x, chave)).toBe('EAAGsegredo123')
    expect(() => decifrar(x, Buffer.alloc(32, 8).toString('base64'))).toThrow()
    expect(mascarar('EAAGsegredo123')).toBe('EAAG…o123')
  })
})

import { validarTreino, preencherMensagemRapida } from '@/lib/atendimento/treino'
import { treinoPadrao } from '@/lib/atendimento/repositorio'

describe('treinar a IA', () => {
  it('valida e limpa', () => {
    const r = validarTreino({ ...treinoPadrao('e1'), perguntas: [{ pergunta: ' Abre sábado? ', resposta: 'Sim, até 13h' }, { pergunta: '', resposta: '' }], mensagensRapidas: [{ atalho: '/Pix', texto: 'Chave pix: 123' }] })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.treino.perguntas).toEqual([{ pergunta: 'Abre sábado?', resposta: 'Sim, até 13h' }])
      expect(r.treino.mensagensRapidas[0].atalho).toBe('pix')
    }
  })
  it('aponta erros', () => {
    const r = validarTreino({ ...treinoPadrao('e1'), nomeAssistente: '', perguntas: [{ pergunta: 'x', resposta: '' }], linkAvaliacao: 'g.page', avisoHumanoMin: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erros).sort()).toEqual(['avisoHumanoMin', 'linkAvaliacao', 'nomeAssistente', 'perguntas.0'])
  })
  it('mensagem rápida com variáveis', () => {
    expect(preencherMensagemRapida('Fica na {endereco}', { endereco: 'Rua A, 1' })).toBe('Fica na Rua A, 1')
  })
})
