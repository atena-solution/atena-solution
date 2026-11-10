// Repositório do Coach no Firestore (Admin SDK, só no servidor).
// Caminhos: empresas/{empresaId}/reunioes/{id} e empresas/{empresaId}/coach/{roteiro|config}.
// Índices compostos necessários (firestore.indexes.json, sessão A):
//   reunioes: vendedorUid ASC + criadoEm DESC; contatoId ASC + criadoEm DESC.
// CONFIRMAR AO VIVO: criação dos índices e tamanho do documento (falas dentro da reunião; 1 h ≈ 80 KB, limite 1 MB).
import type { Firestore } from 'firebase-admin/firestore';
import type { ConfigCoach, Reuniao, Roteiro } from './tipos';
import { caminhos, type RepositorioCoach } from './repositorio';

/** Firestore não aceita `undefined`: limpa antes de gravar. */
function limpo<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

export function repositorioFirestore(db: Firestore): RepositorioCoach {
  return {
    async obterRoteiro(e) {
      const s = await db.doc(caminhos.roteiro(e)).get();
      return s.exists ? (s.data() as Roteiro) : null;
    },
    async salvarRoteiro(e, r) {
      await db.doc(caminhos.roteiro(e)).set(limpo(r));
    },
    async obterConfig(e) {
      const s = await db.doc(caminhos.config(e)).get();
      return s.exists ? (s.data() as ConfigCoach) : null;
    },
    async salvarConfig(e, c) {
      await db.doc(caminhos.config(e)).set(limpo(c));
    },
    async obterReuniao(e, id) {
      const s = await db.doc(caminhos.reuniao(e, id)).get();
      const r = s.exists ? (s.data() as Reuniao) : null;
      return r && r.empresaId === e ? r : null;
    },
    async salvarReuniao(r) {
      await db.doc(caminhos.reuniao(r.empresaId, r.id)).set(limpo(r));
    },
    async atualizarReuniao(e, id, fn) {
      const ref = db.doc(caminhos.reuniao(e, id));
      return db.runTransaction(async (t) => {
        const s = await t.get(ref);
        const r = s.exists ? (s.data() as Reuniao) : null;
        if (!r || r.empresaId !== e) return null;
        const nova = limpo(fn(r));
        t.set(ref, nova);
        return nova;
      });
    },
    async listarReunioes(e, f = {}) {
      let q = db.collection(caminhos.reunioes(e)) as FirebaseFirestore.Query;
      if (f.vendedorUid) q = q.where('vendedorUid', '==', f.vendedorUid);
      if (f.contatoId) q = q.where('contatoId', '==', f.contatoId);
      if (f.desdeISO) q = q.where('criadoEm', '>=', f.desdeISO);
      const snap = await q.orderBy('criadoEm', 'desc').limit(f.limite ?? 500).get();
      return snap.docs.map((d) => d.data() as Reuniao).filter((r) => r.empresaId === e);
    },
  };
}
