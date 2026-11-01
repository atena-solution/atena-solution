// Horários livres para a IA oferecer e conferir antes de marcar.
// A sessão A também terá `horariosLivres(...)` na Agenda; na junção, usar uma só (esta segue o mesmo contrato).

import type { Agendamento, HorarioDia, Profissional, Servico } from './tipos'
import { MINUTO, diaSemanaDe, instanteLocal, minutosDe } from './tempo'

export interface Vaga {
  inicio: string // ISO
  fim: string // ISO
  profissionalId: string
}

export interface EntradaHorarios {
  servico: Servico
  profissionais: Profissional[]
  agendamentos: Agendamento[]
  horariosEmpresa: HorarioDia[]
  fuso: string
  dia: string // 'YYYY-MM-DD' local
  agora: Date
  /** De quanto em quanto tempo oferecer horários. Padrão 30 min. */
  passoMin?: number
  /** Antecedência mínima pra marcar. Padrão 60 min. */
  antecedenciaMin?: number
  profissionalId?: string
}

const OCUPA: Agendamento['status'][] = ['marcado', 'confirmado', 'compareceu']

export function ocupa(ag: Agendamento): boolean {
  return OCUPA.includes(ag.status)
}

/** Dois intervalos [a1,a2) e [b1,b2) se cruzam? */
export function cruza(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && b1 < a2
}

export function profissionalLivre(
  profissionalId: string,
  inicio: Date,
  fim: Date,
  agendamentos: Agendamento[],
  ignorarId?: string,
): boolean {
  return !agendamentos.some(
    (ag) =>
      ag.profissionalId === profissionalId &&
      ag.id !== ignorarId &&
      ocupa(ag) &&
      cruza(inicio.getTime(), fim.getTime(), Date.parse(ag.inicio), Date.parse(ag.fim)),
  )
}

function expediente(p: Profissional, horariosEmpresa: HorarioDia[], diaSemana: number): HorarioDia[] {
  const proprios = p.horarios?.length ? p.horarios : horariosEmpresa
  return proprios.filter((h) => h.dia === diaSemana)
}

/** Profissionais que fazem o serviço (se nenhum estiver ligado ao serviço, todos fazem). */
export function profissionaisDoServico(servico: Servico, profissionais: Profissional[]): Profissional[] {
  const ligados = profissionais.filter((p) => p.servicosIds?.includes(servico.id))
  return ligados.length ? ligados : profissionais
}

export function calcularHorariosLivres(e: EntradaHorarios): Vaga[] {
  const passo = e.passoMin ?? 30
  const antecedencia = (e.antecedenciaMin ?? 60) * MINUTO
  const diaSemana = diaSemanaDe(e.dia)
  const limite = e.agora.getTime() + antecedencia
  let candidatos = profissionaisDoServico(e.servico, e.profissionais)
  if (e.profissionalId) candidatos = candidatos.filter((p) => p.id === e.profissionalId)

  const porInicio = new Map<string, Vaga>()
  for (const p of candidatos) {
    for (const faixa of expediente(p, e.horariosEmpresa, diaSemana)) {
      const fimFaixa = minutosDe(faixa.fecha)
      for (let m = minutosDe(faixa.abre); m + e.servico.duracaoMin <= fimFaixa; m += passo) {
        const hhmm = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
        const inicio = instanteLocal(e.dia, hhmm, e.fuso)
        if (inicio.getTime() < limite) continue
        const fim = new Date(inicio.getTime() + e.servico.duracaoMin * MINUTO)
        if (!profissionalLivre(p.id, inicio, fim, e.agendamentos)) continue
        const chave = inicio.toISOString()
        // um horário só aparece uma vez (fica com o primeiro profissional livre)
        if (!porInicio.has(chave)) porInicio.set(chave, { inicio: chave, fim: fim.toISOString(), profissionalId: p.id })
      }
    }
  }
  return [...porInicio.values()].sort((a, b) => a.inicio.localeCompare(b.inicio))
}

/**
 * Confere se dá pra marcar exatamente esse início. Devolve o profissional escolhido ou o motivo da recusa.
 */
export function conferirHorario(
  e: Omit<EntradaHorarios, 'dia'> & { inicio: Date; dia: string; ignorarAgendamentoId?: string },
): { ok: true; profissionalId: string; fim: Date } | { ok: false; motivo: string } {
  if (Number.isNaN(e.inicio.getTime())) return { ok: false, motivo: 'Data/hora inválida.' }
  const antecedencia = (e.antecedenciaMin ?? 60) * MINUTO
  if (e.inicio.getTime() < e.agora.getTime() + antecedencia)
    return { ok: false, motivo: 'Esse horário já passou ou está muito em cima.' }
  const fim = new Date(e.inicio.getTime() + e.servico.duracaoMin * MINUTO)
  const diaSemana = diaSemanaDe(e.dia)
  let candidatos = profissionaisDoServico(e.servico, e.profissionais)
  if (e.profissionalId) candidatos = candidatos.filter((p) => p.id === e.profissionalId)
  if (!candidatos.length) return { ok: false, motivo: 'Nenhum profissional faz esse serviço.' }

  const agendamentos = e.agendamentos.filter((a) => a.id !== e.ignorarAgendamentoId)
  let dentroDoExpediente = false
  for (const p of candidatos) {
    const noExpediente = expediente(p, e.horariosEmpresa, diaSemana).some((f) => {
      const abre = instanteLocal(e.dia, f.abre, e.fuso).getTime()
      const fecha = instanteLocal(e.dia, f.fecha, e.fuso).getTime()
      return e.inicio.getTime() >= abre && fim.getTime() <= fecha
    })
    if (!noExpediente) continue
    dentroDoExpediente = true
    if (profissionalLivre(p.id, e.inicio, fim, agendamentos)) return { ok: true, profissionalId: p.id, fim }
  }
  return {
    ok: false,
    motivo: dentroDoExpediente ? 'Esse horário já está ocupado.' : 'Fora do horário de atendimento.',
  }
}
