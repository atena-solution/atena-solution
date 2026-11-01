// Repositório da cobrança no Firestore (Admin SDK, só no servidor).
// Mesmo combinado com o Estúdio (sessão D): saldo em `empresas/{id}.plano.creditos`,
// extrato único em `empresas/{id}/creditos/{movId}` (formato MovimentoCredito).
// Não importa firebase-admin aqui: recebe o `db` pronto (lib/firebase da Base). CONFIRMAR AO VIVO no emulador.

import type { Assinatura } from '../planos/acesso';
import type { Aba } from '../planos/config';
import type { MovimentoCredito } from '../planos/creditos';
import type { EstadoCobranca, Mudancas, RegistroPagamento } from './liberacao';
import type { AlertaCobranca, RepositorioCobranca } from './repositorio';

interface Snap { exists: boolean; data(): Record<string, unknown> | undefined; get(campo: string): unknown }
interface QuerySnap { docs: { data(): Record<string, unknown> }[] }
interface Query { get(): Promise<QuerySnap>; where(c: string, op: string, v: unknown): Query; orderBy(c: string, d?: 'asc' | 'desc'): Query; limit(n: number): Query }
interface DocRef { get(): Promise<Snap>; set(d: object, o?: { merge: boolean }): Promise<unknown>; collection(n: string): ColRef }
interface ColRef extends Query { doc(id?: string): DocRef }
interface Tx { get(r: DocRef): Promise<Snap>; set(r: DocRef, d: object, o?: { merge: boolean }): void }
interface CollectionGroup { where(c: string, op: string, v: unknown): Query; get(): Promise<QuerySnap> }
export interface FirestoreMinimo {
  collection(n: string): ColRef;
  collectionGroup(n: string): CollectionGroup;
  runTransaction<T>(f: (tx: Tx) => Promise<T>): Promise<T>;
}

export function semUndefined<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

export class RepositorioCobrancaFirestore implements RepositorioCobranca {
  constructor(private db: FirestoreMinimo) {}

  private emp(empresaId: string): DocRef {
    if (!empresaId || empresaId.includes('/')) throw new Error('empresaId inválido.');
    return this.db.collection('empresas').doc(empresaId);
  }
  private refAssinatura(e: string) { return this.emp(e).collection('cobranca').doc('assinatura'); }

  async obterAssinatura(e: string) {
    const s = await this.refAssinatura(e).get();
    const a = s.exists ? (s.data() as unknown as Assinatura) : null;
    return a && a.empresaId === e ? a : null;
  }
  async salvarAssinatura(a: Assinatura) {
    await this.refAssinatura(a.empresaId).set(semUndefined(a));
  }
  async obterSaldo(e: string) {
    const s = await this.emp(e).get();
    return Number(s.get('plano.creditos') ?? 0) || 0;
  }
  async extrato(e: string, limite = 50) {
    const q = await this.emp(e).collection('creditos').orderBy('quando', 'desc').limit(limite).get();
    return q.docs.map((d) => d.data() as unknown as MovimentoCredito).filter((m) => m.empresaId === e);
  }
  async pagamentos(e: string, limite = 50) {
    const q = await this.emp(e).collection('pagamentos').orderBy('quando', 'desc').limit(limite).get();
    return q.docs.map((d) => d.data() as unknown as RegistroPagamento).filter((r) => r.empresaId === e);
  }

  async transacao(empresaId: string, pagamentoId: string, decidir: (estado: EstadoCobranca) => Mudancas | null) {
    const emp = this.emp(empresaId);
    const refAss = this.refAssinatura(empresaId);
    const refPag = emp.collection('pagamentos').doc(pagamentoId);
    return this.db.runTransaction(async (tx) => {
      const [sEmp, sAss, sPag] = await Promise.all([tx.get(emp), tx.get(refAss), tx.get(refPag)]);
      const estado: EstadoCobranca = {
        empresaId,
        assinatura: sAss.exists ? (sAss.data() as unknown as Assinatura) : null,
        saldoCreditos: Number(sEmp.get('plano.creditos') ?? 0) || 0,
        registro: sPag.exists ? (sPag.data() as unknown as RegistroPagamento) : null,
      };
      const m = decidir(estado);
      if (!m) return null;
      if (m.assinatura) tx.set(refAss, semUndefined(m.assinatura));
      if (m.saldoCreditos !== undefined) tx.set(emp, { plano: { creditos: m.saldoCreditos } }, { merge: true });
      if (m.movimento) tx.set(emp.collection('creditos').doc(m.movimento.id), semUndefined(m.movimento));
      if (m.registro) tx.set(refPag, semUndefined(m.registro));
      return m;
    });
  }

  async empresaDoClienteAsaas(clienteId: string) {
    const q = await this.db.collectionGroup('cobranca').where('asaasClienteId', '==', clienteId).limit(1).get();
    const a = q.docs[0]?.data() as unknown as Assinatura | undefined;
    return a?.empresaId ?? null;
  }
  async alertar(a: AlertaCobranca) {
    await this.db.collection('atena_alertas').doc().set(semUndefined({ ...a, origem: 'cobranca' }));
  }
  async alertas(limite = 50) {
    const q = await this.db.collection('atena_alertas').orderBy('quando', 'desc').limit(limite).get();
    return q.docs.map((d) => d.data() as unknown as AlertaCobranca);
  }
  async listarAssinaturas() {
    const q = await this.db.collectionGroup('cobranca').get();
    return q.docs.map((d) => d.data() as unknown as Assinatura).filter((a) => a?.empresaId && a.planoId);
  }
  async gravarAbasDaEmpresa(e: string, abas: Aba[]) {
    await this.emp(e).set({ plano: { abas } }, { merge: true });
  }
  async abasDaEmpresa(e: string) {
    const s = await this.emp(e).get();
    return (s.get('plano.abas') as Aba[] | undefined) ?? [];
  }
}
