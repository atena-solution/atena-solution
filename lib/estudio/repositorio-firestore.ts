// Repositório do Estúdio no Firestore (Admin SDK, só no servidor).
// Caminhos (contrato 00-base + combinado com a sessão E):
//   empresas/{empresaId}                  campo marca (kit) e plano.creditos (saldo)
//   empresas/{empresaId}/criacoes/{id}    galeria
//   empresas/{empresaId}/pautas/{id}      calendário de conteúdo
//   empresas/{empresaId}/creditos/{id}    extrato ÚNICO de créditos (formato MovimentoCredito de lib/planos/creditos.ts)
// Não importa firebase-admin aqui para não amarrar a versão: recebe o `db` pronto (lib/firebase da Base).
// CONFIRMAR AO VIVO com o emulador/projeto real.
import type { Pauta } from './calendario';
import type { OperacaoCredito, RepositorioEstudio } from './repositorio';
import { exigirMesmaEmpresa } from './repositorio';
import type { Criacao, KitMarca, LancamentoCredito } from './tipos';

/** Mesmo formato de lib/planos/creditos.ts (sessão E). */
export interface MovimentoCredito {
  id: string;
  empresaId: string;
  origem: 'plano_mensal' | 'pacote' | 'estorno' | 'cortesia' | 'uso' | 'devolucao';
  quantidade: number; // + entra, - sai
  saldoDepois: number;
  descricao: string;
  referencia?: string;
  quando: string;
}

export function paraMovimento(l: LancamentoCredito): MovimentoCredito {
  const m: MovimentoCredito = {
    id: l.id,
    empresaId: l.empresaId,
    origem: l.tipo === 'debito' ? 'uso' : l.tipo === 'devolucao' ? 'devolucao' : 'cortesia',
    quantidade: l.tipo === 'debito' ? -l.valor : l.valor,
    saldoDepois: l.saldoDepois,
    descricao: l.motivo,
    quando: l.quando,
  };
  if (l.criacaoId) m.referencia = l.criacaoId;
  return m;
}

export function deMovimento(m: MovimentoCredito): LancamentoCredito {
  const tipo: LancamentoCredito['tipo'] = m.origem === 'uso' ? 'debito' : m.origem === 'devolucao' ? 'devolucao' : m.quantidade < 0 ? 'debito' : 'recarga';
  return {
    id: m.id,
    empresaId: m.empresaId,
    tipo,
    valor: Math.abs(m.quantidade),
    saldoDepois: m.saldoDepois,
    motivo: m.descricao,
    criacaoId: m.origem === 'uso' || m.origem === 'devolucao' ? m.referencia : undefined,
    quando: m.quando,
  };
}

// Tipos mínimos do Admin SDK que usamos.
interface Snap { exists: boolean; data(): Record<string, unknown> | undefined; get(campo: string): unknown }
interface QuerySnap { docs: { data(): Record<string, unknown> }[] }
interface DocRef { get(): Promise<Snap>; set(d: object, o?: { merge: boolean }): Promise<unknown>; delete(): Promise<unknown>; collection(n: string): ColRef }
interface Query { get(): Promise<QuerySnap>; where(c: string, op: string, v: unknown): Query; orderBy(c: string, d?: 'asc' | 'desc'): Query; limit(n: number): Query }
interface ColRef extends Query { doc(id: string): DocRef }
interface Tx { get(r: DocRef): Promise<Snap>; get(q: Query): Promise<QuerySnap>; set(r: DocRef, d: object, o?: { merge: boolean }): void }
export interface FirestoreMinimo { collection(n: string): ColRef; runTransaction<T>(f: (tx: Tx) => Promise<T>): Promise<T> }

/** Envia data URLs grandes ao Storage e devolve a URL (Firestore tem limite de 1 MB por documento). */
export type Armazenar = (empresaId: string, caminho: string, dataUrl: string) => Promise<string>;

export class RepositorioFirestore implements RepositorioEstudio {
  constructor(private db: FirestoreMinimo, private armazenar?: Armazenar) {}

  private emp(empresaId: string) {
    if (!empresaId) throw new Error('empresaId obrigatório.');
    return this.db.collection('empresas').doc(empresaId);
  }

  async lerKit(empresaId: string) {
    const s = await this.emp(empresaId).get();
    const m = s.get('marca') as Partial<KitMarca> | undefined;
    if (!m || !m.fontes) return null; // ainda não salvo no Estúdio → caller usa kitDaEmpresa()
    return m as KitMarca;
  }
  async salvarKit(empresaId: string, kit: KitMarca) {
    await this.emp(empresaId).set({ marca: kit }, { merge: true });
  }

