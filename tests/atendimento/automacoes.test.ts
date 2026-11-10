import { describe, expect, it } from 'vitest'
import { agendamentoParaConfirmar, decidirAutomacoes, type EntradaAutomacoes } from '@/lib/atendimento/automacoes'
import { decidirAvisos } from '@/lib/atendimento/avisos'
import type { Contato, Conversa } from '@/lib/atendimento/tipos'
import { FUSO, ag, corte, treino } from './fixtures'

const contato: Contato = {
  id: 'c1', empresaId: 'e1', nome: 'carlos souza', telefone: '5511988887777', origem: 'whatsapp', etapa: 'agendado',
  etiquetas: [], ultimaInteracaoEm: '', criadoEm: '', campos: {},
}
// agendamento terça 03/11 14:00 SP = 17:00Z, criado bem antes
const a1 = ag({ id: 'a1', inicio: '2026-11-03T17:00:00.000Z', fim: '2026-11-03T17:30:00.000Z', criadoEm: '2026-10-25T12:00:00.000Z' })

function entrada(p: Partial<EntradaAutomacoes>): EntradaAutomacoes {
  return {
    agora: new Date(), fuso: FUSO, nomeEmpresa: 'Barbearia Topetes', agendamentos: [a1],
    contatos: new Map([['c1', contato]]), servicos: new Map([['corte', corte]]),
    ultimaMsgClientePorContato: new Map([['c1', '2026-11-02T15:00:00.000Z']]),
    jaFeitas: new Set(), treino: treino('e1'), modelos: { lembrete: 'lembrete_horario' }, ...p,
  }
}

describe('lembretes', () => {
  it('véspera com texto livre quando a janela está aberta, pedindo SIM', () => {
    const { acoes } = decidirAutomacoes(entrada({ agora: new Date('2026-11-02T18:00:00Z') })) // seg 15:00
    expect(acoes).toHaveLength(1)
    expect(acoes[0]).toMatchObject({ tipo: 'lembrete_vespera', forma: 'texto', chave: 'lembrete_vespera:a1' })
    expect(acoes[0].texto).toContain('Oi, Carlos!')
    expect(acoes[0].texto).toContain('SIM')
  })
  it('véspera com modelo aprovado quando a janela fechou', () => {
    const { acoes } = decidirAutomacoes(entrada({ agora: new Date('2026-11-02T18:00:00Z'), ultimaMsgClientePorContato: new Map() }))
    expect(acoes[0]).toMatchObject({ forma: 'modelo', modelo: { nome: 'lembrete_horario', idioma: 'pt_BR' } })
  })
  it('pula se não há modelo e a janela fechou', () => {
    const r = decidirAutomacoes(entrada({ agora: new Date('2026-11-02T18:00:00Z'), ultimaMsgClientePorContato: new Map(), modelos: {} }))
    expect(r.acoes).toHaveLength(0)
    expect(r.puladas[0].chave).toBe('lembrete_vespera:a1')
  })
  it('não manda duas vezes, nem de madrugada, nem cedo demais', () => {
    expect(decidirAutomacoes(entrada({ agora: new Date('2026-11-02T18:00:00Z'), jaFeitas: new Set(['lembrete_vespera:a1']) })).acoes).toHaveLength(0)
    expect(decidirAutomacoes(entrada({ agora: new Date('2026-11-03T02:00:00Z') })).acoes).toHaveLength(0) // 23h SP
    expect(decidirAutomacoes(entrada({ agora: new Date('2026-11-02T10:00:00Z') })).acoes).toHaveLength(0) // >24h antes
  })
  it('1h antes', () => {
    const { acoes } = decidirAutomacoes(entrada({ agora: new Date('2026-11-03T16:10:00Z'), jaFeitas: new Set(['lembrete_vespera:a1']) }))
    expect(acoes.map((a) => a.tipo)).toEqual(['lembrete_1h'])
  })
  it('cancelado não recebe lembrete', () => {
    const { acoes } = decidirAutomacoes(entrada({ agora: new Date('2026-11-02T18:00:00Z'), agendamentos: [{ ...a1, status: 'cancelado' }] }))
    expect(acoes).toHaveLength(0)
  })
  it('recupera quem faltou no mesmo dia', () => {
    const faltou = { ...a1, status: 'faltou' as const }
    const recente = new Map([['c1', '2026-11-03T12:00:00.000Z']])
    expect(decidirAutomacoes(entrada({ agora: new Date('2026-11-03T18:00:00Z'), agendamentos: [faltou], ultimaMsgClientePorContato: recente })).acoes[0].tipo).toBe('recuperar_falta')
    expect(decidirAutomacoes(entrada({ agora: new Date('2026-11-04T14:00:00Z'), agendamentos: [faltou], ultimaMsgClientePorContato: recente })).acoes).toHaveLength(0)
  })
  it('pede avaliação depois de comparecer', () => {
    const veio = { ...a1, status: 'compareceu' as const }
    const recente = new Map([['c1', '2026-11-03T12:00:00.000Z']])
    const { acoes } = decidirAutomacoes(entrada({ agora: new Date('2026-11-03T19:00:00Z'), agendamentos: [veio], ultimaMsgClientePorContato: recente }))
    expect(acoes[0].tipo).toBe('pedir_avaliacao')
    expect(acoes[0].texto).toContain('https://g.page/r/topetes')
    expect(decidirAutomacoes(entrada({ agora: new Date('2026-11-03T19:00:00Z'), agendamentos: [veio], ultimaMsgClientePorContato: recente, treino: treino('e1', { linkAvaliacao: '' }) })).acoes).toHaveLength(0)
  })
  it('automação desligada não manda', () => {
    const t = treino('e1', { automacoes: { lembreteVespera: false, lembreteUmaHora: false, recuperarFalta: false, pedirAvaliacao: false } })
    expect(decidirAutomacoes(entrada({ agora: new Date('2026-11-02T18:00:00Z'), treino: t })).acoes).toHaveLength(0)
  })
  it('SIM confirma o próximo agendamento marcado', () => {
    expect(agendamentoParaConfirmar([a1], 'c1', new Date('2026-11-02T18:00:00Z'))?.id).toBe('a1')
    expect(agendamentoParaConfirmar([a1], 'outro', new Date('2026-11-02T18:00:00Z'))).toBeNull()
  })
})

