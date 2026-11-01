// Rajada: cliente manda várias mensagens seguidas → a IA responde uma vez só.
// Cada mensagem agenda um processamento para ~8s depois. Na hora, só responde quem ainda é a
// última mensagem do cliente; as anteriores são descartadas (a última responde por todas).

export const ESPERA_RAJADA_MS = 8_000

export type DecisaoRajada =
  | { acao: 'responder' }
  | { acao: 'esperar'; ms: number }
  | { acao: 'descartar'; motivo: string }

export function decidirRajada(p: {
  gatilhoMsgId: string
  ultimaMsgClienteId?: string
  ultimaMsgClienteEm?: string
  /** Já respondido depois dessa mensagem (ex.: humano respondeu)? */
  aguardandoDesde?: string | null
  agora: Date
  esperaMs?: number
}): DecisaoRajada {
  const espera = p.esperaMs ?? ESPERA_RAJADA_MS
  if (!p.ultimaMsgClienteId || p.ultimaMsgClienteId !== p.gatilhoMsgId)
    return { acao: 'descartar', motivo: 'chegou mensagem mais nova' }
  if (!p.aguardandoDesde) return { acao: 'descartar', motivo: 'já respondida' }
  const ultima = Date.parse(p.ultimaMsgClienteEm ?? p.aguardandoDesde)
  const falta = ultima + espera - p.agora.getTime()
  if (falta > 0) return { acao: 'esperar', ms: falta }
  return { acao: 'responder' }
}
