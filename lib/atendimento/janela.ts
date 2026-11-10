// Janela de 24h da Meta (WhatsApp Cloud API).
// Doc oficial (consultada em 01/11/2026, developers.facebook.com/docs/whatsapp/pricing e
// .../cloud-api/guides/send-messages): depois que o cliente manda mensagem, a empresa tem 24h
// para responder com mensagem livre ("customer service window"). Fora dela, só modelo (template) aprovado.
// CONFIRMAR AO VIVO: o erro exato que a Meta devolve ao tentar texto livre fora da janela (131047).

import { HORA } from './tempo'

export const JANELA_MS = 24 * HORA

export interface EstadoJanela {
  aberta: boolean
  fechaEm: string | null
  restanteMs: number
}

export function janela24h(ultimaMsgClienteEm: string | undefined | null, agora: Date): EstadoJanela {
  if (!ultimaMsgClienteEm) return { aberta: false, fechaEm: null, restanteMs: 0 }
  const fecha = Date.parse(ultimaMsgClienteEm) + JANELA_MS
  const restante = fecha - agora.getTime()
  return { aberta: restante > 0, fechaEm: new Date(fecha).toISOString(), restanteMs: Math.max(0, restante) }
}

export type FormaEnvio = { forma: 'texto' } | { forma: 'modelo'; modelo: string } | { forma: 'bloqueado'; motivo: string }

/** Decide como dá pra falar com o cliente agora. */
export function formaDeEnvio(
  ultimaMsgClienteEm: string | undefined | null,
  agora: Date,
  modeloSeFechada?: string,
): FormaEnvio {
  if (janela24h(ultimaMsgClienteEm, agora).aberta) return { forma: 'texto' }
  if (modeloSeFechada) return { forma: 'modelo', modelo: modeloSeFechada }
  return {
    forma: 'bloqueado',
    motivo: 'Passaram 24h desde a última mensagem do cliente. Só dá pra mandar um modelo aprovado pela Meta.',
  }
}
