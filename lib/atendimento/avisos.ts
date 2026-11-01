// Avisos pra equipe: cliente esperando humano há mais de X minutos (pura).

import type { Conversa, Membro } from './tipos'
import { MINUTO } from './tempo'

export interface Aviso {
  conversaId: string
  uids: string[]
  titulo: string
  corpo: string
}

/** Repetir o aviso, no máximo, a cada 30 min por conversa. */
export const REPETIR_AVISO_MS = 30 * MINUTO

export function decidirAvisos(p: {
  conversas: Conversa[]
  membros: Membro[]
  agora: Date
  minutos: number
}): Aviso[] {
  const agora = p.agora.getTime()
  const ativos = p.membros.filter((m) => m.ativo)
  const chefes = ativos.filter((m) => m.papel === 'dono' || m.papel === 'gestor' || m.papel === 'atendente')
  const avisos: Aviso[] = []
  for (const c of p.conversas) {
    if (c.status !== 'aberta' || !c.precisaHumano || !c.aguardandoDesde) continue
    const esperaMs = agora - Date.parse(c.aguardandoDesde)
    if (esperaMs < p.minutos * MINUTO) continue
    if (c.avisadoEm && agora - Date.parse(c.avisadoEm) < REPETIR_AVISO_MS) continue
    const responsavel = c.responsavelUid && ativos.find((m) => m.uid === c.responsavelUid)
    const uids = responsavel ? [responsavel.uid] : chefes.map((m) => m.uid)
    if (!uids.length) continue
    const min = Math.floor(esperaMs / MINUTO)
    avisos.push({
      conversaId: c.id,
      uids,
      titulo: `${c.nomeContato || c.telefone} está esperando`,
      corpo: `Há ${min} min sem resposta${c.motivoHumano ? ` · ${c.motivoHumano}` : ''}. Toque pra assumir.`,
    })
  }
  return avisos
}
