// Métricas do Atendimento para o cartão do Início (puras).

import type { Agendamento, Conversa } from './tipos'

export interface MetricasAtendimento {
  conversasHoje: number
  tempoMedioPrimeiraRespostaSeg: number | null
  agendamentosPelaIA: number
  pctResolvidoSemHumano: number | null
  esperandoHumano: number
}

export function calcularMetricas(p: {
  conversas: Conversa[]
  agendamentos: Agendamento[]
  /** Início e fim do dia local, em ISO. */
  deISO: string
  ateISO: string
}): MetricasAtendimento {
  const noPeriodo = (iso?: string) => !!iso && iso >= p.deISO && iso < p.ateISO
  const hoje = p.conversas.filter((c) => noPeriodo(c.ultimaMsgClienteEm) || noPeriodo(c.criadoEm))
  const tempos = hoje.map((c) => c.primeiraRespostaMs).filter((n): n is number => typeof n === 'number')
  const resolvidas = p.conversas.filter((c) => c.status === 'resolvida' && noPeriodo(c.resolvidaEm))
  return {
    conversasHoje: hoje.length,
    tempoMedioPrimeiraRespostaSeg: tempos.length
      ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length / 1000)
      : null,
    agendamentosPelaIA: p.agendamentos.filter((a) => a.criadoPor === 'ia' && noPeriodo(a.criadoEm)).length,
    pctResolvidoSemHumano: resolvidas.length
      ? Math.round((resolvidas.filter((c) => !c.houveHumano).length / resolvidas.length) * 100)
      : null,
    esperandoHumano: p.conversas.filter((c) => c.status === 'aberta' && c.precisaHumano).length,
  }
}