describe('avisos pra equipe', () => {
  const conversa = (p: Partial<Conversa>): Conversa => ({
    id: 'v1', empresaId: 'e1', contatoId: 'c1', telefone: '5511', nomeContato: 'Carlos', status: 'aberta', modo: 'ia',
    precisaHumano: true, ultimaMensagem: { texto: 'oi', de: 'cliente', em: '' }, aguardandoDesde: '2026-11-02T12:00:00.000Z',
    iaDigitando: false, naoLidas: 1, houveHumano: false, criadoEm: '', ...p,
  })
  const membros = [
    { uid: 'dono', email: '', nome: 'Lincoln', papel: 'dono' as const, ativo: true },
    { uid: 'vend', email: '', nome: 'V', papel: 'vendedor' as const, ativo: true },
    { uid: 'at', email: '', nome: 'A', papel: 'atendente' as const, ativo: true },
  ]
  it('avisa depois de X min, pro responsável ou pra equipe', () => {
    expect(decidirAvisos({ conversas: [conversa({})], membros, agora: new Date('2026-11-02T12:03:00Z'), minutos: 5 })).toHaveLength(0)
    const [a] = decidirAvisos({ conversas: [conversa({})], membros, agora: new Date('2026-11-02T12:06:00Z'), minutos: 5 })
    expect(a.uids).toEqual(['dono', 'at'])
    expect(decidirAvisos({ conversas: [conversa({ responsavelUid: 'at' })], membros, agora: new Date('2026-11-02T12:06:00Z'), minutos: 5 })[0].uids).toEqual(['at'])
  })
  it('não repete antes de 30 min', () => {
    expect(decidirAvisos({ conversas: [conversa({ avisadoEm: '2026-11-02T12:06:00.000Z' })], membros, agora: new Date('2026-11-02T12:20:00Z'), minutos: 5 })).toHaveLength(0)
  })
})
