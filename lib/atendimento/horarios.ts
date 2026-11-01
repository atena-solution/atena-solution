// Horários livres para a IA oferecer e conferir antes de marcar.
// Usa a Agenda da Base (lib/agenda/horarios.ts) por profissional e junta tudo para o serviço.

import { horariosLivres, temConflito, verificarHorario, STATUS_QUE_OCUPAM } from '@/lib/agenda/horarios'
import type { Agendamento, HorarioDia, Profissional, Servico } from './tipos'
import { MINUTO } from './tempo'

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

export function ocupa(ag: Pick<Agendamento, 'status'>): boolean {
  return STATUS_QUE_OCUPAM.includes(ag.status)
}

/** Dois intervalos [a1,a2) e [b1,b2) se cruzam? */
export function cruza(a1: number, a2: number, b1: number, b2: number): boolean {
  return a1 < b2 && b1 < a2
}

/** Profissionais que fazem o serviço (sem serviços cadastrados = faz tudo). */
export function profissionaisDoServico(servico: Servico, profissionais: Profissional[], profissionalId?: string): Profissional[] {
  return profissionais
    .filter((p) => !p.servicosIds?.length || p.servicosIds.includes(servico.id))
    .filter((p) => !profissionalId || p.id === profissionalId)
}

export function calcularHorariosLivres(e: EntradaHorarios): Vaga[] {
  const porInicio = new Map<string, Vaga>()
  for (const p of profissionaisDoServico(e.servico, e.profissionais, e.profissionalId)) {
    const inicios = horariosLivres({
      data: e.dia,
      fuso: e.fuso,
      duracaoMin: e.servico.duracaoMin,
      horariosEmpresa: e.horariosEmpresa,
      profissional: p,
      agendamentos: e.agendamentos,
      passoMin: e.passoMin ?? 30,
      agora: e.agora,
      antecedenciaMin: e.antecedenciaMin ?? 60,
    })
    for (const inicio of inicios) {
      // um horário só aparece uma vez (fica com o primeiro profissional livre)
      if (!porInicio.has(inicio))
        porInicio.set(inicio, { inicio, fim: new Date(Date.parse(inicio) + e.servico.duracaoMin * MINUTO).toISOString(), profissionalId: p.id })
    }
  }
  return [...porInicio.values()].sort((a, b) => a.inicio.localeCompare(b.inicio))
}

/** Confere se dá pra marcar exatamente esse início. Devolve o profissional escolhido ou o motivo da recusa. */
export function conferirHorario(
  e: Omit<EntradaHorarios, 'dia'> & { inicio: Date; dia: string; ignorarAgendamentoId?: string },
): { ok: true; profissionalId: string; fim: Date } | { ok: false; motivo: string } {
  if (Number.isNaN(e.inicio.getTime())) return { ok: false, motivo: 'Data/hora inválida.' }
  if (e.inicio.getTime() < e.agora.getTime() + (e.antecedenciaMin ?? 60) * MINUTO)
    return { ok: false, motivo: 'Esse horário já passou ou está muito em cima.' }
  const candidatos = profissionaisDoServico(e.servico, e.profissionais, e.profissionalId)
  if (!candidatos.length) return { ok: false, motivo: 'Nenhum profissional faz esse serviço.' }
  const fim = new Date(e.inicio.getTime() + e.servico.duracaoMin * MINUTO)
  let motivo = 'Fora do horário de atendimento.'
  for (const p of candidatos) {
    const v = verificarHorario({
      inicio: e.inicio.toISOString(),
      duracaoMin: e.servico.duracaoMin,
      fuso: e.fuso,
      horariosEmpresa: e.horariosEmpresa,
      profissional: p,
      servicoId: e.servico.id,
      agendamentos: e.agendamentos,
      agora: e.agora,
      ignorarId: e.ignorarAgendamentoId,
    })
    if (v.ok) return { ok: true, profissionalId: p.id, fim }
    if (v.motivo.includes('ocupado')) motivo = v.motivo
  }
  return { ok: false, motivo }
}

export { temConflito }
