import { describe, expect, it } from 'vitest'
import { calcularHorariosLivres, conferirHorario } from '@/lib/atendimento/horarios'
import { FUSO, ag, ana, barba, corte, horariosSemana, joao } from './fixtures'

const agora = new Date('2026-11-02T12:00:00Z') // segunda 09:00 SP

describe('horários livres', () => {
  it('oferece horários dentro do expediente, a cada 30 min', () => {
    const vagas = calcularHorariosLivres({
      servico: corte, profissionais: [joao], agendamentos: [], horariosEmpresa: horariosSemana,
      fuso: FUSO, dia: '2026-11-03', agora,
    })
    expect(vagas[0].inicio).toBe('2026-11-03T12:00:00.000Z') // 09:00
    expect(vagas.at(-1)!.inicio).toBe('2026-11-03T20:30:00.000Z') // 17:30 (termina 18:00)
    expect(vagas).toHaveLength(18)
  })
  it('não oferece horário ocupado nem domingo', () => {
    const vagas = calcularHorariosLivres({
      servico: corte, profissionais: [joao],
      agendamentos: [ag({ id: 'a1', inicio: '2026-11-03T12:00:00.000Z', fim: '2026-11-03T12:30:00.000Z' })],
      horariosEmpresa: horariosSemana, fuso: FUSO, dia: '2026-11-03', agora,
    })
    expect(vagas.map((v) => v.inicio)).not.toContain('2026-11-03T12:00:00.000Z')
    expect(calcularHorariosLivres({ servico: corte, profissionais: [joao], agendamentos: [], horariosEmpresa: horariosSemana, fuso: FUSO, dia: '2026-11-08', agora })).toHaveLength(0)
  })
  it('cancelado libera o horário; outro profissional cobre o ocupado', () => {
    const vagas = calcularHorariosLivres({
      servico: corte, profissionais: [joao, ana],
      agendamentos: [ag({ id: 'a1', inicio: '2026-11-03T12:00:00.000Z', fim: '2026-11-03T12:30:00.000Z' })],
      horariosEmpresa: horariosSemana, fuso: FUSO, dia: '2026-11-03', agora,
    })
    expect(vagas[0]).toMatchObject({ inicio: '2026-11-03T12:00:00.000Z', profissionalId: 'ana' })
  })
  it('respeita antecedência mínima no próprio dia', () => {
    const vagas = calcularHorariosLivres({ servico: corte, profissionais: [joao], agendamentos: [], horariosEmpresa: horariosSemana, fuso: FUSO, dia: '2026-11-02', agora })
    expect(vagas[0].inicio).toBe('2026-11-02T13:00:00.000Z') // 10:00 (1h depois de agora)
  })
  it('só profissionais que fazem o serviço', () => {
    const vagas = calcularHorariosLivres({ servico: barba, profissionais: [joao, ana], agendamentos: [], horariosEmpresa: horariosSemana, fuso: FUSO, dia: '2026-11-03', agora })
    expect(new Set(vagas.map((v) => v.profissionalId))).toEqual(new Set(['joao']))
  })
})

describe('conferir horário antes de marcar', () => {
  const base = { servico: corte, profissionais: [joao], horariosEmpresa: horariosSemana, fuso: FUSO, agora, dia: '2026-11-03' }
  it('recusa horário ocupado', () => {
    const r = conferirHorario({ ...base, inicio: new Date('2026-11-03T12:15:00Z'),
      agendamentos: [ag({ id: 'a1', inicio: '2026-11-03T12:00:00.000Z', fim: '2026-11-03T12:30:00.000Z' })] })
    expect(r).toEqual({ ok: false, motivo: 'Esse horário já está ocupado.' })
  })
  it('recusa fora do expediente e no passado', () => {
    expect(conferirHorario({ ...base, inicio: new Date('2026-11-03T21:45:00Z'), agendamentos: [] }).ok).toBe(false)
    expect(conferirHorario({ ...base, dia: '2026-11-02', inicio: new Date('2026-11-02T11:00:00Z'), agendamentos: [] }).ok).toBe(false)
  })
  it('aceita horário livre e ignora o próprio agendamento ao remarcar', () => {
    const existente = ag({ id: 'a1', inicio: '2026-11-03T12:00:00.000Z', fim: '2026-11-03T12:30:00.000Z' })
    const r = conferirHorario({ ...base, inicio: new Date('2026-11-03T12:00:00Z'), agendamentos: [existente], ignorarAgendamentoId: 'a1' })
    expect(r.ok).toBe(true)
  })
})
