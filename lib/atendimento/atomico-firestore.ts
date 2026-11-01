// Operações atômicas no Firestore (Admin SDK) para o Atendimento.
// Doc (consultada em 01/11/2026, firebase.google.com/docs/firestore/manage-data/add-data e /transactions):
// - DocumentReference.create() falha com ALREADY_EXISTS (código gRPC 6) se o documento já existir.
// - Trava simples: documento com validade; quem não consegue criar espera e tenta de novo.
// CONFIRMAR AO VIVO: comportamento com várias funções da Vercel ao mesmo tempo.

import 'server-only'
import { firestoreAdmin } from '@/lib/integracoes/firebase-admin'
import type { Atomico } from './repo-banco'

const VALIDADE_TRAVA_MS = 15_000
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))

function jaExiste(e: unknown) {
  const c = (e as { code?: number | string }).code
  return c === 6 || c === 'already-exists' || c === 'ALREADY_EXISTS'
}

export function atomicoFirestore(): Atomico {
  const db = firestoreAdmin()
  return {
    async criarSeNaoExiste(caminho, dados) {
      try {
        await db.doc(caminho).create(JSON.parse(JSON.stringify(dados)))
        return true
      } catch (e) {
        if (jaExiste(e)) return false
        throw e
      }
    },
    async comTrava(caminho, fn) {
      const ref = db.doc(caminho)
      for (let tentativa = 0; tentativa < 40; tentativa++) {
        try {
          await ref.create({ ate: Date.now() + VALIDADE_TRAVA_MS })
          try {
            return await fn()
          } finally {
            await ref.delete().catch(() => undefined)
          }
        } catch (e) {
          if (!jaExiste(e)) throw e
          const atual = (await ref.get()).data() as { ate?: number } | undefined
          if (!atual?.ate || atual.ate < Date.now()) await ref.delete().catch(() => undefined) // trava vencida
          else await espera(150 + Math.random() * 150)
        }
      }
      throw new Error('Agenda ocupada, tente de novo.')
    },
  }
}
