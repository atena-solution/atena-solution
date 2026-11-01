import 'server-only';
import type { Banco } from './banco';
import { firestoreAdmin } from '../integracoes/firebase-admin';

/** Motor Firestore (Admin SDK). Só no servidor. */
export class BancoFirestore implements Banco {
  private get db() {
    return firestoreAdmin();
  }

  async obter<T>(caminho: string): Promise<T | null> {
    const s = await this.db.doc(caminho).get();
    return s.exists ? (s.data() as T) : null;
  }

  async listar<T>(colecao: string): Promise<T[]> {
    // v1: empresas pequenas — lê a coleção e filtra na memória. Trocar por consultas indexadas quando crescer.
    const s = await this.db.collection(colecao).get();
    return s.docs.map((d) => d.data() as T);
  }

  async gravar<T extends object>(caminho: string, dados: T): Promise<void> {
    await this.db.doc(caminho).set(semIndefinidos(dados));
  }

  async mesclar<T extends object>(caminho: string, dados: Partial<T>): Promise<void> {
    await this.db.doc(caminho).set(semIndefinidos(dados), { merge: true });
  }

  async apagar(caminho: string): Promise<void> {
    await this.db.doc(caminho).delete();
  }
}

/** Firestore recusa `undefined`. */
function semIndefinidos<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
