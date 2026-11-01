import { describe, expect, it } from 'vitest'
import { descreverInstante, diaLocal, horaLocal, instanteLocal, somarDias, diaSemanaDe, duracaoCurta } from '@/lib/atendimento/tempo'

describe('tempo no fuso da empresa', () => {
  it('converte hora local de São Paulo para UTC (-03:00)', () => {
    expect(instanteLocal('2026-11-03', '09:00', 'America/Sao_Paulo').toISOString()).toBe('2026-11-03T12:00:00.000Z')
  })
  it('dia e hora locais', () => {
    const d = new Date('2026-11-04T02:30:00Z') // 23:30 do dia 03 em SP
    expect(diaLocal(d, 'America/Sao_Paulo')).toBe('2026-11-03')
    expect(horaLocal(d, 'America/Sao_Paulo')).toBe('23:30')
  })
  it('soma dias e dia da semana', () => {
    expect(somarDias('2026-11-30', 1)).toBe('2026-12-01')
    expect(diaSemanaDe('2026-11-01')).toBe(0)
  })
  it('descreve o instante em português', () => {
    expect(descreverInstante(new Date('2026-11-03T17:30:00Z'), 'America/Sao_Paulo')).toBe('terça, 03/nov às 14:30')
  })
  it('duração curta', () => {
    expect(duracaoCurta(10_000)).toBe('agora')
    expect(duracaoCurta(3 * 60_000)).toBe('3 min')
    expect(duracaoCurta(2 * 3600_000)).toBe('2 h')
  })
})
