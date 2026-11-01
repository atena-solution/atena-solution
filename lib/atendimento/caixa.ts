// Caixa de entrada: filtros, ordem e selo de tempo sem resposta (puras).

import type { Conversa } from './tipos'
import { MINUTO, duracaoCurta } from './tempo'

export type Filtro = 'abertas' | 'humano' | 'minhas' | 'resolvidas'

export const FILTROS: { id: Filtro; nome: string }[] = [
  { id: 'abertas', nome: 'Abertas' },
  { id: 'humano', nome: 'Precisa de humano' },
  { id: 'minhas', nome: 'Minhas' },
  { id: 'resolvidas', nome: 'Resolvidas' },
]

export function passaNoFiltro(c: Conversa, filtro: Filtro, uid?: string): boolean {
  switch (filtro) {
    case 'abertas':
      return c.status === 'aberta'
    case 'humano':
      return c.status === 'aberta' && c.precisaHumano
    case 'minhas':
      return c.status === 'aberta' && !!uid && c.responsavelUid === uid
    case 'resolvidas':
      return c.status === 'resolvida'
  }
}

/** Precisa de humano primeiro; depois quem espera há mais tempo; depois mais recentes. */
export function ordenarConversas(lista: Conversa[]): Conversa[] {
  return [...lista].sort((a, b) => {
    if (a.precisaHumano !== b.precisaHumano) return a.precisaHumano ? -1 : 1
    const ea = a.aguardandoDesde ? Date.parse(a.aguardandoDesde) : Infinity
    const eb = b.aguardandoDesde ? Date.parse(b.aguardandoDesde) : Infinity
    if (ea !== eb) return ea - eb
    return b.ultimaMensagem.em.localeCompare(a.ultimaMensagem.em)
  })
}

export function filtrarConversas(lista: Conversa[], filtro: Filtro, uid?: string, busca?: string): Conversa[] {
  const b = busca?.trim().toLowerCase()
  return ordenarConversas(
    lista.filter(
      (c) =>
        passaNoFiltro(c, filtro, uid) &&
        (!b || c.nomeContato.toLowerCase().includes(b) || c.telefone.includes(b.replace(/\D/g, '') || '§')),
    ),
  )
}

export function contarPorFiltro(lista: Conversa[], uid?: string): Record<Filtro, number> {
  return {
    abertas: lista.filter((c) => passaNoFiltro(c, 'abertas', uid)).length,
    humano: lista.filter((c) => passaNoFiltro(c, 'humano', uid)).length,
    minhas: lista.filter((c) => passaNoFiltro(c, 'minhas', uid)).length,
    resolvidas: lista.filter((c) => passaNoFiltro(c, 'resolvidas', uid)).length,
  }
}

export interface Selo {
  texto: string
  nivel: 'ok' | 'atencao' | 'urgente'
}

/** Selo "sem resposta há X". null quando não há cliente esperando. */
export function seloSemResposta(aguardandoDesde: string | null | undefined, agora: Date): Selo | null {
  if (!aguardandoDesde) return null
  const ms = agora.getTime() - Date.parse(aguardandoDesde)
  const nivel = ms >= 15 * MINUTO ? 'urgente' : ms >= 5 * MINUTO ? 'atencao' : 'ok'
  return { texto: duracaoCurta(Math.max(0, ms)), nivel }
}