  private async subirArquivos(c: Criacao): Promise<Criacao> {
    if (!this.armazenar) return c;
    const sobe = (u: string, i: number, pasta: string) =>
      u.startsWith('data:') && u.length > 50_000 ? this.armazenar!(c.empresaId, `estudio/${c.id}/${pasta}-${i}`, u) : Promise.resolve(u);
    const arquivos = await Promise.all(c.arquivos.map((u, i) => sobe(u, i, 'arquivo')));
    const origem = c.origem ? await Promise.all(c.origem.map((u, i) => sobe(u, i, 'origem'))) : undefined;
    const arte = c.arte ? { ...c.arte, fundo: await sobe(c.arte.fundo, 0, 'fundo'), ...(c.arte.fotosReais ? { fotosReais: await Promise.all(c.arte.fotosReais.map((u, i) => sobe(u, i, 'real'))) } : {}) } : undefined;
    return { ...c, arquivos, ...(origem ? { origem } : {}), ...(arte ? { arte } : {}) };
  }

  async salvarCriacao(c: Criacao) {
    const pronta = await this.subirArquivos(c);
    await this.emp(c.empresaId).collection('criacoes').doc(c.id).set(semUndefined(pronta));
  }
  async obterCriacao(empresaId: string, id: string) {
    const s = await this.emp(empresaId).collection('criacoes').doc(id).get();
    return exigirMesmaEmpresa(s.exists ? (s.data() as unknown as Criacao) : null, empresaId);
  }
  async listarCriacoes(empresaId: string) {
    const q = await this.emp(empresaId).collection('criacoes').orderBy('criadoEm', 'desc').limit(300).get();
    return q.docs.map((d) => d.data() as unknown as Criacao).filter((c) => c.empresaId === empresaId);
  }
  async apagarCriacao(empresaId: string, id: string) {
    const ref = this.emp(empresaId).collection('criacoes').doc(id);
    const s = await ref.get();
    if (!s.exists) return false;
    exigirMesmaEmpresa(s.data() as unknown as Criacao, empresaId);
    await ref.delete();
    return true;
  }

  async salvarPautas(empresaId: string, pautas: Pauta[]) {
    const col = this.emp(empresaId).collection('pautas');
    for (const p of pautas) {
      exigirMesmaEmpresa(p, empresaId);
      await col.doc(p.id).set(semUndefined(p));
    }
  }
  async listarPautas(empresaId: string, mes: string) {
    const q = await this.emp(empresaId).collection('pautas').where('data', '>=', `${mes}-01`).where('data', '<=', `${mes}-31`).get();
    return q.docs.map((d) => d.data() as unknown as Pauta).filter((p) => p.empresaId === empresaId).sort((a, b) => a.data.localeCompare(b.data));
  }
  async obterPauta(empresaId: string, id: string) {
    const s = await this.emp(empresaId).collection('pautas').doc(id).get();
    return exigirMesmaEmpresa(s.exists ? (s.data() as unknown as Pauta) : null, empresaId);
  }

  async apagarPauta(empresaId: string, id: string) {
    const ref = this.emp(empresaId).collection('pautas').doc(id);
    const s = await ref.get();
    if (!s.exists) return false;
    exigirMesmaEmpresa(s.data() as unknown as Pauta, empresaId);
    await ref.delete();
    return true;
  }

  async transacaoCreditos<T>(empresaId: string, op: OperacaoCredito<T>): Promise<T> {
    const empRef = this.emp(empresaId);
    const col = empRef.collection('creditos');
    return this.db.runTransaction(async (tx) => {
      const emp = await tx.get(empRef);
      const saldo = Number(emp.get('plano.creditos') ?? 0);
      // Só os movimentos de uso/devolução importam para devolver (limita a leitura).
      const q = await tx.get(col.where('origem', 'in', ['uso', 'devolucao']).orderBy('quando', 'desc').limit(200));
      const extrato = q.docs.map((d) => deMovimento(d.data() as unknown as MovimentoCredito));
      const r = op({ saldo, extrato });
      if (r.lancamento) {
        exigirMesmaEmpresa(r.lancamento, empresaId);
        tx.set(empRef, { plano: { creditos: r.saldo } }, { merge: true });
        tx.set(col.doc(r.lancamento.id), paraMovimento(r.lancamento));
      }
      return r.resultado;
    });
  }
  async extrato(empresaId: string) {
    const q = await this.emp(empresaId).collection('creditos').orderBy('quando', 'desc').limit(200).get();
    return q.docs.map((d) => deMovimento(d.data() as unknown as MovimentoCredito)).filter((l) => l.empresaId === empresaId);
  }
  async saldo(empresaId: string) {
    const s = await this.emp(empresaId).get();
    return Number(s.get('plano.creditos') ?? 0);
  }
}

function semUndefined<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}
