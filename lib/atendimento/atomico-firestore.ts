// Operações atômicas no Firestore (Admin SDK) para o Atendimento.
// Doc (consultada em 01/11/2026, firebase.google.com/docs/firestore/manage-data/add-data e /transactions):
// - DocumentReference.create() falha com ALREADY_EXISTS (código gRPC 6) se o documento já existir.
// - Trava simples: documento com validade; quem não consegue criar espera e tenta de novo.
// CONFIRMAR AO VIVO: comportamento com várias funções da Vercel ao mesmo tempo.

import 'server-only'
import { firestoreAdmin } from '@/lib/integracoes/firebase-admin'
import type { Atomico } from './repo-banco'
import { jaExiste, travaFirestore } from '@/lib/dados/trava-firestore'

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
    // mesma trava da agenda da Base (lib/agenda/trava.ts)
    comTrava: (caminho, fn) => travaFirestore().comTrava(caminho, fn),
  }
}
