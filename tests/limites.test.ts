import { describe, expect, it } from 'vitest'
import { decidirCoach, decidirConversa, limitesDaAssinatura } from '../lib/planos/limites'
import type { Assinatura } from '../lib/planos/acesso'

const agora = '2026-11-03T12:00:00.000Z'
const base: Assinatura = { empresaId: 'e1', planoId: 'atendimento', vendedores: 0, ciclo: 'mensal', criadoEm: agora, atualizadoEm: agora }

describe('limites do plano', () => {
  it('teste grátis tem limite próprio', () => {
    const l = limitesDaAssinatura({ ...base, testeAte: '2026-11-08T12:00:00.000Z' }, agora)
    expect(l).toEqual({ conversasMes: 50, segundosCoachMes: 2 * 3600 })
  })
  it('plano pago: 1.000 conversas; Coach 20 h por vendedor (mínimo os inclusos)', () => {
    const pago = { pagoAte: '2026-12-03T12:00:00.000Z' }
    expect(limitesDaAssinatura({ ...base, ...pago }, agora).conversasMes).toBe(1000)
    expect(limitesDaAssinatura({ ...base, ...pago, planoId: 'coach', vendedores: 3 }, agora).segundosCoachMes).toBe(60 * 3600)
    expect(limitesDaAssinatura({ ...base, ...pago, planoId: 'coach', vendedores: 0 }, agora).segundosCoachMes).toBe(20 * 3600)
    expect(limitesDaAssinatura({ ...base, ...pago, planoId: 'completo', vendedores: 1 }, agora).segundosCoachMes).toBe(60 * 3600)
  })
  it('conversa nova barrada no limite; a que já foi atendida no mês continua', () => {
    const l = { conversasMes: 2, segundosCoachMes: 0 }
    expect(decidirConversa(l, 1, false, false).permitido).toBe(true)
    expect(decidirConversa(l, 2, false, false)).toMatchObject({ permitido: false, motivo: 'limite' })
    expect(decidirConversa(l, 2, true, false).permitido).toBe(true)
  })
  it('Coach para quando acabam as horas', () => {
    const l = { conversasMes: 0, segundosCoachMes: 3600 }
    expect(decidirCoach(l, 3599, false).permitido).toBe(true)
    expect(decidirCoach(l, 3600, true)).toMatchObject({ permitido: false, motivo: 'limite' })
  })
})
