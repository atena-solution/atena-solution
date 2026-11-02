// Trava simples no Firestore (Admin SDK): documento com validade criado com create().
// Doc (consultada em 01/11/2026, firebase.google.com/docs/firestore/manage-data/add-data):
// DocumentReference.create() falha com ALREADY_EXISTS (código gRPC 6) se o documento já existir.
// CONFIRMAR AO VIVO: várias funções da Vercel ao mesmo tempo.
import 'server-only';
import { firestoreAdmin } from '../integracoes/firebase-admin';

const VALIDADE_TRAVA_MS = 15_000;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function jaExiste(e: unknown) {
  const c = (e as { code?: number | string }).code;
  return c === 6 || c === 'already-exists' || c === 'ALREADY_EXISTS';
}

export function travaFirestore() {
  const db = firestoreAdmin();
  return {
    async comTrava<T>(caminho: string, fn: () => Promise<T>): Promise<T> {
      const ref = db.doc(caminho);
      for (let tentativa = 0; tentativa < 40; tentativa++) {
        try {
          await ref.create({ ate: Date.now() + VALIDADE_TRAVA_MS });
        } catch (e) {
          if (!jaExiste(e)) throw e;
          const atual = (await ref.get()).data() as { ate?: number } | undefined;
          if (!atual?.ate || atual.ate < Date.now()) await ref.delete().catch(() => undefined); // trava vencida
          else await espera(150 + Math.random() * 150);
          continue;
        }
        try {
          return await fn();
        } finally {
          await ref.delete().catch(() => undefined);
        }
      }
      throw new Error('Agenda ocupada, tente de novo.');
    },
  };
}
